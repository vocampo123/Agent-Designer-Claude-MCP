import type { AgentFormData, RuntimeState, Topic } from '../types/agent.js';
import { TopicRouter } from './TopicRouter.js';
import { WorkflowExecutor, type PhaseResult } from './WorkflowExecutor.js';
import { MockActionEngine } from './MockActionEngine.js';
import { interpolate } from './interpolation.js';

export interface AgentResponse {
  message: string;
  suggestedResponses?: string[];
  topicTransition?: string;
  variablesUpdated?: Record<string, any>;
  actionExecuted?: string;
}

export function createInitialState(formData: AgentFormData): RuntimeState {
  const variables: Record<string, any> = {};
  for (const v of formData.variables ?? []) {
    if (v.defaultValue !== undefined && v.defaultValue !== '') {
      variables[v.name] = v.defaultValue;
    }
  }
  return { currentTopic: null, currentPhaseIndex: 0, variables, phase: 'routing', conversationComplete: false };
}

export function processMessage(
  userInput: string,
  formData: AgentFormData,
  state: RuntimeState,
  mockOverrides?: Record<string, Record<string, any>>
): { response: AgentResponse; updatedState: RuntimeState } {
  const mockEngine = new MockActionEngine();
  if (mockOverrides) mockEngine.restoreOverrides(mockOverrides);

  const executor = new WorkflowExecutor(mockEngine);
  const router = new TopicRouter();
  const s: RuntimeState = JSON.parse(JSON.stringify(state)); // deep clone — state is immutable in MCP

  const respond = (response: AgentResponse) => ({ response, updatedState: s });

  // Check for topic-switch intent mid-workflow
  if (s.currentTopic && s.phase !== 'routing') {
    const switchMatch = router.route(userInput, formData.topics, formData.startAgent, s);
    if (switchMatch && switchMatch.topic.name !== s.currentTopic && switchMatch.confidence > 0.5) {
      s.waitingForVariable = undefined;
      s.currentTopic = switchMatch.topic.name;
      s.currentPhaseIndex = 0;
      s.phase = 'in_topic';
      const next = executeNextPhase(switchMatch.topic, s, formData, executor);
      return respond({
        ...next,
        message: `Switching to ${switchMatch.topic.displayName || switchMatch.topic.name}.\n\n${next.message ?? ''}`.trim(),
        topicTransition: switchMatch.topic.name,
      });
    }
  }

  if (s.waitingForVariable) return respond(captureVariable(userInput, s, formData, executor));
  if (s.phase === 'routing' || s.currentTopic === null) return respond(routeToTopic(userInput, s, formData, router, executor));
  if (s.phase === 'awaiting_confirmation') return respond(handleConfirmation(userInput, s, formData, mockEngine));
  if (s.phase === 'topic_complete') return respond(handlePostTopic(userInput, s, formData, router, executor));
  return respond(processCurrentPhase(userInput, s, formData, router, executor));
}

// ── helpers ─────────────────────────────────────────────────────────────────

function routeToTopic(input: string, s: RuntimeState, formData: AgentFormData, router: TopicRouter, executor: WorkflowExecutor): AgentResponse {
  const match = router.route(input, formData.topics, formData.startAgent, s);
  if (match) {
    s.currentTopic = match.topic.name;
    s.currentPhaseIndex = 0;
    s.phase = 'in_topic';
    return executeNextPhase(match.topic, s, formData, executor);
  }
  const names = formData.topics.map(t => t.displayName || t.name).join(', ');
  return { message: `I can help you with: ${names}. Which would you like?` };
}

function executeNextPhase(topic: Topic, s: RuntimeState, formData: AgentFormData, executor: WorkflowExecutor): AgentResponse {
  const workflow = topic.workflow ?? [];
  if (s.currentPhaseIndex >= workflow.length) {
    s.phase = 'topic_complete';
    return { message: 'Is there anything else I can help you with?' };
  }
  const result = executor.executePhase(workflow[s.currentPhaseIndex], s, formData);
  return handlePhaseResult(result, topic, s, formData, executor);
}

function handlePhaseResult(result: PhaseResult, topic: Topic, s: RuntimeState, formData: AgentFormData, executor: WorkflowExecutor): AgentResponse {
  const response: AgentResponse = { message: result.message };
  if (result.variablesToSet) { Object.assign(s.variables, result.variablesToSet); response.variablesUpdated = result.variablesToSet; }
  if (result.actionExecuted) response.actionExecuted = result.actionExecuted;
  if (result.waitingForInput) { s.waitingForVariable = result.waitingForInput; return response; }
  if (result.blocked) { s.phase = 'routing'; s.currentTopic = null; s.currentPhaseIndex = 0; return response; }
  if (result.awaitingConfirmation) { s.phase = 'awaiting_confirmation'; return response; }
  if (result.nextPhase) {
    s.currentPhaseIndex++;
    const next = executeNextPhase(topic, s, formData, executor);
    return {
      ...next,
      message: result.message ? `${result.message}\n\n${next.message ?? ''}`.trim() : next.message,
      variablesUpdated: { ...response.variablesUpdated, ...next.variablesUpdated },
      actionExecuted: response.actionExecuted ?? next.actionExecuted,
    };
  }
  return response;
}

function captureVariable(input: string, s: RuntimeState, formData: AgentFormData, executor: WorkflowExecutor): AgentResponse {
  const varName = s.waitingForVariable!;
  s.variables[varName] = input;
  s.waitingForVariable = undefined;
  const topic = formData.topics.find(t => t.name === s.currentTopic);
  if (topic) {
    s.currentPhaseIndex++;
    const next = executeNextPhase(topic, s, formData, executor);
    return { ...next, variablesUpdated: { [varName]: input, ...next.variablesUpdated } };
  }
  return { message: '', variablesUpdated: { [varName]: input } };
}

function handleConfirmation(input: string, s: RuntimeState, formData: AgentFormData, mockEngine: MockActionEngine): AgentResponse {
  const n = input.toLowerCase().trim();
  const isYes = ['yes', 'y', 'confirm', 'ok', 'sure', 'proceed', 'submit'].some(w => n.includes(w));
  const isNo  = ['no', 'n', 'cancel', 'stop', 'back'].some(w => n.includes(w));

  const topic = formData.topics.find(t => t.name === s.currentTopic);

  if (isYes) {
    const confirmPhase = topic?.workflow?.find(p => p.type === 'confirm');
    const cfg = confirmPhase?.config as { submitAction?: string; successMessage?: string } | undefined;
    if (cfg?.submitAction) {
      const action = formData.actions.find(a => a.name === cfg.submitAction);
      if (action) {
        const outputs = mockEngine.execute(action, s.variables);
        Object.assign(s.variables, outputs);
      }
    }
    s.phase = 'topic_complete';
    const msg = interpolate(cfg?.successMessage || 'Done! Is there anything else I can help you with?', s.variables);
    return { message: msg, actionExecuted: cfg?.submitAction };
  }

  if (isNo) {
    s.phase = 'routing'; s.currentTopic = null; s.currentPhaseIndex = 0;
    return { message: 'Cancelled. What else can I help you with?' };
  }

  return { message: 'Please confirm with yes or no.' };
}

function handlePostTopic(input: string, s: RuntimeState, formData: AgentFormData, router: TopicRouter, executor: WorkflowExecutor): AgentResponse {
  const n = input.toLowerCase().trim();
  if (['no', 'nothing', 'done', 'bye', 'thanks', 'thank you'].some(w => n.includes(w))) {
    s.conversationComplete = true;
    return { message: 'Thank you! Have a great day!' };
  }
  s.phase = 'routing'; s.currentTopic = null; s.currentPhaseIndex = 0;
  return routeToTopic(input, s, formData, router, executor);
}

function processCurrentPhase(input: string, s: RuntimeState, formData: AgentFormData, router: TopicRouter, executor: WorkflowExecutor): AgentResponse {
  const topic = formData.topics.find(t => t.name === s.currentTopic);
  if (!topic) {
    s.phase = 'routing'; s.currentTopic = null; s.currentPhaseIndex = 0;
    return routeToTopic(input, s, formData, router, executor);
  }

  const workflow = topic.workflow ?? [];
  if (s.currentPhaseIndex >= workflow.length) {
    s.phase = 'topic_complete';
    return handlePostTopic(input, s, formData, router, executor);
  }

  const phase = workflow[s.currentPhaseIndex];
  if (phase.type === 'collect') {
    const cfg = (phase.config ?? {}) as { variableName?: string };
    if (cfg.variableName) {
      s.variables[cfg.variableName] = input;
      s.currentPhaseIndex++;
      const next = executeNextPhase(topic, s, formData, executor);
      return { ...next, variablesUpdated: { [cfg.variableName]: input, ...next.variablesUpdated } };
    }
  }
  if (phase.type === 'confirm') return handleConfirmation(input, s, formData, new MockActionEngine());

  const result = executor.executePhase(phase, s, formData);
  return handlePhaseResult(result, topic, s, formData, executor);
}
