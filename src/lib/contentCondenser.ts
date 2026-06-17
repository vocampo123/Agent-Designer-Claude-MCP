// Content Condenser for Agentforce Studio YAML Compatibility
// Agentforce Studio's YAML parser requires condensed, minimally-formatted content
// in reasoning instruction blocks. This module strips heavy markdown and condenses
// multi-paragraph content into compact workflow descriptions.

/**
 * Condenses instruction content for reasoning blocks
 * Removes heavy markdown formatting, blank lines, and excessive whitespace
 * Converts multi-paragraph content into compact workflow descriptions
 */
export function condenseReasoningInstructions(instructions: string): string {
  if (!instructions || !instructions.trim()) {
    return '';
  }

  let content = instructions;

  // Remove markdown headers (## Header, ### Header)
  content = content.replace(/^#{1,6}\s+/gm, '');

  // Remove bold/italic markdown (**text**, *text*, __text__)
  content = content.replace(/\*\*([^*]+)\*\*/g, '$1');
  content = content.replace(/\*([^*]+)\*/g, '$1');
  content = content.replace(/__([^_]+)__/g, '$1');
  content = content.replace(/_([^_]+)_/g, '$1');

  // Remove bullet points and convert to inline format
  // "- Item 1\n- Item 2" → "Item 1. Item 2."
  content = content.replace(/^\s*[-*+]\s+/gm, '');

  // Remove numbered list markers
  // "1. Step\n2. Step" → "Step. Step."
  content = content.replace(/^\s*\d+\.\s+/gm, '');

  // Remove blank lines (multiple newlines)
  content = content.replace(/\n\s*\n/g, '\n');

  // Convert newlines to spaces (collapse to single line)
  content = content.replace(/\n/g, ' ');

  // Remove excessive whitespace
  content = content.replace(/\s+/g, ' ');

  // Remove code blocks/backticks
  content = content.replace(/`([^`]+)`/g, '$1');

  // Trim
  content = content.trim();

  // If still too long, truncate with intelligence
  if (content.length > 500) {
    // Try to break at sentence boundary
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [];
    let condensed = '';
    for (const sentence of sentences) {
      if ((condensed + sentence).length > 500) break;
      condensed += sentence;
    }
    content = condensed || content.substring(0, 500);
  }

  return content;
}

/**
 * Converts verbose instructions into compact workflow format
 * "Do step 1. Then step 2. Finally step 3." → "1. Step 1. 2. Step 2. 3. Step 3."
 * NOTE: Avoid using "Workflow:" prefix as colons can confuse YAML parser
 */
export function formatAsWorkflow(instructions: string): string {
  const condensed = condenseReasoningInstructions(instructions);

  // Remove any existing "Workflow:" prefix (colons cause YAML parsing issues)
  let content = condensed.replace(/^workflow:\s*/i, '');

  // Try to detect numbered steps and reformat
  const stepMatches = content.match(/(\d+)[.)]?\s+([^.]+)/g);
  if (stepMatches && stepMatches.length >= 2) {
    const steps = stepMatches.map(step => step.trim()).join(' ');
    return steps;
  }

  return content;
}

/**
 * Condenses system instructions to a single simple string
 * System instructions should be brief and unformatted
 */
export function condenseSystemInstructions(instructions: string): string {
  if (!instructions || !instructions.trim()) {
    return '';
  }

  let content = instructions;

  // Apply same condensing as reasoning instructions
  content = condenseReasoningInstructions(content);

  // System instructions should be even more concise - max 200 chars
  if (content.length > 200) {
    const firstSentence = content.match(/^[^.!?]+[.!?]/)?.[0] || content.substring(0, 200);
    content = firstSentence.trim();
  }

  return content;
}

/**
 * Generates compact workflow description from structured phases
 * Used for generating reasoning instructions from workflow phases
 * NOTE: Avoid "Workflow:" prefix - colons confuse YAML parser
 */
export function generateCompactWorkflow(steps: string[]): string {
  if (!steps.length) return '';

  // Format as numbered workflow (no "Workflow:" prefix to avoid YAML colon issues)
  const numberedSteps = steps
    .map((step, i) => `${i + 1}. ${step.trim()}`)
    .join(' ');

  return numberedSteps;
}

/**
 * Formats error handling guidance in compact form
 * NOTE: Avoid "Error handling:" prefix - colons confuse YAML parser
 */
export function formatErrorHandling(errorPatterns: string[]): string {
  if (!errorPatterns.length) return '';

  const condensed = errorPatterns
    .map(pattern => pattern.trim())
    .join('. ');

  // Use "If X happens" format instead of "Error handling:" to avoid YAML colon issues
  return `If errors occur: ${condensed}`;
}

/**
 * Formats context preservation rules in compact form
 * NOTE: Avoid colons in prefixes - they confuse YAML parser
 */
export function formatContextRules(rules: string[]): string {
  if (!rules.length) return '';

  const condensed = rules
    .map(rule => rule.trim())
    .join(', ');

  // Use "Remember" instead of "Context preservation:" to avoid YAML colon issues
  return `Remember ${condensed} across turns`;
}

/**
 * Main function: generates production-ready reasoning instructions
 * Combines workflow, error handling, and context rules into compact format
 * NOTE: Avoids colons in output to prevent YAML parsing issues
 */
export function generateProductionInstructions(config: {
  workflow?: string[];
  errorHandling?: string[];
  contextRules?: string[];
  rawInstructions?: string;
}): string {
  const parts: string[] = [];

  // If raw instructions provided, condense and use (strip any colons that might cause issues)
  if (config.rawInstructions) {
    let condensed = condenseReasoningInstructions(config.rawInstructions);
    // Remove common colon-prefixed labels that confuse YAML parser
    condensed = condensed.replace(/\b(workflow|error handling|context preservation|next steps):\s*/gi, '');
    return condensed;
  }

  // Build from structured components
  if (config.workflow?.length) {
    parts.push(generateCompactWorkflow(config.workflow));
  }

  if (config.errorHandling?.length) {
    parts.push(formatErrorHandling(config.errorHandling));
  }

  if (config.contextRules?.length) {
    parts.push(formatContextRules(config.contextRules));
  }

  return parts.join('. ');
}
