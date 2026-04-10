export const STYLE_LABELS: Record<string, string> = {
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
