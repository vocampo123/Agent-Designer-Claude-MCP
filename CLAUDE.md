# Agentforce MCP Server — Claude Code Plugin

MCP server that lets Claude conduct full Agentforce agent design sessions: discovery → generation → validation → simulation → export.

## What's been built

### Phase 1 — Core generation (complete)
- `generate_agent_script` — transforms AgentFormData → Agent Script DSL (`.agent` file)
- `validate_agent_specification` — returns blocking errors + warnings before export
- `export_agent_package` — returns all deployment files as strings (agent script, bundle XML, README, markdown spec, form JSON, manifest)

### Phase 2 — Simulation engine (complete)
- `simulate_agent_conversation` — stateless turn-by-turn agent simulation; pass `formData` + `userMessage` + `state` (omit on first turn), returns `agentMessage` + `updatedState`
- Smart mock action engine handles common patterns: inventory checks, permission checks, date calculations, submit actions
- Supports `mockOverrides` to pin specific action responses for edge case testing

## Phase 3 — Salesforce DX integration (deferred)

**Rationale for deferring:** Users can take the `.agent` output from `export_agent_package` and import it directly into Agentforce Builder. Phase 3 is the last-mile deploy shortcut for engineers who want to stay in Claude.

**Tools to build:**

| Tool | SF CLI Command | Notes |
|---|---|---|
| `list_sf_orgs` | `sf org list --json` | Returns authenticated orgs for user to select |
| `deploy_to_dx` | `sf project deploy start` | Writes bundle to DX project, triggers deploy |
| `run_agent_preview` | `sf agent preview` | Interactive preview via CLI |
| `run_agent_tests` | `sf agent test run --wait 10` | Returns structured test results |

**Prerequisites for the user:**
- Salesforce CLI (`sf`) installed and authenticated
- An active Salesforce DX project (`sf project generate`)
- Target org connected (`sf org login web`)

**Implementation notes:**
- Use Node `child_process.execFile` (not `exec`) to invoke `sf` commands — avoids shell injection
- Pass `--json` flag on all commands for structured output
- DX project auto-management path: `~/.agentforce-dx/agentforce-preview/`
- Bundle path within DX project: `force-app/main/default/aiAuthoringBundles/{agentName}/`

## Project structure

```
src/
├── index.ts                          # MCP server entry point
├── types/
│   └── agent.ts                      # AgentFormData + all shared types
├── lib/
│   ├── agentScriptGenerator.ts       # DSL generation + export helpers
│   ├── AgentRuntime.ts               # Pure-function simulation orchestrator
│   ├── WorkflowExecutor.ts           # Phase execution state machine
│   ├── TopicRouter.ts                # Keyword-based topic matching
│   ├── MockActionEngine.ts           # Smart mock action responses
│   └── interpolation.ts             # Variable substitution
└── tools/
    ├── generateAgentScript.ts        # Tool wrapper
    ├── validateAgentSpec.ts          # Tool wrapper
    ├── exportAgentPackage.ts         # Tool wrapper
    └── simulateAgentConversation.ts  # Tool wrapper
```

## Running the server

```bash
npm install
npm run build
node dist/index.js
```

## Connecting to Claude Code

Add to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agentforce": {
      "command": "node",
      "args": ["/Users/vocampo/Cursor Repos/Claude Agent Framework plug in/dist/index.js"]
    }
  }
}
```

## Companion project

The Cursor/VS Code extension lives at:
`/Users/vocampo/Cursor Repos/Applications/Cursor AI Plugin`

That extension targets designers and PMs (visual form wizard, SLDS demo mode).
This MCP plugin targets engineers (conversational, CLI-native, headless-friendly).
They are complementary — not replacements for each other.
