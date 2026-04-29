import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PrimaryButton, Toolbar } from '../components/Toolbar';
import { EmptyState } from '../components/EmptyState';
import { SecretsList } from './SecretsList';
import { SecretDetailDrawer } from './SecretDetailDrawer';
import { NewSecretModal } from './NewSecretModal';
import { listSecrets } from '../api';
import type { Secret } from '../types';

export function SecretsTab() {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [drawerId, setDrawerId] = useState<number | null>(null);

  // Debounce search → 250ms
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
      const res = await listSecrets();
      setSecrets(res.secrets ?? []);
    } catch (e) {
      console.error('listSecrets failed', e);
      setError((e as Error).message || 'Failed to load secrets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return secrets;
    return secrets.filter((s) => {
      const hay = [s.name, s.description ?? ''].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [secrets, search]);

  function handleChanged(updated: Secret) {
    setSecrets((prev) => {
      const idx = prev.findIndex((p) => p.id === updated.id);
      if (idx === -1) return [updated, ...prev];
      const next = prev.slice();
      next[idx] = updated;
      return next;
    });
  }

  function handleDeleted(id: number) {
    setSecrets((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleCreated(created: Secret) {
    await refresh();
    setDrawerId(created.id);
  }

  const showEmpty = !loading && !error && secrets.length === 0;

  return (
    <div className="flex flex-col">
      <Toolbar
        title="Secrets"
        count={secrets.length}
        search={searchInput}
        onSearch={setSearchInput}
        primary={
          <PrimaryButton onClick={() => setModalOpen(true)}>+ New Secret</PrimaryButton>
        }
      />

      {showEmpty ? (
        <EmptyState
          title="No secrets stored"
          body="Store API keys, passwords, and tokens here. Connectors reference them by name."
          cta={<PrimaryButton onClick={() => setModalOpen(true)}>+ New Secret</PrimaryButton>}
        />
      ) : (
        <SecretsList
          secrets={filtered}
          loading={loading}
          error={error}
          onRetry={() => void refresh()}
          onRowClick={(s) => setDrawerId(s.id)}
        />
      )}

      <SecretDetailDrawer
        open={drawerId != null}
        secretId={drawerId}
        onClose={() => setDrawerId(null)}
        onChanged={handleChanged}
        onDeleted={handleDeleted}
      />

      <NewSecretModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
