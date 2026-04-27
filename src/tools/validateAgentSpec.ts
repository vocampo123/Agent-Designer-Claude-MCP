import { getReservedKeywordError } from '../types/agent.js';
import type { AgentFormData, ValidationResult } from '../types/agent.js';

function validateForExport(formData: AgentFormData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const config = formData?.config ?? {};
  const messages = formData?.system?.messages ?? {};
  const variables = formData?.variables ?? [];
  const actions = formData?.actions ?? [];
  const topics = formData?.topics ?? [];
  const transitions = formData?.startAgent?.transitions ?? [];

  if (!config.developer_name) {
    errors.push('Developer name is required');
  } else if (!/^[a-z][a-z0-9_]*$/.test(config.developer_name)) {
    errors.push('Developer name must be snake_case (lowercase letters, numbers, underscores; start with a letter)');
  }

  if (!messages.welcome) errors.push('Welcome message is required');
  if (!messages.error) errors.push('Error message is required');
  if (topics.length === 0) errors.push('At least one topic must be defined');
  if (transitions.length === 0) errors.push('Start agent must have at least one transition');

  for (const v of variables) {
    if (v.name) {
      const kwError = getReservedKeywordError(v.name);
      if (kwError) errors.push(`Variable "${v.name}": ${kwError}`);
      else if (!/^[a-z][a-z0-9_]*$/.test(v.name)) {
        errors.push(`Variable "${v.name}" must be snake_case`);
      }
    }
  }

  for (const topic of topics) {
    if (!topic.description) {
      errors.push(`Topic "${topic.name || 'unnamed'}" needs a description`);
    }
    for (const trans of transitions) {
      if (trans.targetTopic && !topics.some(t => t.name === trans.targetTopic)) {
        errors.push(`Transition "${trans.name}" points to undefined topic "${trans.targetTopic}"`);
      }
    }
  }

  const persona = formData?.persona;
  if (!persona?.identity?.length) {
    warnings.push('No persona identity traits defined — agent will use generic LLM voice');
  }
  if (variables.length === 0) warnings.push("No variables defined — agent won't track state");
  if (actions.length === 0) warnings.push("No actions defined — agent can't interact with Salesforce");

  const actionsWithoutLoading = actions.filter(a => a.name && !a.loadingText);
  if (actionsWithoutLoading.length > 0) {
    warnings.push(`${actionsWithoutLoading.length} action(s) missing in-character loading text`);
  }

  for (const topic of topics.filter(t => !t.workflow?.length)) {
    warnings.push(`Topic "${topic.name || 'unnamed'}" has no workflow defined`);
  }

  const topicsWithoutCalibration = topics.filter(t => !t.personaCalibration?.personaReminder);
  if (topicsWithoutCalibration.length > 0) {
    warnings.push(`${topicsWithoutCalibration.length} topic(s) missing persona calibration — may cause persona drift`);
  }

  return { isValid: errors.length === 0, errors, warnings };
}

export const validateAgentSpecTool = {
  name: 'validate_agent_specification',
  description:
    'Validate an agent definition for completeness and correctness before export. ' +
    'Returns a list of blocking errors and non-blocking warnings. ' +
    'isValid is true only when there are zero errors.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      formData: {
        type: 'object',
        description: 'The agent definition to validate (AgentFormData).',
      },
    },
    required: ['formData'],
  },
  handler(args: { formData: AgentFormData }): ValidationResult {
    return validateForExport(args.formData);
  },
};
