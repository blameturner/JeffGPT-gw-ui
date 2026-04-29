import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createMemoryItem,
  deleteMemoryItem,
  extractMemory,
  listMemoryItems,
  updateMemoryItem,
  type CreateMemoryBody,
  type UpdateMemoryBody,
} from '../../../api/chat/memory';
import type {
  ChatMemoryCategory,
  ChatMemoryItem,
} from '../../../api/types/ChatMemoryItem';

export interface ChatMemoryState {
  items: ChatMemoryItem[];
  loading: boolean;
  error: string | null;
  extracting: boolean;
  lastExtractDelta: number | null;
  refresh: () => Promise<void>;
  add: (body: CreateMemoryBody) => Promise<ChatMemoryItem | null>;
  update: (id: number, body: UpdateMemoryBody) => Promise<void>;
  remove: (id: number) => Promise<void>;
  accept: (id: number) => Promise<void>;
  reject: (id: number) => Promise<void>;
  acceptAllProposed: () => Promise<void>;
  togglePin: (id: number) => Promise<void>;
  runExtract: () => Promise<{ persisted: number } | null>;
}

export function useChatMemory(conversationId: number | null): ChatMemoryState {
  const [items, setItems] = useState<ChatMemoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [lastExtractDelta, setLastExtractDelta] = useState<number | null>(null);

  const reqIdRef = useRef(0);

  const refresh = useCallback(async () => {
    if (conversationId == null) {
      setItems([]);
      return;
    }
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await listMemoryItems(conversationId);
      if (reqIdRef.current !== reqId) return;
      setItems(res.items ?? []);
    } catch (err) {
      if (reqIdRef.current !== reqId) return;
      setError((err as Error)?.message ?? 'Failed to load memory');
    } finally {
      if (reqIdRef.current === reqId) setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = useCallback(
    async (body: CreateMemoryBody) => {
      if (conversationId == null) return null;
      try {
        const created = await createMemoryItem(conversationId, body);
        setItems((prev) => [created, ...prev]);
        return created;
      } catch (err) {
        setError((err as Error)?.message ?? 'Failed to add memory item');
        return null;
      }
    },
    [conversationId],
  );

  const update = useCallback(
    async (id: number, body: UpdateMemoryBody) => {
      if (conversationId == null) return;
      // Guard against callers passing undefined/null ids (e.g. an item that
      // hasn't fully hydrated, or whose id field arrived under a different
      // casing). Without this guard we end up firing PATCH .../memory/undefined
      // requests in a loop.
      if (id == null || !Number.isFinite(id)) return;
      const before = items;
      setItems((prev) =>
        prev.map((it) => (it.Id === id ? ({ ...it, ...body } as ChatMemoryItem) : it)),
      );
      try {
        const updated = await updateMemoryItem(conversationId, id, body);
        setItems((prev) => prev.map((it) => (it.Id === id ? updated : it)));
      } catch (err) {
        setItems(before);
        setError((err as Error)?.message ?? 'Failed to update memory item');
      }
    },
    [conversationId, items],
  );

  const remove = useCallback(
    async (id: number) => {
      if (conversationId == null) return;
      const before = items;
      setItems((prev) => prev.filter((it) => it.Id !== id));
      try {
        await deleteMemoryItem(conversationId, id);
      } catch (err) {
        setItems(before);
        setError((err as Error)?.message ?? 'Failed to delete memory item');
      }
    },
    [conversationId, items],
  );

  const accept = useCallback((id: number) => update(id, { status: 'active' }), [update]);
  const reject = useCallback((id: number) => update(id, { status: 'rejected' }), [update]);

  const acceptAllProposed = useCallback(async () => {
    if (conversationId == null) return;
    const proposed = items.filter(
      (it) => it.status === 'proposed' && it.Id != null && Number.isFinite(it.Id),
    );
    if (proposed.length === 0) return;
    const before = items;
    setItems((prev) =>
      prev.map((it) =>
        it.status === 'proposed' ? ({ ...it, status: 'active' } as ChatMemoryItem) : it,
      ),
    );
    try {
      await Promise.all(
        proposed.map((it) => updateMemoryItem(conversationId, it.Id, { status: 'active' })),
      );
    } catch (err) {
      setItems(before);
      setError((err as Error)?.message ?? 'Failed to accept all');
    }
  }, [conversationId, items]);

  const togglePin = useCallback(
    async (id: number) => {
      const item = items.find((it) => it.Id === id);
      if (!item) return;
      await update(id, { pinned: !item.pinned });
    },
    [items, update],
  );

  const runExtract = useCallback(async () => {
    if (conversationId == null) return null;
    setExtracting(true);
    setError(null);
    try {
      const res = await extractMemory(conversationId);
      setLastExtractDelta(res.persisted);
      await refresh();
      return res;
    } catch (err) {
      setError((err as Error)?.message ?? 'Extraction failed');
      return null;
    } finally {
      setExtracting(false);
    }
  }, [conversationId, refresh]);

  return {
    items,
    loading,
    error,
    extracting,
    lastExtractDelta,
    refresh,
    add,
    update,
    remove,
    accept,
    reject,
    acceptAllProposed,
    togglePin,
    runExtract,
  };
}
