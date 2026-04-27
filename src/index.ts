import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { generateAgentScriptTool } from './tools/generateAgentScript.js';
import { validateAgentSpecTool } from './tools/validateAgentSpec.js';
import { exportAgentPackageTool } from './tools/exportAgentPackage.js';
import { simulateAgentConversationTool } from './tools/simulateAgentConversation.js';
import { agentDesignerPrompt } from './prompts/agentDesigner.js';

const tools = [generateAgentScriptTool, validateAgentSpecTool, exportAgentPackageTool, simulateAgentConversationTool];
const prompts = [agentDesignerPrompt];

const server = new Server(
  { name: 'agentforce-mcp-server', version: '1.0.0' },
  { capabilities: { tools: {}, prompts: {} } }
);

// ── Tools ────────────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = tools.find(t => t.name === request.params.name);
  if (!tool) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
      isError: true,
    };
  }
  try {
    const result = tool.handler(request.params.arguments as any);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
  }
});

// ── Prompts ──────────────────────────────────────────────────────────────────

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: prompts.map(p => ({ name: p.name, description: p.description })),
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const prompt = prompts.find(p => p.name === request.params.name);
  if (!prompt) {
    throw new Error(`Unknown prompt: ${request.params.name}`);
  }
  return {
    messages: [
      {
        role: 'user',
        content: { type: 'text', text: prompt.text },
      },
    ],
  };
});

// ── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Agentforce MCP Server running on stdio');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
