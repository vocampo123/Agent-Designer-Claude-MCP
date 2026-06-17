# Agentforce Studio YAML Compatibility Fix

## Problem

Generated agent scripts failed to parse in Agentforce Studio with errors:
- ❌ "Expected procedure (->) or template (|) syntax"
- ❌ "Expected a string or a template, got identifier"

Root cause: Generator produced **beautifully formatted, heavily-markdown instructions** that Agentforce Studio's YAML parser could not handle.

---

## Solution

### 1. **System Instructions → Simple Quoted Strings**

**Before (FAILED):**
```yaml
system:
    instructions: |
        You are a digital intake assistant...
        
        **Core Attributes:**
        - Empathetic
        - Detail-Oriented
```

**After (WORKS):**
```yaml
system:
    instructions: "You are a digital intake assistant that helps case managers..."
```

**Change:** System instructions now use simple quoted strings (not block scalars)

---

### 2. **Reasoning Instructions → Condensed Content**

**Before (FAILED):**
```yaml
reasoning:
    instructions: ->
        | **PERSONA: Professional Coordinator**
        
          You are a digital intake assistant...
          
          **Core Attributes:**
          - **Empathetic**: ...
          - **Detail-Oriented**: ...
```

**After (WORKS):**
```yaml
reasoning:
    instructions: ->
        | Workflow: 1. Identify participant. 2. Collect notes. 3. Format notes. Error handling: If no results, offer alternatives. Context preservation: Remember participant ID across errors.
```

**Change:** 
- Keep `instructions: ->` + `|` syntax (required)
- Condense content to 2-5 compact sentences
- Remove heavy markdown (bold, bullets, headers)
- Remove blank lines and excessive whitespace
- Format as "Workflow: ... Error handling: ... Context preservation: ..."

---

### 3. **Content Condenser Module**

New module: `src/lib/contentCondenser.ts`

Functions:
- `condenseSystemInstructions()` — Strips formatting, limits to 200 chars
- `condenseReasoningInstructions()` — Removes markdown, collapses to single line
- `generateProductionInstructions()` — Builds compact "Workflow: ... Error handling: ..." format

**What it removes:**
- ❌ Markdown headers (`## Header`)
- ❌ Bold/italic (`**text**`, `*text*`)
- ❌ Bullet points (`- Item`)
- ❌ Numbered lists (converts to inline)
- ❌ Blank lines (multiple newlines)
- ❌ Code blocks (backticks)
- ❌ Excessive whitespace

**Example:**

Input:
```
## Workflow

**Step 1:** Identify the participant
- Search by name
- Verify identity

**Step 2:** Collect notes

Error Handling:
- If not found, offer alternatives
```

Output:
```
Workflow: 1. Identify the participant. Search by name. Verify identity. 2. Collect notes. Error handling: If not found, offer alternatives.
```

---

### 4. **Generator Updates**

**System Block:**
```typescript
// OLD (block scalar - FAILED)
if (formData.system?.instructions) {
  lines.push(`${indent(1)}instructions: |`);
  lines.push(`${indent(2)}${formData.system.instructions}`);
}

// NEW (simple string - WORKS)
if (formData.system?.instructions) {
  const condensed = condenseSystemInstructions(formData.system.instructions);
  lines.push(`${indent(1)}instructions: "${escapeString(condensed)}"`);
}
```

**Start Agent Reasoning:**
```typescript
// OLD (multi-line formatted - FAILED)
if (formData.startAgent?.instructions) {
  for (const line of instructions.split('\n')) {
    lines.push(`${indent(3)}| ${line}`);
  }
}

// NEW (condensed single-line - WORKS)
if (formData.startAgent?.instructions) {
  const condensed = condenseReasoningInstructions(formData.startAgent.instructions);
  lines.push(`${indent(3)}| ${condensed}`);
}
```

**Topic/Subagent Reasoning:**
```typescript
// OLD (multi-line with formatting - FAILED)
function generateProceduralInstructions(): string[] {
  lines.push(`| Help the user...`);
  lines.push(`|`);
  lines.push(`| **Step 1:** Do this`);
  // ... multi-line output
  return lines;
}

// NEW (condensed single-line - WORKS)
function generateProceduralInstructions(): string {
  const workflowSteps = [
    'Help the user...',
    '1. Step one',
    '2. Step two',
    // ...
  ];
  return condenseReasoningInstructions(workflowSteps.join('. '));
}
```

---

## What Still Works

✅ **Linked variables** — Show warnings in preview (expected), work in production
✅ **Messages** — Simple quoted strings (already worked)
✅ **Action metadata** — All enhanced metadata fields still emit correctly
✅ **Complex data types** — `lightning__recordIdType` etc. still work
✅ **Multi-line action descriptions** — Action descriptions can still be detailed

---

## Testing Checklist

After this fix, generated scripts should:

- [x] Parse successfully in Agentforce Studio (no syntax errors)
- [x] System instructions use simple quoted strings
- [x] Reasoning instructions use `instructions: ->` + `|` format
- [x] Reasoning instructions are condensed (not heavily formatted)
- [x] Linked variables present (warnings expected in preview mode)
- [x] Agent loads in preview mode without errors

---

## Example: Before vs After

### Before (Failed to Parse)

```yaml
system:
    instructions: |
        You are a professional intake coordinator...
        
        **Responsibilities:**
        - Create participant notes
        - Document interactions
        
        **Style:**
        - Professional
        - Empathetic

start_agent topic_selector:
    reasoning:
        instructions: ->
            | **Routing Logic:**
            
              When the user mentions "notes" or "documentation":
              - Route to ParticipantNotes topic
              
              When the user mentions "referral":
              - Route to ReferralManagement topic

subagent ParticipantNotes:
    reasoning:
        instructions: ->
            | **Workflow:**
            
              1. **Identify Participant**
                 - Search by name
                 - If multiple matches, ask user to clarify
                 
              2. **Collect Notes**
                 - Ask for meeting summary
                 - Ask for date/time
                 
              3. **Format & Confirm**
```

### After (Parses Successfully)

```yaml
system:
    instructions: "You are a professional intake coordinator that creates participant notes and documents interactions."

start_agent topic_selector:
    reasoning:
        instructions: ->
            | When user mentions notes or documentation, route to ParticipantNotes. When user mentions referral, route to ReferralManagement. If unclear, ask clarifying question.

subagent ParticipantNotes:
    reasoning:
        instructions: ->
            | Workflow: 1. Identify participant by name. If multiple matches, ask user to clarify. 2. Collect meeting summary and date/time. 3. Format notes and confirm with user. Error handling: If no participant found, offer to create new. Context preservation: Remember participant ID across errors.
```

---

## Files Modified

1. **`src/lib/contentCondenser.ts`** — NEW: Content condensing utilities
2. **`src/lib/agentScriptGenerator.ts`** — Updated to use condensed content

---

## Impact

**Before:** Agents failed to load in Agentforce Studio (syntax errors)  
**After:** Agents parse successfully and load in preview mode ✅

**Backward Compatibility:** Input format unchanged — generator handles condensing automatically

---

## Key Takeaway

Agentforce Studio's YAML parser requires:
1. **Simple quoted strings** for system instructions and messages
2. **Condensed content** in reasoning instruction blocks (keep `-> |` syntax, minimize formatting)
3. **No heavy markdown** (bold, bullets, headers, blank lines)

Think **"compact workflow description"** not **"detailed documentation"** for reasoning instructions.

---

Generated: 2026-06-17
