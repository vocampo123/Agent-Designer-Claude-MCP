#!/bin/bash
set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_SRC="$REPO_DIR/skills/agent-designer/SKILL.md"
SKILL_DEST="$HOME/.claude/skills/agent-designer/SKILL.md"
SERVER_ENTRY="$REPO_DIR/dist/index.js"

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║       Agentforce Agent Designer — MCP Install                  ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# ── 1. Node.js check ─────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "✗ Node.js not found. Install from https://nodejs.org (v18+) and re-run."
  exit 1
fi
NODE_VERSION=$(node -e "process.stdout.write(process.versions.node)")
echo "✓ Node.js $NODE_VERSION"

# ── 2. Claude Code check ──────────────────────────────────────────────────────
if ! command -v claude &>/dev/null; then
  echo "✗ Claude Code CLI not found. Install from https://claude.ai/code and re-run."
  exit 1
fi
echo "✓ Claude Code CLI found"

# ── 3. Build the MCP server ───────────────────────────────────────────────────
echo ""
echo "→ Installing dependencies..."
cd "$REPO_DIR"
npm install --silent

echo "→ Building MCP server..."
npm run build --silent
echo "✓ MCP server built → dist/index.js"

# ── 4. Install the /agent-designer skill ─────────────────────────────────────
echo ""
echo "→ Installing /agent-designer skill..."
mkdir -p "$HOME/.claude/skills/agent-designer"
cp "$SKILL_SRC" "$SKILL_DEST"
echo "✓ Skill installed → $SKILL_DEST"

# ── 5. Register MCP server with Claude Code ───────────────────────────────────
echo ""
echo "→ Registering MCP server with Claude Code..."
claude mcp add agentforce -- node "$SERVER_ENTRY"
echo "✓ MCP server registered as 'agentforce'"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Installation complete!                                        ║"
echo "║                                                                ║"
echo "║  Start a new Claude Code session and type:                     ║"
echo "║    /agent-designer                                             ║"
echo "║                                                                ║"
echo "║  To verify the MCP server is connected:                       ║"
echo "║    /mcp                                                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
