// Content Formatter for Agentforce Studio Compatibility
// Based on analysis of production-verified agent scripts that successfully
// parse and simulate in Agentforce Studio.
//
// KEY FINDINGS FROM WORKING SCRIPTS:
// 1. Multi-line instructions ARE supported (not single-line only)
// 2. Bold markdown (**text**) IS supported within instruction blocks
// 3. Numbered lists ARE supported
// 4. The `|` character only appears on the FIRST line after `->`
// 5. Continuation lines use INDENTATION ONLY (no `|` prefix)
// 6. System instructions use simple quoted strings (not block scalars)
// 7. Colons are fine when inside bold markers or mid-sentence

const INDENT = '   '; // 3-space indent per Agent Script standard

function ind(level: number): string {
  return INDENT.repeat(level);
}

/**
 * Formats reasoning instructions for Agentforce Studio using the verified format.
 * Returns an array of properly indented lines ready to insert into the script.
 *
 * FORMAT (verified working):
 * ```
 * instructions: ->
 *     | **First line content**
 *       Continuation with indentation
 *       1. Numbered steps
 *          Sub-detail
 *
 *       **Another section:**
 *       More content
 * ```
 *
 * Rules:
 * - First content line: `| ` prefix at indent level 3
 * - Continuation lines: spaces only at indent level 3+1 (no `|`)
 * - Blank lines between sections: just the indent
 * - Bold labels (**text:**) are safe and ENCOURAGED for structure
 */
export function formatReasoningBlock(content: string, baseIndent: number = 3): string[] {
  if (!content || !content.trim()) {
    return [`${ind(baseIndent)}| Help the user complete their request.`];
  }

  const lines: string[] = [];
  const contentLines = content.split('\n');
  let isFirstLine = true;

  for (const line of contentLines) {
    const trimmed = line.trim();

    if (isFirstLine) {
      // First line gets the `| ` prefix
      if (trimmed) {
        lines.push(`${ind(baseIndent)}| ${trimmed}`);
        isFirstLine = false;
      }
    } else if (!trimmed) {
      // Blank line — emit empty line at continuation indent
      lines.push('');
    } else {
      // Continuation lines — indentation only, no `|`
      // Detect indentation level from original line
      const leadingSpaces = line.match(/^(\s*)/)?.[1]?.length ?? 0;
      const extraIndent = Math.floor(leadingSpaces / 2);
      lines.push(`${ind(baseIndent + 1)}${' '.repeat(extraIndent * 2)}${trimmed}`);
    }
  }

  // Ensure we produced at least one line
  if (lines.length === 0) {
    lines.push(`${ind(baseIndent)}| Help the user complete their request.`);
  }

  return lines;
}

/**
 * Generates structured reasoning instructions from workflow phases.
 * Produces multi-line formatted output matching the production-verified format.
 *
 * Output format:
 * ```
 * **Key workflow:**
 * 1. First step
 *    Sub-detail about first step
 * 2. Second step
 *    Sub-detail about second step
 *
 * **Error handling:**
 * If X happens, do Y. Preserve context across errors.
 * ```
 */
export function generateStructuredInstructions(config: {
  goal: string;
  workflow?: string[];
  errorHandling?: string[];
  contextRules?: string[];
}): string {
  const sections: string[] = [];

  // Goal line
  sections.push(`Help the user ${config.goal}.`);
  sections.push('');

  // Workflow section
  if (config.workflow?.length) {
    sections.push('**Key workflow:**');
    for (let i = 0; i < config.workflow.length; i++) {
      sections.push(`${i + 1}. ${config.workflow[i]}`);
    }
    sections.push('');
  }

  // Error handling section
  if (config.errorHandling?.length) {
    sections.push('**Error handling:**');
    sections.push(config.errorHandling.join(' '));
    sections.push('');
  }

  // Context preservation
  if (config.contextRules?.length) {
    if (!config.errorHandling?.length) {
      sections.push('**Error handling:**');
    }
    sections.push(`Context preservation: Remember ${config.contextRules.join(', ')} across errors.`);
  }

  return sections.join('\n');
}

/**
 * Generates start_agent routing instructions in the verified format.
 * These use bold topic labels and keyword/example patterns.
 */
export function generateRoutingInstructions(topics: Array<{
  name: string;
  label?: string;
  keywords?: string[];
  description?: string;
}>): string {
  if (!topics.length) {
    return 'Route the user to the appropriate topic based on their request. If unclear, ask clarifying questions.';
  }

  const sections: string[] = [];
  sections.push('**Topic Selection Priority**');
  sections.push('');

  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    const label = topic.label || topic.name.replace(/_/g, ' ');
    sections.push(`  ${i + 1}. **${label}**`);
    if (topic.keywords?.length) {
      sections.push(`     Keywords: ${topic.keywords.map(k => `"${k}"`).join(', ')}`);
    }
    if (topic.description) {
      sections.push(`     Use when: ${topic.description}`);
    }
    sections.push('');
  }

  sections.push('  **Routing Note:** If the user\'s intent is ambiguous, ask a clarifying question before routing.');

  return sections.join('\n');
}

/**
 * Condenses system instructions to a simple quoted string.
 * System instructions MUST be simple strings (not block scalars).
 * This is the ONE place where condensing is appropriate.
 */
export function condenseSystemInstructions(instructions: string): string {
  if (!instructions || !instructions.trim()) {
    return '';
  }

  let content = instructions;

  // Remove markdown formatting for system instructions only
  content = content.replace(/\*\*([^*]+)\*\*/g, '$1');
  content = content.replace(/\*([^*]+)\*/g, '$1');
  content = content.replace(/__([^_]+)__/g, '$1');

  // Remove headers
  content = content.replace(/^#{1,6}\s+/gm, '');

  // Remove bullet points
  content = content.replace(/^\s*[-*+]\s+/gm, '');

  // Collapse newlines to spaces
  content = content.replace(/\n+/g, ' ');

  // Remove excessive whitespace
  content = content.replace(/\s+/g, ' ');

  return content.trim();
}

// Keep these for backward compat but they now just pass through
export function condenseReasoningInstructions(instructions: string): string {
  // NO LONGER CONDENSES - reasoning instructions support full multi-line content
  // This function is kept for backward compat but now returns content as-is
  return instructions?.trim() || '';
}

export function generateCompactWorkflow(steps: string[]): string {
  if (!steps.length) return '';
  return steps.map((step, i) => `${i + 1}. ${step.trim()}`).join('\n');
}

export function formatErrorHandling(errorPatterns: string[]): string {
  if (!errorPatterns.length) return '';
  return errorPatterns.map(p => p.trim()).join(' ');
}

export function formatContextRules(rules: string[]): string {
  if (!rules.length) return '';
  return `Context preservation: Remember ${rules.join(', ')} across errors.`;
}

export function generateProductionInstructions(config: {
  workflow?: string[];
  errorHandling?: string[];
  contextRules?: string[];
  rawInstructions?: string;
}): string {
  if (config.rawInstructions) {
    return config.rawInstructions.trim();
  }

  return generateStructuredInstructions({
    goal: 'complete their request',
    workflow: config.workflow,
    errorHandling: config.errorHandling,
    contextRules: config.contextRules,
  });
}
