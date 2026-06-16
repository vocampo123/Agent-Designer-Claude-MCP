// Agentforce Agent Types
// Ported from the Cursor extension's shared/types.ts
// Single source of truth for the MCP server data model.

// ============================================
// Step 1: Agent Identity Blocks
// ============================================

export interface ConfigBlock {
  developer_name: string;
  agent_label: string;
  description: string;
  agent_type?: string;               // e.g., "AgentforceEmployeeAgent", "ServiceAgent"
}

export interface SystemBlock {
  instructions: string;
  messages: {
    welcome: string;
    error: string;
  };
}

// ============================================
// Persona Framework (Identity + 12 Dimensions)
// ============================================

export type PersonaRegister = 'Subordinate' | 'Peer' | 'Advisor' | 'Coach';
export type PersonaFormality = 'Formal' | 'Professional' | 'Casual' | 'Informal';
export type PersonaWarmth = 'Cool' | 'Neutral' | 'Warm' | 'Bright' | 'Radiant';
export type PersonaIntensity = 'Reserved' | 'Moderate' | 'Distinctive' | 'Bold';
export type PersonaEmotionalColoring = 'Blunt' | 'Clinical' | 'Neutral' | 'Encouraging' | 'Enthusiastic';
export type PersonaEmpathyLevel = 'Minimal' | 'Understated' | 'Moderate' | 'Attuned';
export type PersonaBrevity = 'Terse' | 'Concise' | 'Moderate' | 'Expansive';
export type PersonaHumor = 'None' | 'Dry' | 'Warm' | 'Playful';
export type PersonaEmoji = 'None' | 'Functional' | 'Expressive';
export type PersonaFormatting = 'Plain' | 'Selective' | 'Heavy';
export type PersonaPunctuation = 'Conservative' | 'Standard' | 'Expressive';
export type PersonaCapitalization = 'Standard' | 'Casual';

export interface IdentityTrait {
  trait: string;
  definition: string;
}

export interface PersonaDimensions {
  register: PersonaRegister;
  formality: PersonaFormality;
  warmth: PersonaWarmth;
  personalityIntensity: PersonaIntensity;
  emotionalColoring: PersonaEmotionalColoring;
  empathyLevel: PersonaEmpathyLevel;
  brevity: PersonaBrevity;
  humor: PersonaHumor;
  emoji: PersonaEmoji;
  formatting: PersonaFormatting;
  punctuation: PersonaPunctuation;
  capitalization: PersonaCapitalization;
}

export interface LexiconEntry {
  term: string;
  definition: string;
}

export interface Persona {
  identity: IdentityTrait[];
  dimensions: PersonaDimensions;
  phraseBook: Record<string, string>;
  neverSay: string[];
  negativeIdentity: string[];
  values: string[];
  lexicon: LexiconEntry[];
}

export interface PersonaCalibration {
  brevity: string;
  toneFlex: string;
  humor: string;
  lexicon: string[];
  phraseBook: Record<string, string>;
  personaReminder: string;
}

export interface LanguageBlock {
  default_locale: string;
  additional_locales?: string;       // Comma-separated list of additional locales
}

export interface KnowledgeBlock {
  citations_enabled?: boolean;
  search_scope?: string[];           // Which knowledge bases to search
}

// ============================================
// Step 2: Variables
// ============================================

export type VariableType = 'string' | 'number' | 'boolean' | 'date' | 'id';

export interface Variable {
  id: string;
  name: string;
  type: VariableType;
  mutable: boolean;
  defaultValue: string;
  description: string;
  category: string;
  visibility?: 'External' | 'Internal';  // Whether visible outside agent
  linked?: boolean;                      // Is this a linked variable?
  source?: string;                       // Source path for linked vars (e.g., @MessagingSession.Id)
}

// ============================================
// Step 3: Actions
// ============================================

export type TargetType = 'flow' | 'apex' | 'prompt';

export interface Parameter {
  name: string;
  type: VariableType;
  required?: boolean;
  description?: string;
  label?: string;                    // Display label in Builder UI
  isUserInput?: boolean;             // True if user provides, false if system-derived
  isDisplayable?: boolean;           // Show in UI summaries
  filterFromAgent?: boolean;         // Hide from agent's view
  complexDataTypeName?: string;      // e.g., "lightning__recordIdType", "lightning__dateType"
}

export interface Action {
  id: string;
  name: string;
  description: string;
  targetType: TargetType;
  targetName: string;
  inputs: Parameter[];
  outputs: Parameter[];
  label?: string;                    // Display name in Builder UI (e.g., "Create Record")
  source?: string;                   // Source identifier (e.g., "MyAgent__CreateRecord")
  requireUserConfirmation?: boolean;
  includeProgressIndicator?: boolean;
  progressIndicatorMessage?: string; // Replaces loadingText for consistency
  loadingText?: string;              // @deprecated - use progressIndicatorMessage instead
}

// ============================================
// Step 4: Topics & Routing
// ============================================

export interface Topic {
  id: string;
  name: string;
  displayName: string;
  description: string;
  workflow: WorkflowPhase[];
  actionRefs: string[];
  personaCalibration?: PersonaCalibration;
  label?: string;                    // Display label in Builder UI (uses displayName if not set)
}

export interface StartAgent {
  name: string;
  description: string;
  instructions: string;
  transitions: Transition[];
  label?: string;                    // Display label in Builder UI
}

export interface Transition {
  id: string;
  name: string;
  targetTopic: string;
  description: string;
  availableWhen?: Condition[];
}

export type ConditionOperator = '==' | '!=' | '>' | '<' | '>=' | '<=' | 'is None' | 'is not None';
export type ConditionConnector = 'and' | 'or';

export interface Condition {
  variable: string;
  operator: ConditionOperator;
  value?: string | number | boolean;
  connector?: ConditionConnector;
}

// ============================================
// Step 5: Workflow Phases
// ============================================

export type WorkflowPhaseType = 'permission' | 'collect' | 'logic' | 'action' | 'confirm';

export interface WorkflowPhase {
  id: string;
  type: WorkflowPhaseType;
  order: number;
  config: PermissionConfig | CollectConfig | LogicConfig | ActionConfig | ConfirmConfig;
}

export interface PermissionConfig {
  checkAction: string;
  roleVariable: string;
  blockedRoles: string[];
  blockMessage: string;
}

export interface CollectConfig {
  variableName: string;
  prompt: string;
  validation: string;
  retryPrompt: string;
}

export interface LogicConfig {
  condition: string;
  actionToRun: string;
  actionInputs: Record<string, string>;
  actionOutputs: Record<string, string>;
  message: string;
}

export interface ActionConfig {
  actionName: string;
  inputs: Record<string, string>;
  outputs: Record<string, string>;
}

export interface ConfirmConfig {
  summaryFields: string[];
  confirmPrompt: string;
  submitAction: string;
  successMessage: string;
}

// ============================================
// Core Agent Form Data Structure
// ============================================

export interface AgentFormData {
  config: ConfigBlock;
  system: SystemBlock;
  language: LanguageBlock;
  persona: Persona;
  variables: Variable[];
  actions: Action[];
  topics: Topic[];
  startAgent: StartAgent;
  knowledge?: KnowledgeBlock;
  currentStep?: number;
  currentTopicIndex?: number;
}

// ============================================
// Simulation Runtime
// ============================================

export interface RuntimeState {
  currentTopic: string | null;
  currentPhaseIndex: number;
  variables: Record<string, any>;
  phase: 'routing' | 'in_topic' | 'awaiting_confirmation' | 'topic_complete';
  waitingForVariable?: string;
  conversationComplete: boolean;
}

export interface ActionExecutionLog {
  id: string;
  timestamp: Date;
  actionName: string;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  status: 'success' | 'error' | 'pending';
  duration: number;
}

// ============================================
// Validation
// ============================================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================
// Reserved Keywords
// ============================================

export const RESERVED_KEYWORDS = [
  'system', 'config', 'variables', 'language', 'start_agent', 'topic', 'actions',
  'reasoning', 'instructions', 'messages', 'transitions', 'description', 'label',
  'source', 'visibility', 'inputs', 'outputs', 'target', 'available', 'when',
  'if', 'else', 'return', 'run', 'set', 'with', 'None', 'True', 'False',
] as const;

export const RESERVED_PREFIXES = ['@', '!'] as const;

export function isReservedKeyword(name: string): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  if (RESERVED_KEYWORDS.some(kw => kw.toLowerCase() === lower)) return true;
  if (RESERVED_PREFIXES.some(p => name.startsWith(p))) return true;
  return false;
}

export function getReservedKeywordError(name: string): string | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  const matched = RESERVED_KEYWORDS.find(kw => kw.toLowerCase() === lower);
  if (matched) return `"${name}" is a reserved keyword in Agent Script`;
  const prefix = RESERVED_PREFIXES.find(p => name.startsWith(p));
  if (prefix) return `Variable names cannot start with "${prefix}"`;
  return null;
}
