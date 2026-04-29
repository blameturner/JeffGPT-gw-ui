import { useEffect, useMemo, useState } from 'react';
import { fetchNocoTables } from '../api';
import type { NocoColumn, NocoTable } from '../types';
import { SelectInput } from '../../connectors/components/Field';

export function ColumnPicker({
  tableName,
  filter,
  value,
  onChange,
}: {
  tableName: string | null | undefined;
  filter?: 'long_text';
  value: string | null | undefined;
  onChange: (next: string | null) => void;
}) {
  const [tables, setTables] = useState<NocoTable[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    setTables(null);
    fetchNocoTables()
      .then((res) => {
        if (!alive) return;
        setTables(res);
      })
      .catch((e: Error) => {
        if (!alive) return;
        setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const columns = useMemo<NocoColumn[]>(() => {
    if (!tableName || !tables) return [];
    const t = tables.find((x) => x.name === tableName);
    if (!t) return [];
    if (filter === 'long_text') {
      return t.columns.filter(
        (c) => c.type.toLowerCase().includes('long') || c.type.toLowerCase().includes('text'),
      );
    }
    return t.columns;
  }, [tables, tableName, filter]);

  if (!tableName) {
    return <div className="text-xs text-muted">Select a table first.</div>;
  }
  if (error) {
    return (
      <div className="text-xs text-red-700 flex items-center gap-2">
        <span>Failed to load columns: {error}</span>
        <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="underline">
          Retry
        </button>
      </div>
    );
  }
  if (tables == null) return <div className="text-xs text-muted">Loading…</div>;
  if (columns.length === 0) {
    return <div className="text-xs text-muted">No matching columns.</div>;
  }

  return (
    <SelectInput
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">— select column —</option>
      {columns.map((c) => (
        <option key={c.name} value={c.name}>
          {c.name} ({c.type})
        </option>
      ))}
    </SelectInput>
  );
}
