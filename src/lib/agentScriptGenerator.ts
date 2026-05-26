// Agent Script Generator
// Ported from the Cursor extension — transforms AgentFormData into Agent Script DSL
// Compatible with Agentforce DX (2026 spec)

import type {
  AgentFormData,
  Action,
  Topic,
  WorkflowPhase,
  PermissionConfig,
  CollectConfig,
  LogicConfig,
  ActionConfig,
  ConfirmConfig,
  PersonaCalibration,
} from '../types/agent.js';

const INDENT = '   '; // 3-space indent per official Agent Script standard

function indent(level: number): string {
  return INDENT.repeat(level);
}

function escapeString(str: string): string {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function escapeMultilineString(str: string): string {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDefaultValue(value: string, type: string): string {
  if (value === undefined || value === null || value === '') {
    if (type === 'boolean') return 'false';
    if (type === 'number') return '0';
    return '""';
  }
  if (type === 'boolean') return value.toLowerCase() === 'true' ? 'true' : 'false';
  if (type === 'number') return value;
  return `"${escapeString(value)}"`;
}

function mapType(type: string): string {
  const typeMap: Record<string, string> = {
    string: 'string',
    number: 'number',
    boolean: 'boolean',
    date: 'string',
    id: 'string',
  };
  return typeMap[type] ?? 'string';
}

function formatCondition(condition: string): string {
  return condition
    .replace(/@variable\./g, '@variables.')
    .replace(/@outputs\./g, '@outputs.')
    .replace(/is not None/g, '!= ""')
    .replace(/is None/g, '== ""')
    .replace(/ == True/g, ' == true')
    .replace(/ == False/g, ' == false')
    .replace(/ == "True"/g, ' == true')
    .replace(/ == "False"/g, ' == false');
}

function formatConditionForText(condition: string): string {
  return condition
    .replace(/@variables\./g, '')
    .replace(/ == "/g, ' is "')
    .replace(/ != "/g, ' is not "')
    .replace(/ == true/gi, ' is true')
    .replace(/ == false/gi, ' is false')
    .replace(/_/g, ' ');
}

function getActionRefsFromWorkflow(workflow: WorkflowPhase[]): string[] {
  const refs = new Set<string>();
  for (const phase of workflow) {
    const cfg = (phase.config ?? {}) as Record<string, any>;
    if (cfg.checkAction) refs.add(cfg.checkAction);
    if (cfg.actionToRun) refs.add(cfg.actionToRun);
    if (cfg.submitAction) refs.add(cfg.submitAction);
    if (cfg.actionName) refs.add(cfg.actionName);
  }
  return Array.from(refs);
}

function generateProceduralInstructions(
  topic: Topic,
  actions: Action[],
  formData: AgentFormData
): string[] {
  const lines: string[] = [];
  const base = 3;
  const validVars = new Set((formData.variables ?? []).map(v => v.name));

  lines.push(`${indent(base)}| Help the user with ${topic.displayName || topic.name.replace(/_/g, ' ')}.`);
  lines.push(`${indent(base)}|`);

  for (const phase of topic.workflow ?? []) {
    switch (phase.type) {
      case 'permission': {
        const cfg = (phase.config ?? {}) as PermissionConfig;
        if (cfg.blockedRoles?.length) {
          const roleVar = cfg.roleVariable || 'requestor_role';
          if (validVars.has(roleVar)) {
            for (const role of cfg.blockedRoles) {
              lines.push(`${indent(base)}| If user role is ${role}: ${escapeMultilineString(cfg.blockMessage || 'Access denied.')}`);
            }
          }
        }
        break;
      }
      case 'collect': {
        const cfg = (phase.config ?? {}) as CollectConfig;
        if (cfg.variableName && cfg.prompt && validVars.has(cfg.variableName)) {
          lines.push(`${indent(base)}|`);
          lines.push(`${indent(base)}| Collect ${cfg.variableName.replace(/_/g, ' ')}:`);
          for (const line of cfg.prompt.split('\n')) {
            if (line.trim()) lines.push(`${indent(base)}| ${escapeMultilineString(line)}`);
          }
        }
        break;
      }
      case 'logic': {
        const cfg = (phase.config ?? {}) as LogicConfig;
        if (cfg.actionToRun) {
          const action = actions.find(a => a.name === cfg.actionToRun);
          if (action) {
            lines.push(`${indent(base)}|`);
            lines.push(`${indent(base)}| Use ${action.name} to ${action.description.toLowerCase()}.`);
          }
        }
        if (cfg.message) {
          if (cfg.condition) {
            lines.push(`${indent(base)}| When ${formatConditionForText(cfg.condition)}: ${escapeMultilineString(cfg.message)}`);
          } else {
            lines.push(`${indent(base)}| ${escapeMultilineString(cfg.message)}`);
          }
        }
        break;
      }
      case 'action': {
        const cfg = (phase.config ?? {}) as ActionConfig;
        if (cfg.actionName) {
          const action = actions.find(a => a.name === cfg.actionName);
          if (action) {
            lines.push(`${indent(base)}|`);
            lines.push(`${indent(base)}| Execute ${action.name} to ${action.description.toLowerCase()}.`);
          }
        }
        break;
      }
      case 'confirm': {
        const cfg = (phase.config ?? {}) as ConfirmConfig;
        lines.push(`${indent(base)}|`);
        lines.push(`${indent(base)}| Before submitting, confirm with the user:`);
        for (const field of cfg.summaryFields ?? []) {
          if (validVars.has(field)) {
            const label = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            lines.push(`${indent(base)}| - ${label}`);
          }
        }
        if (cfg.confirmPrompt) lines.push(`${indent(base)}| ${escapeMultilineString(cfg.confirmPrompt)}`);
        if (cfg.successMessage) lines.push(`${indent(base)}| On success: ${escapeMultilineString(cfg.successMessage)}`);
        break;
      }
    }
  }

  return lines;
}

function generateReasoningActionsBlock(
  workflow: WorkflowPhase[],
  actions: Action[],
  formData: AgentFormData
): string[] {
  const lines: string[] = [];
  const processed = new Set<string>();
  const base = 3;
  const validVars = new Set((formData.variables ?? []).map(v => v.name));

  const findMatchingVar = (inputName: string): string | null => {
    if (validVars.has(inputName)) return inputName;
    const mappings: Record<string, string[]> = {
      user_id: ['user_id', 'requestor_id'],
      requestor_id: ['requestor_id', 'user_id'],
      equipment_type: ['equipment_type'],
      employee_name: ['employee_name'],
      employee_email: ['employee_email'],
      start_date: ['start_date'],
    };
    for (const candidate of mappings[inputName] ?? []) {
      if (validVars.has(candidate)) return candidate;
    }
    return null;
  };

  const emitAction = (action: Action, inputBindings: Record<string, string>, outputBindings: Record<string, string>, condition?: string) => {
    lines.push(`${indent(base)}${action.name}: @actions.${action.name}`);
    for (const input of action.inputs ?? []) {
      const mapped = inputBindings[input.name];
      if (mapped?.startsWith('@variables.')) {
        const varName = mapped.replace('@variables.', '');
        if (validVars.has(varName)) lines.push(`${indent(base + 1)}with ${input.name} = ${mapped}`);
      } else {
        const match = findMatchingVar(input.name);
        if (match) lines.push(`${indent(base + 1)}with ${input.name} = @variables.${match}`);
      }
    }
    for (const output of action.outputs ?? []) {
      const mapped = outputBindings[output.name];
      if (mapped) {
        const varName = mapped.replace('@variables.', '');
        if (validVars.has(varName)) lines.push(`${indent(base + 1)}set @variables.${varName} = @outputs.${output.name}`);
      } else if (validVars.has(output.name)) {
        lines.push(`${indent(base + 1)}set @variables.${output.name} = @outputs.${output.name}`);
      }
    }
    if (condition) lines.push(`${indent(base + 1)}available when ${formatCondition(condition)}`);
    processed.add(action.name);
  };

  for (const phase of workflow ?? []) {
    if (phase.type === 'logic') {
      const cfg = (phase.config ?? {}) as LogicConfig;
      if (cfg.actionToRun && !processed.has(cfg.actionToRun)) {
        const action = actions.find(a => a.name === cfg.actionToRun);
        if (action) emitAction(action, cfg.actionInputs ?? {}, cfg.actionOutputs ?? {}, cfg.condition);
      }
    }
    if (phase.type === 'action') {
      const cfg = (phase.config ?? {}) as ActionConfig;
      if (cfg.actionName && !processed.has(cfg.actionName)) {
        const action = actions.find(a => a.name === cfg.actionName);
        if (action) emitAction(action, cfg.inputs ?? {}, cfg.outputs ?? {});
      }
    }
    if (phase.type === 'confirm') {
      const cfg = (phase.config ?? {}) as ConfirmConfig;
      if (cfg.submitAction && !processed.has(cfg.submitAction)) {
        const action = actions.find(a => a.name === cfg.submitAction);
        if (action) {
          lines.push(`${indent(base)}${action.name}: @actions.${action.name}`);
          for (const input of action.inputs ?? []) {
            const fieldMatch = (cfg.summaryFields ?? []).find(
              f => f.toLowerCase().includes(input.name.toLowerCase()) || input.name.toLowerCase().includes(f.toLowerCase())
            );
            if (fieldMatch && validVars.has(fieldMatch)) {
              lines.push(`${indent(base + 1)}with ${input.name} = @variables.${fieldMatch}`);
            } else {
              const match = findMatchingVar(input.name);
              if (match) lines.push(`${indent(base + 1)}with ${input.name} = @variables.${match}`);
            }
          }
          for (const output of action.outputs ?? []) {
            if (validVars.has(output.name)) {
              lines.push(`${indent(base + 1)}set @variables.${output.name} = @outputs.${output.name}`);
            }
          }
          processed.add(cfg.submitAction);
        }
      }
    }
    if (phase.type === 'permission') {
      const cfg = (phase.config ?? {}) as PermissionConfig;
      if (cfg.checkAction && !processed.has(cfg.checkAction)) {
        const action = actions.find(a => a.name === cfg.checkAction);
        if (action) {
          lines.push(`${indent(base)}${action.name}: @actions.${action.name}`);
          for (const input of action.inputs ?? []) {
            const match = findMatchingVar(input.name);
            if (match) lines.push(`${indent(base + 1)}with ${input.name} = @variables.${match}`);
          }
          if (cfg.roleVariable && validVars.has(cfg.roleVariable)) {
            lines.push(`${indent(base + 1)}set @variables.${cfg.roleVariable} = @outputs.role`);
          }
          processed.add(cfg.checkAction);
        }
      }
    }
  }

  // Emit any actions referenced in the topic but not yet processed
  for (const action of actions) {
    if (!processed.has(action.name)) {
      lines.push(`${indent(base)}${action.name}: @actions.${action.name}`);
      for (const input of action.inputs ?? []) {
        const match = findMatchingVar(input.name);
        if (match) lines.push(`${indent(base + 1)}with ${input.name} = @variables.${match}`);
      }
      for (const output of action.outputs ?? []) {
        if (validVars.has(output.name)) {
          lines.push(`${indent(base + 1)}set @variables.${output.name} = @outputs.${output.name}`);
        }
      }
    }
  }

  return lines;
}

function generatePersonaCalibrationBlock(calibration: PersonaCalibration): string[] {
  const lines: string[] = [];
  const base = 3;
  const hasContent = calibration.brevity || calibration.toneFlex || calibration.humor || calibration.personaReminder;
  if (!hasContent) return lines;

  lines.push(`${indent(base)}|`);
  lines.push(`${indent(base)}| --- Persona Calibration ---`);
  if (calibration.brevity) lines.push(`${indent(base)}| Brevity: ${calibration.brevity}`);
  if (calibration.toneFlex) lines.push(`${indent(base)}| Tone: ${calibration.toneFlex}`);
  if (calibration.humor) lines.push(`${indent(base)}| Humor: ${calibration.humor}`);
  if (calibration.lexicon?.length) lines.push(`${indent(base)}| Lexicon: ${calibration.lexicon.join(', ')}`);
  if (calibration.personaReminder) lines.push(`${indent(base)}| Voice Reminder: ${calibration.personaReminder}`);

  return lines;
}

export function generateAgentScript(formData: AgentFormData): string {
  const lines: string[] = [];

  lines.push('# Agentforce Agent Configuration');
  lines.push('# Generated by Agentforce MCP Plugin for Claude Code');
  lines.push(`# Export Date: ${new Date().toISOString()}`);
  lines.push('# Compatible with Agentforce DX Preview (Simulated & Live modes)');
  lines.push('# Reference: https://developer.salesforce.com/docs/ai/agentforce/guide/agent-script.html');
  lines.push('');

  // CONFIG
  lines.push('config:');
  lines.push(`${indent(1)}agent_name: "${escapeString(formData.config.developer_name)}"`);
  lines.push(`${indent(1)}agent_label: "${escapeString(formData.config.agent_label)}"`);
  lines.push(`${indent(1)}description: "${escapeString(formData.config.description)}"`);
  lines.push('');

  // SYSTEM
  lines.push('system:');
  lines.push(`${indent(1)}messages:`);
  lines.push(`${indent(2)}welcome: "${escapeString(formData.system.messages.welcome)}"`);
  lines.push(`${indent(2)}error: "${escapeString(formData.system.messages.error)}"`);
  if (formData.system.instructions) {
    lines.push(`${indent(1)}instructions: |`);
    for (const line of formData.system.instructions.split('\n')) {
      lines.push(`${indent(2)}${line}`);
    }
  }
  lines.push('');

  // VARIABLES
  if (formData.variables?.length) {
    lines.push('variables:');
    let currentCategory = '';
    for (const v of formData.variables) {
      if (v.category && v.category !== currentCategory) {
        lines.push(`${indent(1)}# ${v.category}`);
        currentCategory = v.category;
      }
      let varLine = `${indent(1)}${v.name}: mutable ${mapType(v.type)}`;
      varLine += ` = ${formatDefaultValue(v.defaultValue ?? '', v.type)}`;
      lines.push(varLine);
      if (v.description) lines.push(`${indent(2)}description: "${escapeString(v.description)}"`);
    }
    lines.push('');
  }

  // LANGUAGE
  if (formData.language?.default_locale) {
    lines.push('language:');
    lines.push(`${indent(1)}default_locale: "${formData.language.default_locale}"`);
    lines.push('');
  }

  // START_AGENT
  const startName = formData.startAgent?.name ?? 'topic_selector';
  lines.push(`start_agent ${startName}:`);
  lines.push(`${indent(1)}description: "${escapeString(formData.startAgent?.description ?? 'Routes conversations to appropriate topics')}"`);
  lines.push(`${indent(1)}reasoning:`);
  lines.push(`${indent(2)}instructions: ->`);
  if (formData.startAgent?.instructions) {
    for (const line of formData.startAgent.instructions.split('\n')) {
      if (line.trim()) lines.push(`${indent(3)}| ${line.trim()}`);
    }
  } else {
    lines.push(`${indent(3)}| Route the user to the appropriate topic based on their request.`);
    lines.push(`${indent(3)}| If unclear, ask clarifying questions.`);
  }
  if (formData.startAgent?.transitions?.length) {
    lines.push(`${indent(2)}actions:`);
    for (const t of formData.startAgent.transitions) {
      lines.push(`${indent(3)}${t.name}: @utils.transition to @topic.${t.targetTopic}`);
      lines.push(`${indent(4)}description: "${escapeString(t.description)}"`);
    }
  }
  lines.push('');

  // TOPICS
  for (const topic of formData.topics ?? []) {
    lines.push(`topic ${topic.name}:`);
    lines.push(`${indent(1)}description: "${escapeString(topic.description)}"`);

    const actionRefs = getActionRefsFromWorkflow(topic.workflow);
    const topicActions = formData.actions.filter(a => actionRefs.includes(a.name));

    if (topicActions.length > 0) {
      lines.push(`${indent(1)}actions:`);
      for (const action of topicActions) {
        lines.push(`${indent(2)}${action.name}:`);
        lines.push(`${indent(3)}description: "${escapeString(action.description)}"`);
        if (action.inputs?.length) {
          lines.push(`${indent(3)}inputs:`);
          for (const input of action.inputs) {
            lines.push(`${indent(4)}${input.name}: ${mapType(input.type)}`);
            if (input.description) lines.push(`${indent(5)}description: "${escapeString(input.description)}"`);
          }
        }
        if (action.outputs?.length) {
          lines.push(`${indent(3)}outputs:`);
          for (const output of action.outputs) {
            lines.push(`${indent(4)}${output.name}: ${mapType(output.type)}`);
            if (output.description) lines.push(`${indent(5)}description: "${escapeString(output.description)}"`);
          }
        }
        lines.push(`${indent(3)}target: "${action.targetType}://${action.targetName}"`);
        if (action.loadingText) lines.push(`${indent(3)}progress_indicator_message: "${escapeString(action.loadingText)}"`);
      }
    }

    lines.push(`${indent(1)}reasoning:`);
    lines.push(`${indent(2)}instructions: ->`);
    lines.push(...generateProceduralInstructions(topic, topicActions, formData));
    if (topic.personaCalibration) lines.push(...generatePersonaCalibrationBlock(topic.personaCalibration));
    if (topicActions.length > 0) {
      lines.push(`${indent(2)}actions:`);
      lines.push(...generateReasoningActionsBlock(topic.workflow, topicActions, formData));
    }
    lines.push('');
  }

  lines.push('');
  return lines.join('\n');
}

export function generateBundleMetadataXml(formData: AgentFormData): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<AiAuthoringBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>${formData.config.developer_name}</fullName>
    <description>${escapeXml(formData.config.description)}</description>
    <label>${escapeXml(formData.config.agent_label)}</label>
    <locale>${formData.language?.default_locale ?? 'en_US'}</locale>
</AiAuthoringBundle>
`;
}

export function generateReadme(formData: AgentFormData): string {
  const name = formData.config.developer_name;
  const label = formData.config.agent_label || 'Agentforce Agent';

  return `# ${label}

Generated by Agentforce MCP Plugin for Claude Code.

## Quick Start

\`\`\`bash
sf project generate --name my-agent-project
cd my-agent-project
sf org login web --alias my-dev-org --set-default

mkdir -p force-app/main/default/aiAuthoringBundles/${name}
cp ${name}.agent force-app/main/default/aiAuthoringBundles/${name}/
cp ${name}.bundle-meta.xml force-app/main/default/aiAuthoringBundles/${name}/
\`\`\`

Open \`${name}.agent\` in VS Code with the Agentforce DX extension and run **AFDX: Preview Agent**.

## Deploy

\`\`\`bash
sf project deploy start --source-dir force-app/main/default/aiAuthoringBundles/${name}
sf agent create --api-name ${name}
\`\`\`

## Required Salesforce Resources

${(formData.actions ?? []).map(a => `- **${a.name}**: \`${a.targetType}://${a.targetName}\``).join('\n')}

## Files

| File | Purpose |
|------|---------|
| \`${name}.agent\` | Agent Script (Agentforce DX) |
| \`${name}.bundle-meta.xml\` | Deployment metadata |
| \`documentation/agent-specification.md\` | Human-readable spec |
| \`metadata/form-data.json\` | Re-importable form data |

---
[Agentforce DX Docs](https://developer.salesforce.com/docs/ai/agentforce/guide/agent-dx.html)
`;
}

export function generateMarkdownSpec(formData: AgentFormData): string {
  return `# ${formData.config.agent_label} — Agent Specification

## Overview

- **Developer Name:** ${formData.config.developer_name}
- **Description:** ${formData.config.description}
- **Locale:** ${formData.language.default_locale}

## System Messages

- **Welcome:** ${formData.system.messages.welcome}
- **Error:** ${formData.system.messages.error}

## Variables

${formData.variables?.length
  ? formData.variables.map(v => `- **${v.name}** (${v.type}): ${v.description || 'No description'}`).join('\n')
  : '_No variables defined_'}

## Actions

${formData.actions?.length
  ? formData.actions.map(a => {
      const inputs = a.inputs.map(i => `${i.name} (${i.type})`).join(', ') || 'None';
      const outputs = a.outputs.map(o => `${o.name} (${o.type})`).join(', ') || 'None';
      return `### ${a.name}\n- **Target:** ${a.targetType}://${a.targetName}\n- **Inputs:** ${inputs}\n- **Outputs:** ${outputs}`;
    }).join('\n\n')
  : '_No actions defined_'}

## Topics

${formData.topics?.length
  ? formData.topics.map(t => `### ${t.displayName || t.name}\n- **Description:** ${t.description}\n- **Workflow Phases:** ${t.workflow?.length ?? 0}`).join('\n\n')
  : '_No topics defined_'}

## Routing

Start agent **${formData.startAgent?.name}** routes to:
${formData.startAgent?.transitions?.length
  ? formData.startAgent.transitions.map(t => `- **${t.name}** → ${t.targetTopic}: ${t.description}`).join('\n')
  : '_No transitions defined_'}
`;
}

export function generateExportManifest(formData: AgentFormData): object {
  return {
    version: '1.0',
    exportDate: new Date().toISOString(),
    generator: 'agentforce-mcp-server',
    agentScriptVersion: 'agentforce-dx-2026',
    agent: {
      developerName: formData.config.developer_name,
      label: formData.config.agent_label,
      description: formData.config.description,
      locale: formData.language?.default_locale ?? 'en_US',
    },
    statistics: {
      variablesCount: (formData.variables ?? []).length,
      actionsCount: (formData.actions ?? []).length,
      topicsCount: (formData.topics ?? []).length,
      workflowPhasesCount: (formData.topics ?? []).reduce((sum, t) => sum + (t.workflow?.length ?? 0), 0),
      transitionsCount: (formData.startAgent?.transitions ?? []).length,
    },
    files: {
      agentScript: `${formData.config.developer_name}.agent`,
      bundleMetadata: `${formData.config.developer_name}.bundle-meta.xml`,
      readme: 'README.md',
      documentation: 'documentation/agent-specification.md',
      formData: 'metadata/form-data.json',
      manifest: 'metadata/export-manifest.json',
    },
  };
}
