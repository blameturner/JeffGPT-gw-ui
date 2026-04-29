import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PrimaryButton, Toolbar } from '../components/Toolbar';
import { EmptyState } from '../components/EmptyState';
import { SmtpList } from './SmtpList';
import { SmtpDetailDrawer } from './SmtpDetailDrawer';
import { RegisterSmtpModal } from './RegisterSmtpModal';
import { listSmtp } from '../api';
import type { ConnectorStatus, SmtpAccount } from '../types';

type StatusFilter = 'all' | ConnectorStatus;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'verified', label: 'Verified' },
  { value: 'send_only', label: 'Send only' },
  { value: 'failed', label: 'Failed' },
  { value: 'unverified', label: 'Unverified' },
];

export function SmtpTab() {
  const [accounts, setAccounts] = useState<SmtpAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [registerOpen, setRegisterOpen] = useState(false);
  const [drawerId, setDrawerId] = useState<number | null>(null);

  // Debounce search input → search (250ms client-side filter)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setSearch(searchInput), 250);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchInput]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listSmtp();
      setAccounts(res.accounts ?? []);
    } catch (e) {
      console.error('listSmtp failed', e);
      setError((e as Error).message || 'Failed to load SMTP accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((a) => {
      if (statusFilter !== 'all') {
        if ((a.status ?? 'unverified') !== statusFilter) return false;
      }
      if (!q) return true;
      const hay = [a.name, a.from_email, a.host].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [accounts, search, statusFilter]);

  function handleChanged(updated: SmtpAccount) {
    setAccounts((prev) => {
      const idx = prev.findIndex((p) => p.id === updated.id);
      if (idx === -1) return [updated, ...prev];
      const next = prev.slice();
      next[idx] = updated;
      return next;
    });
  }

  function handleDeleted(id: number) {
    setAccounts((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleCreated(newId: number) {
    await refresh();
    setDrawerId(newId);
  }

  const showEmpty = !loading && !error && accounts.length === 0;

  return (
    <div className="flex flex-col">
      <Toolbar
        title="SMTP"
        count={accounts.length}
        search={searchInput}
        onSearch={setSearchInput}
        filter={<StatusFilterChip value={statusFilter} onChange={setStatusFilter} />}
        primary={
          <PrimaryButton onClick={() => setRegisterOpen(true)}>+ Register SMTP</PrimaryButton>
        }
      />

      {showEmpty ? (
        <EmptyState
          title="No mailboxes yet"
          body="Add an outbound mailbox so agents can send email."
          cta={
            <PrimaryButton onClick={() => setRegisterOpen(true)}>+ Register SMTP</PrimaryButton>
          }
        />
      ) : (
        <SmtpList
          accounts={filtered}
          loading={loading}
          error={error}
          onRetry={() => void refresh()}
          onRowClick={(a) => setDrawerId(a.id)}
        />
      )}

      <SmtpDetailDrawer
        open={drawerId != null}
        smtpId={drawerId}
        onClose={() => setDrawerId(null)}
        onChanged={handleChanged}
        onDeleted={handleDeleted}
      />

      <RegisterSmtpModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}

function StatusFilterChip({
  value,
  onChange,
}: {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const label = STATUS_OPTIONS.find((o) => o.value === value)?.label ?? 'All';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="text-[11px] uppercase tracking-[0.18em] font-sans border border-border text-fg px-3 py-2 hover:border-fg transition"
      >
        Status: {label} ▾
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 border border-border bg-bg shadow-card min-w-[160px]">
          {STATUS_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={[
                'block w-full text-left px-3 py-2 text-sm hover:bg-panelHi',
                value === o.value ? 'font-sans text-fg' : 'text-muted',
              ].join(' ')}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
