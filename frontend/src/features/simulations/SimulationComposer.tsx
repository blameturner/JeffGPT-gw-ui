import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { simulationsApi, type Participant } from '../../api/simulations';
import { Btn, Eyebrow, Field, TextInput } from '../../components/ui';
import { speakerColor } from './speakerColor';

interface QuickAdd {
  name: string;
  persona: string;
}

const QUICK_ADD: QuickAdd[] = [
  {
    name: 'Skeptical CFO',
    persona:
      'Late-30s SaaS CFO. Burned by past vendors. Treats every dollar as ROI-justified. Asks for benchmarks, payback period, churn risk.',
  },
  {
    name: 'Founder-led seller',
    persona:
      'Founder running discovery-led sales. Direct, contrarian, hates discounting. Anchors on customer outcomes over feature lists.',
  },
  {
    name: 'Late-stage investor',
    persona:
      'Series C+ board observer. Cares about gross margin, NRR, sales efficiency. Reads between the lines on a deck.',
  },
  {
    name: 'Disgruntled customer',
    persona:
      'Mid-market user who renewed reluctantly. Thinks the product is half-baked. Will quote the SLA back to you.',
  },
  {
    name: 'Regulator',
    persona:
      'Compliance officer with audit authority. Polite, methodical, will not move on without written guarantees.',
  },
  {
    name: "Devil's advocate",
    persona:
      'Pressure-tests every assumption. Looks for the weakest premise and pulls on it until something breaks.',
  },
];

const SAMPLE_TITLE = 'Pricing chat with skeptical CFO';
const SAMPLE_SCENARIO =
  'We are pitching a $40k annual contract to a mid-market SaaS CFO. Goal: close. Their goal: cut spend.';
const SAMPLE_PARTICIPANTS: Participant[] = [
  {
    name: 'Sales rep',
    persona:
      'Founder-led sales. Direct, asks discovery questions, hates discounting.',
  },
  {
    name: 'Skeptical CFO',
    persona:
      'Late-30s SaaS CFO. Burned by past vendors. Treats every dollar as ROI-justified.',
  },
];

interface Props {
  prefillSample?: boolean;
  onConsumedSample?: () => void;
}

export function SimulationComposer({ prefillSample, onConsumedSample }: Props) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [scenario, setScenario] = useState('');
  const [maxTurns, setMaxTurns] = useState(8);
  const [participants, setParticipants] = useState<Participant[]>([
    { name: '', persona: '' },
    { name: '', persona: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (prefillSample) {
      setTitle(SAMPLE_TITLE);
      setScenario(SAMPLE_SCENARIO);
      setParticipants(SAMPLE_PARTICIPANTS.map((p) => ({ ...p })));
      setMaxTurns(8);
      onConsumedSample?.();
    }
  }, [prefillSample, onConsumedSample]);

  const effectiveTitle = useMemo(() => {
    if (title.trim()) return title.trim();
    const firstLine = scenario.split('\n').find((l) => l.trim()) ?? '';
    return firstLine.trim().slice(0, 80);
  }, [title, scenario]);

  const namedCount = participants.filter((p) => p.name.trim()).length;
  const canSubmit =
    !submitting && scenario.trim().length > 0 && namedCount >= 2;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const cleanParticipants = participants
        .map((p) => ({ name: p.name.trim(), persona: p.persona.trim() }))
        .filter((p) => p.name);
      const r = await simulationsApi.create({
        title: effectiveTitle || `Simulation`,
        scenario: scenario.trim(),
        participants: cleanParticipants,
        max_turns: maxTurns,
      });
      await navigate({
        to: '/simulations/$simId',
        params: { simId: String(r.sim_id) },
      });
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
      setSubmitting(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void submit();
    }
  };

  const updateParticipant = (i: number, patch: Partial<Participant>) => {
    setParticipants((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)),
    );
  };

  const addParticipant = (seed?: QuickAdd) => {
    setParticipants((prev) => [
      ...prev,
      seed ? { name: seed.name, persona: seed.persona } : { name: '', persona: '' },
    ]);
  };

  const fillFirstEmptyOrAdd = (seed: QuickAdd) => {
    setParticipants((prev) => {
      const idx = prev.findIndex((p) => !p.name.trim() && !p.persona.trim());
      if (idx >= 0) {
        return prev.map((p, i) =>
          i === idx ? { name: seed.name, persona: seed.persona } : p,
        );
      }
      return [...prev, { name: seed.name, persona: seed.persona }];
    });
  };

  const removeParticipant = (i: number) => {
    setParticipants((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((_, idx) => idx !== i);
    });
  };

  return (
    <form
      ref={formRef}
      onKeyDown={onKeyDown}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="p-5 sm:p-6 space-y-5 max-w-3xl"
    >
      <header>
        <Eyebrow>New simulation</Eyebrow>
        <h2 className="font-display text-xl tracking-tightest mt-0.5">
          Compose a rehearsal
        </h2>
        <p className="text-xs text-muted mt-1">
          Sketch the situation, define who is in the room, and the engine will
          play it forward turn by turn.
        </p>
      </header>

      <Field label="Title" hint="Auto-filled from the first line of the scenario when blank.">
        <TextInput
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            effectiveTitle && !title
              ? `${effectiveTitle} (auto)`
              : 'e.g. Pricing chat with skeptical CFO'
          }
        />
      </Field>

      <Field label="Scenario">
        <textarea
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          rows={Math.max(6, Math.min(12, scenario.split('\n').length + 2))}
          placeholder="Set the situation, the goals on each side, and any constraints."
          className="w-full bg-bg border border-border rounded-sm px-3 py-2 text-sm font-mono leading-relaxed focus:outline-none focus:border-fg focus:ring-2 focus:ring-fg/10 transition-colors placeholder:text-muted/70"
        />
      </Field>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <Eyebrow>Participants ({namedCount} named, min 2)</Eyebrow>
          <Btn type="button" size="sm" variant="ghost" onClick={() => addParticipant()}>
            + add
          </Btn>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {QUICK_ADD.map((q) => {
            const c = speakerColor(q.name);
            return (
              <button
                key={q.name}
                type="button"
                onClick={() => fillFirstEmptyOrAdd(q)}
                className="text-[10px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border hover:opacity-80 transition-opacity"
                style={{ color: c.ink, background: c.wash, borderColor: c.border }}
                title={q.persona}
              >
                + {q.name}
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          {participants.map((p, i) => {
            const c = speakerColor(p.name || `slot-${i}`);
            return (
              <div
                key={i}
                className="border border-border rounded-sm p-3 bg-panel/40"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-[10px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded-sm border font-sans"
                    style={{
                      color: p.name ? c.ink : '#6b6b6b',
                      background: p.name ? c.wash : 'transparent',
                      borderColor: p.name ? c.border : '#e6e6e4',
                    }}
                  >
                    {p.name || `Participant ${i + 1}`}
                  </span>
                  <div className="flex-1" />
                  {participants.length > 2 && (
                    <Btn
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeParticipant(i)}
                    >
                      remove
                    </Btn>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-[200px_minmax(0,1fr)]">
                  <TextInput
                    density="compact"
                    placeholder="Name"
                    value={p.name}
                    onChange={(e) => updateParticipant(i, { name: e.target.value })}
                  />
                  <textarea
                    rows={2}
                    placeholder="Persona — voice, motives, posture."
                    value={p.persona}
                    onChange={(e) => updateParticipant(i, { persona: e.target.value })}
                    className="w-full bg-bg border border-border rounded-sm px-2 py-1 text-xs font-mono focus:outline-none focus:border-fg focus:ring-2 focus:ring-fg/10"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <Field
        label={`Max turns: ${maxTurns}`}
        hint="Hard cap on the rehearsal length."
      >
        <input
          type="range"
          min={2}
          max={30}
          step={1}
          value={maxTurns}
          onChange={(e) => setMaxTurns(Number(e.target.value))}
          className="w-full accent-fg"
        />
        <div className="flex justify-between text-[10px] text-muted mt-0.5 font-mono">
          <span>2</span>
          <span>30</span>
        </div>
      </Field>

      {error && (
        <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded-sm">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Btn type="submit" variant="primary" disabled={!canSubmit}>
          {submitting ? 'Launching…' : 'Launch simulation'}
        </Btn>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted">
          ⌘/Ctrl + ↵ to launch
        </span>
      </div>
    </form>
  );
}
