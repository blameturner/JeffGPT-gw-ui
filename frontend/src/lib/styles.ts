/**
 * Display-name map for response-style keys returned by the harness /styles
 * endpoint. Backend stays the source of truth for keys and prompt text;
 * the UI owns presentation.
 */
export const STYLE_LABELS: Record<string, string> = {
  // Chat surface
  general: 'General',
  architect: 'Architect',
  operator: 'Operator',
  briefing: 'Briefing',
  strategist: 'Strategist',
  consultant: 'Consultant',
  devils_advocate: "Devil's Advocate",
  risk_auditor: 'Risk Auditor',
  senior_review: 'Senior Review',
  prioritiser: 'Prioritiser',
  translator: 'Translator',
  ghostwriter: 'Ghostwriter',
  deep_dive: 'Deep Dive',
  socratic: 'Socratic',
  eli5: 'ELI5',
  // Code surface
  explain: 'Explain',
  review: 'Review',
  refactor: 'Refactor',
  debug: 'Debug',
  build: 'Build',
  test: 'Test',
  optimise: 'Optimise',
  security: 'Security',
};

export function styleLabel(key: string | null | undefined): string {
  if (!key) return '';
  return STYLE_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
