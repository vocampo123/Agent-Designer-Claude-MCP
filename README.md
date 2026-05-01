# Agentforce Agent Designer — Claude Code MCP

A Model Context Protocol (MCP) server for Claude Code that guides you through designing Salesforce Agentforce agents via a structured 7-phase conversation. Produces deployment-ready Agent Script (`.agent`) files and full DX project packages.

## Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **Claude Code CLI** — [claude.ai/code](https://claude.ai/code)

Verify both are installed:

```bash
node --version   # should be v18 or higher
claude --version
```

## Quick Install

```bash
git clone https://github.com/vocampo123/Agent-Designer-Claude-MCP.git
cd Agent-Designer-Claude-MCP
chmod +x install.sh
./install.sh
```

The install script:
1. Checks Node.js and Claude Code CLI
2. Installs npm dependencies and builds the MCP server
3. Installs the `/agent-designer` skill to `~/.claude/skills/`
4. Registers the MCP server with Claude Code via `claude mcp add`

## Manual Install

If you prefer to install step by step:

```bash
# 1. Clone and build
git clone https://github.com/vocampo123/Agent-Designer-Claude-MCP.git
cd Agent-Designer-Claude-MCP
npm install
npm run build

# 2. Install the skill
mkdir -p ~/.claude/skills/agent-designer
cp skills/agent-designer/SKILL.md ~/.claude/skills/agent-designer/SKILL.md

# 3. Register the MCP server (replace <path> with your actual clone path)
claude mcp add agentforce -- node "<path>/Agent-Designer-Claude-MCP/dist/index.js"
```

## Usage

**Launch Claude Code from this repo directory.** The MCP server is registered at project scope, so the agent designer is only available when Claude Code is started from here:

```bash
cd path/to/Agent-Designer-Claude-MCP
claude
```

Then inside Claude Code, type:

```
/agent-designer
```

> If you launch Claude Code from a different directory, `/agent-designer` will report the MCP server as missing and prompt you to restart from the repo.

Claude will display the Agent Designer banner and walk you through 7 phases:

| Phase | What happens |
|-------|-------------|
| 1 — Identity | Name, developer name, description |
| 2 — Persona | 12-dimension personality system, static messages |
| 3 — Variables | Conversation-scoped variables |
| 4 — Actions | Salesforce Flows, Apex, Prompt Templates |
| 5 — Topics & Routing | Topic definitions and the start_agent router |
| 6 — Workflows + Calibration | Step-by-step workflow logic per topic |
| 7 — Review & Export | Validation, Agent Script generation, simulation |

At the end you receive a `.agent` file ready for:
- Import into Agentforce Builder
- Drop into a SFDX project at `force-app/main/default/aiAuthoringBundles/<developer_name>/`

## Verify the MCP server is connected

Inside a Claude Code session:

```
/mcp
```

You should see `agentforce` listed with its 4 tools:
- `generate_agent_script`
- `validate_agent_specification`
- `export_agent_package`
- `simulate_agent_conversation`

## Project Structure

```
.
├── install.sh                  # One-command installer
├── skills/
│   └── agent-designer/
│       └── SKILL.md            # /agent-designer slash command
├── src/
│   ├── index.ts                # MCP server entry point
│   ├── types/
│   │   └── agent.ts            # AgentFormData and all related types
│   ├── lib/
│   │   ├── agentScriptGenerator.ts   # Agent Script DSL generator
│   │   ├── AgentRuntime.ts           # Stateless simulation engine
│   │   ├── WorkflowExecutor.ts       # Per-topic workflow runner
│   │   ├── TopicRouter.ts            # Intent classification
│   │   ├── MockActionEngine.ts       # Simulated Salesforce action responses
│   │   └── interpolation.ts          # Variable interpolation in messages
│   ├── tools/
│   │   ├── generateAgentScript.ts
│   │   ├── validateAgentSpec.ts
│   │   ├── exportAgentPackage.ts
│   │   └── simulateAgentConversation.ts
│   └── prompts/
│       └── agentDesigner.ts    # 7-phase conversation guide (MCP prompt)
├── dist/                       # Compiled output (created by npm run build)
├── CLAUDE.md                   # Developer notes and Phase 3 roadmap
├── package.json
└── tsconfig.json
```

## Uninstall

```bash
# Remove the MCP server registration
claude mcp remove agentforce

# Remove the skill
rm -rf ~/.claude/skills/agent-designer
```
