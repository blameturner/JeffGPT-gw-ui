import { useState } from 'react';
import type { SearchSource } from '../../api/types/SearchSource';

interface DeepSearchPlan {
  queries: string[];
  sources: SearchSource[];
  status: 'awaiting_approval' | 'approved' | 'revised';
}

interface ResearchPlan {
  question: string;
  objective: string;
  queries: string[];
  lookout: string[];
  completionCriteria: string[];
  status: 'awaiting_approval' | 'approved' | 'revised';
}

interface Props {
  deepSearchPlan?: DeepSearchPlan;
  researchPlan?: ResearchPlan;
  onApprove: () => void;
  onRevise: (feedback: string) => void;
}

export function PlanApprovalCard({ deepSearchPlan, researchPlan, onApprove, onRevise }: Props) {
  const [revising, setRevising] = useState(false);
  const [feedback, setFeedback] = useState('');

  const plan = deepSearchPlan ?? researchPlan;
  if (!plan || plan.status !== 'awaiting_approval') return null;

  const isResearch = !!researchPlan;
  const label = isResearch ? 'Research' : 'Deep Search';

  function handleReviseSubmit() {
    const text = feedback.trim();
    if (!text) return;
    onRevise(text);
    setRevising(false);
    setFeedback('');
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-bg/60 overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-panel/40">
        <span className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted">
          {label} Plan
        </span>
      </div>

      <div className="px-3 py-2.5 space-y-3">
        {/* Research-specific fields */}
        {researchPlan && (
          <>
            <PlanSection label="Objective">
              <p className="text-[12px] text-fg leading-relaxed">{researchPlan.objective}</p>
            </PlanSection>
            <PlanSection label="Looking for">
              <ul className="text-[11px] text-muted space-y-0.5 list-disc list-inside">
                {researchPlan.lookout.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </PlanSection>
            <PlanSection label="Completion criteria">
              <ul className="text-[11px] text-muted space-y-0.5 list-disc list-inside">
                {researchPlan.completionCriteria.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </PlanSection>
            <p className="text-[10px] text-muted italic">
              Will iterate up to 3 rounds until criteria are met
            </p>
          </>
        )}

        {/* Queries — shown for both */}
        {(deepSearchPlan?.queries.length || researchPlan?.queries.length) ? (
          <PlanSection label="Queries">
            <div className="flex flex-wrap gap-1.5">
              {(deepSearchPlan?.queries ?? researchPlan?.queries ?? []).map((q, i) => (
                <span
                  key={i}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-panelHi border border-border text-muted"
                >
                  {q}
                </span>
              ))}
            </div>
          </PlanSection>
        ) : null}

        {/* Sources — deep search only */}
        {deepSearchPlan && deepSearchPlan.sources.length > 0 && (
          <PlanSection label={`Sources (${deepSearchPlan.sources.length})`}>
            <div className="space-y-1">
              {deepSearchPlan.sources.map((s, i) => {
                let hostname = '';
                try { hostname = new URL(s.url).hostname; } catch {}
                return (
                  <a
                    key={i}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block text-[11px] text-muted hover:text-fg truncate"
                  >
                    <span className="text-fg font-medium">{s.title}</span>
                    {hostname && <span className="ml-1.5 text-[10px] text-muted">({hostname})</span>}
                  </a>
                );
              })}
            </div>
          </PlanSection>
        )}

        {/* Actions */}
        {revising ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleReviseSubmit()}
              placeholder="How should the plan change?"
              autoFocus
              className="flex-1 text-[12px] px-2.5 py-1.5 rounded-md border border-border bg-bg text-fg placeholder:text-muted focus:outline-none focus:border-fg/40"
            />
            <button
              type="button"
              onClick={handleReviseSubmit}
              disabled={!feedback.trim()}
              className="text-[10px] uppercase tracking-[0.14em] font-sans px-3 py-1.5 rounded-md border border-fg/40 text-fg hover:bg-fg hover:text-bg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Send
            </button>
            <button
              type="button"
              onClick={() => { setRevising(false); setFeedback(''); }}
              className="text-[10px] uppercase tracking-[0.14em] font-sans px-2.5 py-1.5 text-muted hover:text-fg transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onApprove}
              className="text-[10px] uppercase tracking-[0.14em] font-sans px-3 py-1.5 rounded-md border border-emerald-600/60 text-emerald-400 hover:bg-emerald-600 hover:text-bg transition-colors"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => setRevising(true)}
              className="text-[10px] uppercase tracking-[0.14em] font-sans px-3 py-1.5 rounded-md border border-border text-muted hover:text-fg hover:border-fg/40 transition-colors"
            >
              Revise
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PlanSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted mb-1">{label}</p>
      {children}
    </div>
  );
}
