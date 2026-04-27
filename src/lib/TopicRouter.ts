import type { Topic, StartAgent, RuntimeState, Transition } from '../types/agent.js';

export interface TopicMatch {
  topic: Topic;
  confidence: number;
  matchedKeywords: string[];
  transition: Transition | null;
}

export class TopicRouter {
  route(userInput: string, topics: Topic[], startAgent: StartAgent | undefined, state: RuntimeState): TopicMatch | null {
    if (!topics?.length) return null;

    const normalized = userInput.toLowerCase();
    const words = this.tokenize(normalized);
    const matches: TopicMatch[] = [];

    for (const topic of topics) {
      const transition = this.findTransition(topic, startAgent);
      if (!this.isTransitionAvailable(transition, state)) continue;

      const { score, keywords } = this.calculateMatchScore(words, normalized, topic);
      if (score > 0) matches.push({ topic, confidence: score, matchedKeywords: keywords, transition });
    }

    matches.sort((a, b) => b.confidence - a.confidence);
    if (matches.length > 0 && matches[0].confidence >= 0.2) return matches[0];

    if (topics.length === 1) {
      return { topic: topics[0], confidence: 0.5, matchedKeywords: [], transition: this.findTransition(topics[0], startAgent) };
    }

    return null;
  }

  private tokenize(text: string): string[] {
    return text.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
  }

  private findTransition(topic: Topic, startAgent: StartAgent | undefined): Transition | null {
    return startAgent?.transitions?.find(t => t.targetTopic === topic.name) ?? null;
  }

  private isTransitionAvailable(transition: Transition | null, state: RuntimeState): boolean {
    if (!transition?.availableWhen?.length) return true;
    for (const cond of transition.availableWhen) {
      if (!this.evaluateCondition(state.variables[cond.variable], cond.operator, cond.value)) return false;
    }
    return true;
  }

  private evaluateCondition(variableValue: any, operator: string, conditionValue: any): boolean {
    switch (operator) {
      case '==': return variableValue === conditionValue;
      case '!=': return variableValue !== conditionValue;
      case '>': return Number(variableValue) > Number(conditionValue);
      case '<': return Number(variableValue) < Number(conditionValue);
      case '>=': return Number(variableValue) >= Number(conditionValue);
      case '<=': return Number(variableValue) <= Number(conditionValue);
      case 'is None': return variableValue === undefined || variableValue === null || variableValue === '';
      case 'is not None': return variableValue !== undefined && variableValue !== null && variableValue !== '';
      default: return true;
    }
  }

  private calculateMatchScore(inputWords: string[], normalizedInput: string, topic: Topic): { score: number; keywords: string[] } {
    const matched: string[] = [];
    let score = 0;

    const nameWords = this.tokenize((topic.displayName || topic.name).toLowerCase());
    const descWords = this.tokenize((topic.description || '').toLowerCase());
    const allWords = [...new Set([...nameWords, ...descWords])];

    for (const w of allWords) {
      if (inputWords.includes(w)) { score += 0.3; matched.push(w); }
      else if (normalizedInput.includes(w)) { score += 0.2; matched.push(w); }
    }

    for (const w of allWords) {
      if (w.length > 4) {
        const stem = w.slice(0, -2);
        if (inputWords.some(iw => iw.startsWith(stem) || iw.endsWith(stem))) {
          score += 0.1;
          if (!matched.includes(w)) matched.push(w);
        }
      }
    }

    const actionSynonyms: Record<string, string[]> = {
      new: ['new', 'create', 'add', 'start', 'begin', 'setup'],
      update: ['update', 'change', 'modify', 'edit', 'upgrade'],
      delete: ['delete', 'remove', 'cancel'],
      view: ['view', 'show', 'see', 'check', 'status'],
      help: ['help', 'assist', 'support'],
    };

    const topicText = `${topic.name} ${topic.displayName ?? ''} ${topic.description ?? ''}`.toLowerCase();
    for (const [action, synonyms] of Object.entries(actionSynonyms)) {
      if (synonyms.some(s => normalizedInput.includes(s))) {
        if (topicText.includes(action) || synonyms.some(s => topicText.includes(s))) score += 0.2;
      }
    }

    return { score: Math.min(score, 1.0), keywords: matched };
  }
}
