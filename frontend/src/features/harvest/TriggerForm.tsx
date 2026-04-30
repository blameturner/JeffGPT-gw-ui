import { useEffect, useState } from 'react';
import { harvestApi, type HarvestPolicy } from '../../api/harvest';
import { listApis } from '../connectors/api';
import type { ApiConnection } from '../connectors/types';
import { Btn, Field, TextInput, Eyebrow } from '../../components/ui';

const HELP_LINES: Record<string, string> = {
  knowledge: 'Adds new entries to your RAG knowledge corpus.',
  knowledge_update: 'Updates existing rows in the table you specify.',
  graph_node: 'Updates entity nodes in the graph.',
  artifacts: 'Stores structured records on this run only — view in the Artifacts panel.',
};

export function TriggerForm({
  policy,
  onTriggered,
}: {
  policy: HarvestPolicy | null;
  onTriggered: (runId: number) => void;
}) {
  if (!policy) {
    return (
      <div className="px-6 py-10 text-center text-xs text-muted">
        Pick a policy from the catalog to begin.
      </div>
    );
  }
  return <TriggerFormBody key={policy.name} policy={policy} onTriggered={onTriggered} />;
}

function TriggerFormBody({
  policy,
  onTriggered,
}: {
  policy: HarvestPolicy;
  onTriggered: (runId: number) => void;
}) {
  const [seedUrl, setSeedUrl] = useState('');
  const [urlList, setUrlList] = useState('');
  const [topic, setTopic] = useState('');
  const [sites, setSites] = useState<string[]>([]);
  const [siteInput, setSiteInput] = useState('');
  const [tableName, setTableName] = useState('');
  const [columnName, setColumnName] = useState('');
  const [missingOnly, setMissingOnly] = useState(true);
  const [maxPages, setMaxPages] = useState(policy.max_pages ?? 50);
  const [respectRobots, setRespectRobots] = useState(policy.respect_robots ?? true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [rateLimit, setRateLimit] = useState<string>('');
  const [connectionId, setConnectionId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [connections, setConnections] = useState<ApiConnection[] | null>(null);
  useEffect(() => {
    listApis().then((r) => setConnections(r.apis)).catch(() => setConnections([]));
  }, []);

  const [bulkUrls, setBulkUrls] = useState<string[] | null>(null);
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (!f) return;
    const text = await f.text();
    const urls = parseUrls(text, f.name);
    setBulkUrls(urls.slice(0, 500));
  };

  const tryPasteFromClipboard = async () => {
    if (seedUrl) return;
    try {
      const t = await navigator.clipboard.readText();
      if (/^https?:\/\//.test(t.trim())) setSeedUrl(t.trim());
    } catch {
      /* ignore */
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const params: Record<string, unknown> = {};
    let seed: string | string[] = '';
    try {
      switch (policy.seed_strategy) {
        case 'literal_url':
          if (!isUrl(seedUrl)) throw new Error('Enter a valid http(s) URL.');
          seed = seedUrl.trim();
          break;
        case 'url_list': {
          const fromTextarea = parseUrls(urlList, '');
          const urls = bulkUrls ?? fromTextarea;
          if (urls.length === 0) throw new Error('Provide at least one URL.');
          if (urls.length > 500) throw new Error('Cap is 500 URLs.');
          seed = urls;
          if (bulkUrls) params.source = 'bookmarks_html';
          break;
        }
        case 'topic_search':
        case 'criteria_search':
          if (topic.trim().length <= 3) throw new Error('Topic must be longer than 3 characters.');
          seed = topic.trim();
          if (sites.length > 0) params.sites = sites;
          break;
        case 'sitemap_expand':
        case 'rss_feed':
          if (!isUrl(seedUrl)) throw new Error('Enter a valid http(s) URL.');
          seed = seedUrl.trim();
          break;
        case 'table_column':
          if (!tableName.trim() || !columnName.trim())
            throw new Error('Select a table and column.');
          seed = '';
          params.table = tableName.trim();
          params.column = columnName.trim();
          params.missing_only = missingOnly;
          break;
        default:
          if (!seedUrl.trim()) throw new Error('Provide a seed.');
          seed = seedUrl.trim();
      }

      params.max_pages = maxPages;
      params.respect_robots = respectRobots;
      if (rateLimit) params.rate_limit_per_host_s = Number(rateLimit);
      if (connectionId) params.connection_id = Number(connectionId);

      setSubmitting(true);
      const res = await harvestApi.runPolicy(policy.name, { seed, params });
      onTriggered(res.run_id);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const help = HELP_LINES[policy.persist_target as string];

  return (
    <form onSubmit={submit} className="px-5 sm:px-8 py-6 space-y-6 max-w-2xl">
      <header className="space-y-2">
        <Eyebrow>seed strategy · {policy.seed_strategy}</Eyebrow>
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="font-display text-2xl tracking-tightest leading-none">{policy.name}</h2>
          <PersistTargetChip target={policy.persist_target} />
          {policy.walk_enabled && (
            <span className="text-[9px] uppercase tracking-[0.18em] text-muted px-1.5 py-0.5 border border-border rounded-sm">
              walk
            </span>
          )}
        </div>
        {help && <p className="text-sm text-muted leading-relaxed max-w-prose">{help}</p>}
      </header>

      <div className="space-y-4">
        {(policy.seed_strategy === 'literal_url' ||
          policy.seed_strategy === 'sitemap_expand' ||
          policy.seed_strategy === 'rss_feed') && (
          <Field
            label="URL"
            hint={policy.seed_strategy === 'sitemap_expand' ? "we'll find /sitemap.xml automatically" : undefined}
          >
            <TextInput
              mono
              value={seedUrl}
              onChange={(e) => setSeedUrl(e.target.value)}
              onFocus={tryPasteFromClipboard}
              placeholder="https://example.com/…"
            />
          </Field>
        )}

        {policy.seed_strategy === 'url_list' && (
          <>
            <Field label="URLs (one per line)">
              <textarea
                value={urlList}
                onChange={(e) => setUrlList(e.target.value)}
                rows={6}
                className="w-full bg-bg border border-border rounded-sm px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:border-fg focus:ring-2 focus:ring-fg/10"
              />
            </Field>
            <div
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border border-dashed border-border rounded-md p-5 text-center text-xs text-muted hover:border-fg/40 transition-colors"
            >
              {bulkUrls ? (
                <div>
                  <div className="text-fg font-display text-base">
                    {bulkUrls.length} URLs parsed
                  </div>
                  <button
                    type="button"
                    onClick={() => setBulkUrls(null)}
                    className="mt-1 underline text-[10px] uppercase tracking-[0.18em]"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <>Drop a .txt or bookmarks .html file (max 500 URLs)</>
              )}
            </div>
          </>
        )}

        {(policy.seed_strategy === 'topic_search' ||
          policy.seed_strategy === 'criteria_search') && (
          <>
            <Field label="Topic">
              <TextInput
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. claims of cold-fusion replication"
              />
            </Field>
            <Field label="Sites (optional)">
              <div className="flex flex-wrap gap-1 mb-1.5">
                {sites.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSites(sites.filter((x) => x !== s))}
                    className="px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] border border-border rounded-sm hover:border-fg flex items-center gap-1"
                  >
                    {s} <span className="text-muted">×</span>
                  </button>
                ))}
              </div>
              <TextInput
                mono
                value={siteInput}
                onChange={(e) => setSiteInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && siteInput.trim()) {
                    e.preventDefault();
                    setSites((p) => [...p, siteInput.trim()]);
                    setSiteInput('');
                  }
                }}
                placeholder="press enter to add"
              />
            </Field>
          </>
        )}

        {policy.seed_strategy === 'table_column' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Table">
              <TextInput
                mono
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="table id or name"
              />
            </Field>
            <Field label="Column">
              <TextInput
                mono
                value={columnName}
                onChange={(e) => setColumnName(e.target.value)}
                placeholder="column name"
              />
            </Field>
            <label className="col-span-full flex items-center gap-2 text-xs select-none">
              <input
                type="checkbox"
                checked={missingOnly}
                onChange={(e) => setMissingOnly(e.target.checked)}
                className="accent-fg"
              />
              missing values only
            </label>
          </div>
        )}
      </div>

      <fieldset className="border-t border-border pt-5 space-y-4">
        <Field label={`max pages · ${maxPages}`}>
          <input
            type="range"
            min={1}
            max={Math.max(policy.max_pages ?? 50, 500)}
            step={1}
            value={maxPages}
            onChange={(e) => setMaxPages(Number(e.target.value))}
            className="w-full accent-fg"
          />
        </Field>
        <label className="flex items-center gap-2 text-xs select-none">
          <input
            type="checkbox"
            checked={respectRobots}
            onChange={(e) => setRespectRobots(e.target.checked)}
            className="accent-fg"
          />
          respect robots.txt
        </label>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-[10px] uppercase tracking-[0.18em] text-muted hover:text-fg"
        >
          {showAdvanced ? '− advanced' : '+ advanced'}
        </button>
        {showAdvanced && (
          <div className="space-y-3 border-l border-border pl-3">
            <Field label="rate limit per host (s)">
              <TextInput
                density="compact"
                mono
                value={rateLimit}
                onChange={(e) => setRateLimit(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="default"
              />
            </Field>
            <Field label="connection">
              <select
                value={connectionId}
                onChange={(e) => setConnectionId(e.target.value)}
                className="w-full bg-bg border border-border rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-fg"
              >
                <option value="">— default —</option>
                {(connections ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
      </fieldset>

      {err && (
        <div className="border border-red-200 bg-red-50 rounded-sm px-3 py-2 text-xs text-red-800">
          {err}
        </div>
      )}

      <Btn type="submit" variant="primary" disabled={submitting}>
        {submitting ? 'Queueing…' : 'Run policy'}
      </Btn>
    </form>
  );
}

const TARGET_CHIP_TONE: Record<string, string> = {
  knowledge: 'border-emerald-300 text-emerald-900 bg-emerald-50',
  artifacts: 'border-sky-300 text-sky-900 bg-sky-50',
  knowledge_update: 'border-amber-300 text-amber-900 bg-amber-50',
  graph_node: 'border-violet-300 text-violet-900 bg-violet-50',
};

export function PersistTargetChip({ target }: { target: string }) {
  const tone = TARGET_CHIP_TONE[target] ?? 'border-border text-muted bg-panel';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 border rounded-sm text-[10px] uppercase tracking-[0.16em] ${tone}`}
    >
      {target}
    </span>
  );
}

function isUrl(s: string): boolean {
  if (!s) return false;
  try {
    const u = new URL(s.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function parseUrls(text: string, filename: string): string[] {
  if (/\.html?$/i.test(filename) || /<a\s+[^>]*href=/i.test(text)) {
    const matches = text.matchAll(/href\s*=\s*"(https?:\/\/[^"]+)"/gi);
    const urls: string[] = [];
    for (const m of matches) urls.push(m[1]);
    return Array.from(new Set(urls));
  }
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//.test(s));
}
