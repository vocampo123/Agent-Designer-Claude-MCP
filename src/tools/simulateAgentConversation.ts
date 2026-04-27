import { processMessage, createInitialState } from '../lib/AgentRuntime.js';
import type { AgentFormData, RuntimeState } from '../types/agent.js';

export interface SimulationInput {
  formData: AgentFormData;
  userMessage: string;
  state?: RuntimeState;
  mockOverrides?: Record<string, Record<string, any>>;
}

export interface SimulationOutput {
  agentMessage: string;
  updatedState: RuntimeState;
  topicTransition?: string;
  variablesUpdated?: Record<string, any>;
  actionExecuted?: string;
  conversationComplete: boolean;
}

export const simulateAgentConversationTool = {
  name: 'simulate_agent_conversation',
  description:
    'Simulate one turn of an Agentforce agent conversation. ' +
    'Pass the agent definition, the user message, and the current simulation state. ' +
    'Returns the agent reply, the updated state (pass this back in on the next turn), ' +
    'and metadata about variable changes and actions executed.\n\n' +
    'On the first turn, omit `state` — the engine will initialize it from the agent definition. ' +
    'Use `mockOverrides` to pin specific action responses, e.g. to test edge cases like out-of-stock inventory.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      formData: {
        type: 'object',
        description: 'The complete agent definition (AgentFormData).',
      },
      userMessage: {
        type: 'string',
        description: 'The message the simulated user is sending to the agent.',
      },
      state: {
        type: 'object',
        description: 'The current simulation state from the previous turn. Omit on the first turn.',
      },
      mockOverrides: {
        type: 'object',
        description: 'Optional map of actionName → fixed output object, to override smart mock behavior.',
      },
    },
    required: ['formData', 'userMessage'],
  },
  handler(args: SimulationInput): SimulationOutput {
    const { formData, userMessage, mockOverrides } = args;
    const state = args.state ?? createInitialState(formData);

    const { response, updatedState } = processMessage(userMessage, formData, state, mockOverrides);

    return {
      agentMessage: response.message,
      updatedState,
      topicTransition: response.topicTransition,
      variablesUpdated: response.variablesUpdated,
      actionExecuted: response.actionExecuted,
      conversationComplete: updatedState.conversationComplete,
    };
  },
};
