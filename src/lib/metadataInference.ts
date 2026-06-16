// Metadata Inference Utilities
// Auto-populate metadata fields with smart defaults based on context

import type { VariableType, Action, Parameter, Variable } from '../types/agent.js';

/**
 * Infer complex_data_type_name from parameter type and name
 */
export function inferComplexDataType(type: VariableType, paramName: string): string | undefined {
  const lowerName = paramName.toLowerCase();

  // ID types
  if (type === 'id' || lowerName.includes('id') || lowerName.endsWith('_id')) {
    return 'lightning__recordIdType';
  }

  // Date types
  if (type === 'date' || lowerName.includes('date')) {
    return 'lightning__dateType';
  }

  // DateTime for timestamp-like names
  if (lowerName.includes('datetime') || lowerName.includes('timestamp')) {
    return 'lightning__dateTimeStringType';
  }

  // Rich text for description-like fields
  if (lowerName.includes('description') || lowerName.includes('notes') || lowerName.includes('summary')) {
    return 'lightning__richTextType';
  }

  return undefined;
}

/**
 * Infer if an action requires user confirmation based on its name
 * Destructive or high-impact actions should require confirmation
 */
export function inferConfirmationRequired(actionName: string): boolean {
  const lowerName = actionName.toLowerCase();
  const destructiveVerbs = [
    'create', 'update', 'delete', 'remove', 'submit', 'complete',
    'approve', 'reject', 'cancel', 'close', 'finalize', 'process'
  ];

  return destructiveVerbs.some(verb => lowerName.startsWith(verb) || lowerName.includes(`_${verb}`));
}

/**
 * Infer source naming convention from agent and action name
 */
export function inferSource(agentName: string, actionName: string): string {
  // Strip special chars and use PascalCase for namespace
  const cleanAgentName = agentName.replace(/[^a-zA-Z0-9]/g, '');
  return `${cleanAgentName}__${actionName}`;
}

/**
 * Convert snake_case or camelCase to Title Case for labels
 */
export function inferLabel(name: string): string {
  // Handle snake_case
  if (name.includes('_')) {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  // Handle camelCase or PascalCase
  return name
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/^./, str => str.toUpperCase());
}

/**
 * Infer if a parameter is user input vs system-derived
 * User inputs typically come from conversation, system inputs from context
 */
export function inferIsUserInput(paramName: string, actionName: string): boolean {
  const lowerName = paramName.toLowerCase();

  // System context variables (not user-provided)
  const systemPatterns = [
    'currentrecordid', 'currentobjectapiname', 'sessionid', 'userid',
    'enduserid', 'routableid', 'contactid', 'timestamp', 'source'
  ];

  if (systemPatterns.some(pattern => lowerName.includes(pattern))) {
    return false;
  }

  // For search/query actions, search terms are user input
  if (actionName.toLowerCase().includes('search') || actionName.toLowerCase().includes('query')) {
    if (lowerName.includes('query') || lowerName.includes('search') || lowerName.includes('name')) {
      return true;
    }
  }

  // Default: assume user input unless proven otherwise
  return true;
}

/**
 * Infer progress indicator message from action name
 */
export function inferProgressMessage(actionName: string): string {
  const label = inferLabel(actionName);

  // Convert "Create Record" to "Creating record..."
  const verb = label.split(' ')[0];
  const rest = label.split(' ').slice(1).join(' ').toLowerCase();

  const gerundMap: Record<string, string> = {
    'Create': 'Creating',
    'Update': 'Updating',
    'Delete': 'Deleting',
    'Search': 'Searching',
    'Find': 'Finding',
    'Get': 'Getting',
    'Retrieve': 'Retrieving',
    'Submit': 'Submitting',
    'Process': 'Processing',
    'Generate': 'Generating',
    'Calculate': 'Calculating',
    'Validate': 'Validating',
    'Check': 'Checking',
  };

  const gerund = gerundMap[verb] || `${verb}ing`;
  return `${gerund} ${rest}...`;
}

/**
 * Apply smart defaults to an action
 */
export function applyActionDefaults(action: Action, agentName: string): Action {
  const enhanced = { ...action };

  // Add label if not present
  if (!enhanced.label) {
    enhanced.label = inferLabel(action.name);
  }

  // Add source if not present
  if (!enhanced.source) {
    enhanced.source = inferSource(agentName, action.name);
  }

  // Add confirmation requirement if not explicitly set
  if (enhanced.requireUserConfirmation === undefined) {
    enhanced.requireUserConfirmation = inferConfirmationRequired(action.name);
  }

  // Add progress indicator if not present
  if (enhanced.includeProgressIndicator === undefined) {
    enhanced.includeProgressIndicator = true;
  }

  // Add progress message if not present
  if (!enhanced.progressIndicatorMessage && !enhanced.loadingText) {
    enhanced.progressIndicatorMessage = inferProgressMessage(action.name);
  } else if (enhanced.loadingText && !enhanced.progressIndicatorMessage) {
    // Migrate loadingText to progressIndicatorMessage
    enhanced.progressIndicatorMessage = enhanced.loadingText;
  }

  // Enhance inputs
  enhanced.inputs = action.inputs.map(input => applyParameterDefaults(input, action.name, 'input'));

  // Enhance outputs
  enhanced.outputs = action.outputs.map(output => applyParameterDefaults(output, action.name, 'output'));

  return enhanced;
}

/**
 * Apply smart defaults to a parameter
 */
export function applyParameterDefaults(
  param: Parameter,
  actionName: string,
  direction: 'input' | 'output'
): Parameter {
  const enhanced = { ...param };

  // Add label if not present
  if (!enhanced.label) {
    enhanced.label = inferLabel(param.name);
  }

  // Add complex data type if not present
  if (!enhanced.complexDataTypeName) {
    enhanced.complexDataTypeName = inferComplexDataType(param.type, param.name);
  }

  // Inputs vs outputs have different defaults
  if (direction === 'input') {
    if (enhanced.isUserInput === undefined) {
      enhanced.isUserInput = inferIsUserInput(param.name, actionName);
    }
    if (enhanced.isDisplayable === undefined) {
      enhanced.isDisplayable = true;
    }
  } else {
    // Outputs
    if (enhanced.isDisplayable === undefined) {
      // IDs are typically not displayed, other outputs are
      enhanced.isDisplayable = !param.name.toLowerCase().endsWith('id');
    }
    if (enhanced.filterFromAgent === undefined) {
      enhanced.filterFromAgent = false;
    }
  }

  return enhanced;
}

/**
 * Apply smart defaults to a variable
 */
export function applyVariableDefaults(variable: Variable): Variable {
  const enhanced = { ...variable };

  // Infer visibility if not set
  if (!enhanced.visibility) {
    const lowerName = variable.name.toLowerCase();

    // External variables (exposed to platform)
    const externalPatterns = [
      'currentrecordid', 'currentobject', 'enduserid', 'contactid',
      'routableid', 'sessionid', 'currentapp', 'currentpage'
    ];

    if (externalPatterns.some(pattern => lowerName.includes(pattern))) {
      enhanced.visibility = 'External';
    } else {
      enhanced.visibility = 'Internal';
    }
  }

  return enhanced;
}
