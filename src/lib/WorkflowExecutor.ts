import type {
  WorkflowPhase, RuntimeState, AgentFormData,
  PermissionConfig, CollectConfig, LogicConfig, ConfirmConfig, ActionConfig,
} from '../types/agent.js';
import { MockActionEngine } from './MockActionEngine.js';
import { interpolate } from './interpolation.js';

export interface PhaseResult {
  message: string;
  nextPhase?: boolean;
  variablesToSet?: Record<string, any>;
  waitingForInput?: string;
  blocked?: boolean;
  awaitingConfirmation?: boolean;
  actionExecuted?: string;
}

export class WorkflowExecutor {
  constructor(private mockEngine: MockActionEngine) {}

  executePhase(phase: WorkflowPhase, state: RuntimeState, formData: AgentFormData): PhaseResult {
    const cfg = phase.config ?? {};
    switch (phase.type) {
      case 'permission': return this.permission(cfg as PermissionConfig, state, formData);
      case 'collect':    return this.collect(cfg as CollectConfig, state);
      case 'logic':      return this.logic(cfg as LogicConfig, state, formData);
      case 'action':     return this.action(cfg as ActionConfig, state, formData);
      case 'confirm':    return this.confirm(cfg as ConfirmConfig, state);
      default:           return { message: '', nextPhase: true };
    }
  }

  private permission(cfg: PermissionConfig, state: RuntimeState, formData: AgentFormData): PhaseResult {
    const result: PhaseResult = { message: '', nextPhase: true };

    if (cfg.checkAction) {
      const action = formData.actions.find(a => a.name === cfg.checkAction);
      if (action) {
        const outputs = this.mockEngine.execute(action, state.variables);
        result.variablesToSet = {};
        result.actionExecuted = cfg.checkAction;
        if (cfg.roleVariable && outputs.role) result.variablesToSet[cfg.roleVariable] = outputs.role;
        if (outputs.authorized !== undefined) result.variablesToSet['is_authorized'] = outputs.authorized;
      }
    }

    const roleValue = result.variablesToSet?.[cfg.roleVariable ?? ''] ?? state.variables[cfg.roleVariable ?? ''];
    if (cfg.blockedRoles?.includes(roleValue)) {
      return {
        message: interpolate(cfg.blockMessage || 'You do not have permission.', { ...state.variables, ...result.variablesToSet }),
        blocked: true,
        variablesToSet: result.variablesToSet,
        actionExecuted: result.actionExecuted,
      };
    }

    if (roleValue) result.message = `✓ Verified as ${roleValue}.`;
    return result;
  }

  private collect(cfg: CollectConfig, state: RuntimeState): PhaseResult {
    if (state.variables[cfg.variableName] !== undefined && state.variables[cfg.variableName] !== '') {
      return { message: '', nextPhase: true };
    }
    return {
      message: interpolate(cfg.prompt || `Please provide ${cfg.variableName}:`, state.variables),
      waitingForInput: cfg.variableName,
    };
  }

  private logic(cfg: LogicConfig, state: RuntimeState, formData: AgentFormData): PhaseResult {
    const result: PhaseResult = { message: '', nextPhase: true };

    if (cfg.actionToRun) {
      const action = formData.actions.find(a => a.name === cfg.actionToRun);
      if (action) {
        const inputs: Record<string, any> = {};
        for (const [k, v] of Object.entries(cfg.actionInputs ?? {})) {
          inputs[k] = typeof v === 'string' && v.startsWith('@variables.')
            ? state.variables[v.replace('@variables.', '')]
            : v;
        }
        const outputs = this.mockEngine.execute(action, inputs);
        result.actionExecuted = cfg.actionToRun;
        result.variablesToSet = {};
        for (const [outName, varName] of Object.entries(cfg.actionOutputs ?? {})) {
          if (outputs[outName] !== undefined) result.variablesToSet[varName] = outputs[outName];
        }
      }
    }

    const merged = { ...state.variables, ...result.variablesToSet };
    const conditionMet = cfg.condition ? this.evaluateCondition(cfg.condition, merged) : true;
    if (conditionMet && cfg.message) result.message = interpolate(cfg.message, merged);

    return result;
  }

  private action(cfg: ActionConfig, state: RuntimeState, formData: AgentFormData): PhaseResult {
    const result: PhaseResult = { message: '', nextPhase: true };
    if (!cfg.actionName) return result;

    const action = formData.actions.find(a => a.name === cfg.actionName);
    if (!action) return result;

    const inputs: Record<string, any> = {};
    for (const [k, v] of Object.entries(cfg.inputs ?? {})) {
      inputs[k] = typeof v === 'string' && v.startsWith('@variables.')
        ? state.variables[v.replace('@variables.', '')]
        : v;
    }

    const outputs = this.mockEngine.execute(action, inputs);
    result.actionExecuted = cfg.actionName;
    result.variablesToSet = {};
    for (const [outName, varName] of Object.entries(cfg.outputs ?? {})) {
      if (outputs[outName] !== undefined) result.variablesToSet[varName] = outputs[outName];
    }

    return result;
  }

  private confirm(cfg: ConfirmConfig, state: RuntimeState): PhaseResult {
    let message = "Here's a summary of your request:\n\n";
    for (const field of cfg.summaryFields ?? []) {
      const display = field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      message += `• **${display}:** ${state.variables[field] ?? 'Not provided'}\n`;
    }
    message += '\n' + interpolate(cfg.confirmPrompt || 'Would you like to proceed?', state.variables);
    return { message, awaitingConfirmation: true };
  }

  private evaluateCondition(condition: string, variables: Record<string, any>): boolean {
    const m = condition.match(/@variables\.(\w+)\s*(==|!=|>|<|>=|<=)\s*['"]?([^'"]+)['"]?/);
    if (!m) {
      const simple = condition.match(/@variables\.(\w+)/);
      return simple ? !!variables[simple[1]] : true;
    }
    const [, varName, op, val] = m;
    const v = variables[varName];

    const toBool = (x: any) => x === true || String(x).toLowerCase() === 'true' || x === '1';
    const isBoolLike = (x: any) => ['true', 'false', '1', '0'].includes(String(x).toLowerCase());

    switch (op) {
      case '==': return (isBoolLike(v) || isBoolLike(val)) ? toBool(v) === toBool(val) : String(v) === String(val);
      case '!=': return (isBoolLike(v) || isBoolLike(val)) ? toBool(v) !== toBool(val) : String(v) !== String(val);
      case '>':  return Number(v) > Number(val);
      case '<':  return Number(v) < Number(val);
      case '>=': return Number(v) >= Number(val);
      case '<=': return Number(v) <= Number(val);
      default:   return true;
    }
  }
}
