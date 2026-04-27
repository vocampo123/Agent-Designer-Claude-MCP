import { generateAgentScript } from '../lib/agentScriptGenerator.js';
import type { AgentFormData } from '../types/agent.js';

export const generateAgentScriptTool = {
  name: 'generate_agent_script',
  description:
    'Generate an Agentforce Agent Script (.agent file) from a structured agent definition. ' +
    'Returns the complete Agent Script DSL string ready to save as a .agent file and import into Agentforce DX.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      formData: {
        type: 'object',
        description: 'The complete agent definition (AgentFormData). Must include config, system, language, persona, variables, actions, topics, and startAgent.',
      },
    },
    required: ['formData'],
  },
  handler(args: { formData: AgentFormData }): string {
    return generateAgentScript(args.formData);
  },
};
