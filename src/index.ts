import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { generateAgentScriptTool } from './tools/generateAgentScript.js';
import { validateAgentSpecTool } from './tools/validateAgentSpec.js';
import { exportAgentPackageTool } from './tools/exportAgentPackage.js';
import { simulateAgentConversationTool } from './tools/simulateAgentConversation.js';

const tools = [generateAgentScriptTool, validateAgentSpecTool, exportAgentPackageTool, simulateAgentConversationTool];

const server = new Server(
  { name: 'agentforce-mcp-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
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
