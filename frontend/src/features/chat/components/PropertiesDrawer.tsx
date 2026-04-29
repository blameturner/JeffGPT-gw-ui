import { useEffect, useState } from 'react';
import type { ConversationSummary } from '../../../api/types/ConversationSummary';
import type { SearchMode } from '../../../api/types/SearchMode';
import type { StyleSurface } from '../../../api/types/StyleSurface';
import type { LlmModel } from '../../../api/types/LlmModel';
import type { Conversation } from '../../../api/types/Conversation';
import type { ConversationProperties } from '../../../api/types/ConversationProperties';
import type { ConversationPropertiesState } from '../hooks/useConversationProperties';
import type { ChatMemoryState } from '../hooks/useChatMemory';
import { ChatMemorySection } from './ChatMemorySection';

const SEARCH_MODE_LABEL: Record<SearchMode, string> = {
  standard: 'standard',
  basic: 'basic',
  disabled: 'off',
};

interface Props {
  activeId: number | null;
  activeConversation: Conversation | null;
  searchMode: SearchMode;
  stats: ConversationSummary | null;
  loadingStats: boolean;
  refreshStats: () => void;
  renameTitle: string;
  setRenameTitle: (v: string) => void;
  renaming: boolean;
  renameError: string | null;
  saveRename: () => void;
  deleteChat: () => void;
  activeTitle: string;
  onClose: () => void;
  properties: ConversationPropertiesState;
  memory: ChatMemoryState;
  styles?: StyleSurface | null;
  models: LlmModel[];
  scrollToMemoryToken?: number;
}

export function PropertiesDrawer({
  activeId,
  activeConversation,
  searchMode,
  stats,
  loadingStats,
  refreshStats,
  renameTitle,
  setRenameTitle,
  renaming,
  renameError,
  saveRename,
  deleteChat,
  activeTitle,
  onClose,
  properties,
  memory,
  styles,
  models,
  scrollToMemoryToken,
}: Props) {
  const v = properties.values;
  const disabled = activeId == null;

  const [memoryRef, setMemoryRef] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (scrollToMemoryToken != null && memoryRef) {
      memoryRef.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [scrollToMemoryToken, memoryRef]);

  return (
    <>
      <button
        type="button"
        aria-label="Close properties"
        onClick={onClose}
        className="md:hidden fixed inset-0 z-40 bg-fg/40 backdrop-blur-sm animate-backdrop"
      />
      <aside className="z-50 fixed inset-y-0 right-0 w-[92vw] max-w-[380px] md:static md:inset-auto md:w-[380px] shrink-0 border-l border-border bg-bg md:bg-panel/40 flex flex-col animate-sheet-right md:animate-fadeIn">
        <header className="shrink-0 flex items-start justify-between px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Chat</p>
            <h3 className="font-display text-lg font-semibold tracking-tightest truncate">
              Properties
            </h3>
            {properties.savedAt && !properties.saving && (
              <p className="text-[9px] uppercase tracking-[0.14em] text-muted mt-0.5">Saved</p>
            )}
            {properties.saving && (
              <p className="text-[9px] uppercase tracking-[0.14em] text-muted mt-0.5">Saving…</p>
            )}
            {properties.error && (
              <p className="text-[9px] uppercase tracking-[0.14em] text-red-600 mt-0.5">
                {properties.error}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-9 h-9 -mr-2 rounded-md border border-border text-fg hover:bg-panelHi flex items-center justify-center text-xl leading-none"
            aria-label="Close properties"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 text-sm">
          {/* Title section */}
          <section>
            <Label>Title</Label>
            <input
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              placeholder={activeTitle || 'Untitled'}
              disabled={disabled || renaming}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  saveRename();
                }
              }}
              className="w-full bg-bg border border-border rounded-md px-3 py-2 text-[14px] focus:outline-none focus:border-fg disabled:opacity-50"
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-[10px] font-sans text-muted">
                {renameError ? <span className="text-red-600">{renameError}</span> : 'Enter to save'}
              </p>
              <button
                type="button"
                onClick={saveRename}
                disabled={
                  disabled ||
                  renaming ||
                  !renameTitle.trim() ||
                  renameTitle.trim() === activeTitle
                }
                className="text-[10px] uppercase tracking-[0.14em] font-sans px-3 py-1 rounded border border-fg text-fg hover:bg-fg hover:text-bg transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-fg disabled:cursor-not-allowed"
              >
                {renaming ? '...' : 'Save'}
              </button>
            </div>
          </section>

          {/* System note */}
          <section>
            <Label>System note</Label>
            <textarea
              value={(v.system_note ?? '') as string}
              onChange={(e) => properties.setField('system_note', e.target.value)}
              onBlur={() => void properties.flush()}
              maxLength={2000}
              rows={3}
              disabled={disabled}
              placeholder="Strategic work for Altitude Group, peer-mode, push back hard."
              className="w-full bg-bg border border-border rounded-md px-3 py-2 text-[13px] focus:outline-none focus:border-fg disabled:opacity-50 resize-none"
            />
            <Help>
              Sticky context prepended to every message in this chat — what this chat is for, what tone you want, anything you'd otherwise restate every turn.
            </Help>
          </section>

          {/* Defaults */}
          <section className="space-y-3">
            <Label>Defaults</Label>

            <SelectField
              label="Default style"
              value={(v.default_response_style ?? '') as string}
              disabled={disabled}
              onChange={(val) =>
                properties.setField('default_response_style', val || null)
              }
              options={[
                { value: '', label: 'Use system default' },
                ...(styles?.styles?.map((s) => ({
                  value: s.key,
                  label: s.label ?? s.key,
                })) ?? []),
              ]}
            />

            <SelectField
              label="Default model"
              value={v.model ?? ''}
              disabled={disabled}
              onChange={(val) => properties.setField('model', val)}
              options={models.map((m) => ({ value: m.name, label: m.name }))}
            />

            <Toggle
              label="Polish pass default"
              description="Run a critique→revise pass before returning each reply."
              checked={!!v.polish_pass_default}
              disabled={disabled}
              onToggle={() =>
                properties.setField('polish_pass_default', !v.polish_pass_default)
              }
            />
            <Toggle
              label="Strict grounding"
              description="Force the model to cite a source from your knowledge base or web search, or admit it can't."
              checked={!!v.strict_grounding_default}
              disabled={disabled}
              onToggle={() =>
                properties.setField('strict_grounding_default', !v.strict_grounding_default)
              }
            />
            <Toggle
              label="Ask back on ambiguity"
              description="Model asks one clarifying question before answering anything ambiguous."
              checked={!!v.ask_back_default}
              disabled={disabled}
              onToggle={() => properties.setField('ask_back_default', !v.ask_back_default)}
            />
            <Toggle
              label="Contextual grounding"
              description="Pull current facts when the model spots real-world entities."
              checked={v.contextual_grounding_enabled !== false}
              disabled={disabled}
              onToggle={() =>
                properties.setField(
                  'contextual_grounding_enabled',
                  !(v.contextual_grounding_enabled !== false),
                )
              }
            />
          </section>

          {/* Memory budgets */}
          <section className="space-y-3">
            <Label>Memory tuning</Label>
            <NumberField
              label="Extraction cadence (turns)"
              value={v.memory_extract_every_n_turns ?? 6}
              min={0}
              max={50}
              disabled={disabled}
              help="Run structured fact extraction every N turns. Set to 0 to disable auto-extraction."
              onChange={(n) => properties.setField('memory_extract_every_n_turns', n)}
            />
            <NumberField
              label="Memory token budget"
              value={v.memory_token_budget ?? 800}
              min={0}
              max={8000}
              disabled={disabled}
              help="How much of each prompt is spent on pinned memory."
              onChange={(n) => properties.setField('memory_token_budget', n)}
            />
          </section>

          {/* Chat memory */}
          <div ref={(el) => setMemoryRef(el)}>
            <ChatMemorySection memory={memory} disabled={disabled} />
          </div>

          {/* Sticky reads */}
          <section>
            <Label>Sticky context</Label>
            <dl className="grid grid-cols-2 gap-y-1.5 text-[12px] font-sans">
              <dt className="text-muted">Memory (RAG)</dt>
              <dd className="text-right">
                {activeConversation?.rag_enabled ? 'on' : 'off'}
              </dd>
              <dt className="text-muted">Knowledge graph</dt>
              <dd className="text-right">
                {activeConversation?.knowledge_enabled ? 'on' : 'off'}
              </dd>
              <dt className="text-muted">Search</dt>
              <dd className="text-right">{SEARCH_MODE_LABEL[searchMode]}</dd>
            </dl>
            <Help>RAG/Knowledge are captured when the chat is first created. Change search mode from the composer.</Help>
          </section>

          <StatsSection
            activeId={activeId}
            stats={stats}
            loadingStats={loadingStats}
            refreshStats={refreshStats}
          />

          {activeId != null && (
            <section>
              <Label>Danger zone</Label>
              <button
                type="button"
                onClick={deleteChat}
                className="w-full text-[11px] uppercase tracking-[0.14em] font-sans px-3 py-2 rounded border border-red-600 text-red-600 hover:bg-red-600 hover:text-bg transition-colors"
              >
                Delete conversation
              </button>
            </section>
          )}
        </div>
      </aside>
    </>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">{children}</h4>
  );
}

function Help({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-sans text-muted mt-2 leading-relaxed">{children}</p>
  );
}

function Toggle({
  label,
  description,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-[11px] font-sans text-fg cursor-pointer select-none">
      <span className="min-w-0">
        <span className="text-muted uppercase tracking-[0.14em] text-[10px] block">{label}</span>
        <span className="text-[10px] text-muted block">{description}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onToggle}
        className={[
          'relative w-9 h-5 rounded-full border transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed',
          checked ? 'bg-fg border-fg' : 'bg-bg border-border',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 w-3.5 h-3.5 rounded-full transition-transform',
            checked ? 'left-0.5 translate-x-4 bg-bg' : 'left-0.5 bg-fg',
          ].join(' ')}
        />
      </button>
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-muted uppercase tracking-[0.14em] text-[10px] mb-1 font-sans">{label}</p>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bg border border-border rounded-md px-2 py-1.5 text-[12px] focus:outline-none focus:border-fg disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  disabled,
  help,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  help?: string;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <p className="text-muted uppercase tracking-[0.14em] text-[10px] mb-1 font-sans">{label}</p>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={1}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) {
            onChange(Math.max(min, Math.min(max, Math.round(n))));
          }
        }}
        className="w-full bg-bg border border-border rounded-md px-2 py-1.5 text-[12px] focus:outline-none focus:border-fg disabled:opacity-50"
      />
      {help && <p className="text-[10px] font-sans text-muted mt-1 leading-relaxed">{help}</p>}
    </div>
  );
}

function StatsSection({
  activeId,
  stats,
  loadingStats,
  refreshStats,
}: {
  activeId: number | null;
  stats: ConversationSummary | null;
  loadingStats: boolean;
  refreshStats: () => void;
}) {
  return (
    <details className="group">
      <summary className="flex items-center justify-between mb-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted">Stats</h4>
        <span className="text-muted text-[10px] transition-transform group-open:rotate-90">▸</span>
      </summary>
      <div className="flex justify-end -mt-1 mb-2">
        <button
          onClick={refreshStats}
          disabled={activeId == null || loadingStats}
          className="text-[10px] uppercase tracking-[0.14em] font-sans text-fg hover:underline underline-offset-4 disabled:opacity-40"
        >
          {loadingStats ? '...' : 'Refresh'}
        </button>
      </div>

      {activeId == null ? (
        <p className="text-[11px] text-muted font-sans">Select a conversation.</p>
      ) : stats == null ? (
        <p className="text-[11px] text-muted font-sans">Tap refresh to load.</p>
      ) : (
        <dl className="grid grid-cols-2 gap-y-1 text-[11px] font-sans">
          <dt className="text-muted">messages</dt>
          <dd className="text-right">{stats.message_count}</dd>
          <dt className="text-muted">runs</dt>
          <dd className="text-right">{stats.run_count}</dd>
          <dt className="text-muted">tokens in</dt>
          <dd className="text-right">{stats.tokens_input.toLocaleString()}</dd>
          <dt className="text-muted">tokens out</dt>
          <dd className="text-right">{stats.tokens_output.toLocaleString()}</dd>
          <dt className="text-muted font-semibold">total</dt>
          <dd className="text-right font-semibold">{stats.tokens_total.toLocaleString()}</dd>
        </dl>
      )}
    </details>
  );
}

export type { ConversationProperties };
