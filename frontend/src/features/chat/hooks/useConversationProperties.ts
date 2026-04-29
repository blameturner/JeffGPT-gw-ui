import { useCallback, useEffect, useRef, useState } from 'react';
import { patchConversation } from '../../../api/chat/patchConversation';
import type { ConversationProperties } from '../../../api/types/ConversationProperties';
import type { Conversation } from '../../../api/types/Conversation';

const DEFAULTS: Required<
  Pick<
    ConversationProperties,
    | 'system_note'
    | 'default_response_style'
    | 'polish_pass_default'
    | 'strict_grounding_default'
    | 'ask_back_default'
    | 'memory_extract_every_n_turns'
    | 'memory_token_budget'
  >
> = {
  system_note: '',
  default_response_style: '',
  polish_pass_default: false,
  strict_grounding_default: false,
  ask_back_default: false,
  memory_extract_every_n_turns: 6,
  memory_token_budget: 800,
};

export interface ConversationPropertiesState {
  values: ConversationProperties;
  setField: <K extends keyof ConversationProperties>(
    key: K,
    value: ConversationProperties[K],
  ) => void;
  saving: boolean;
  savedAt: number | null;
  error: string | null;
  flush: () => Promise<void>;
}

function pickProperties(c: Conversation | null | undefined): ConversationProperties {
  if (!c) return { ...DEFAULTS };
  return {
    title: c.title,
    contextual_grounding_enabled: c.contextual_grounding_enabled,
    system_note: c.system_note ?? DEFAULTS.system_note,
    default_response_style: c.default_response_style ?? DEFAULTS.default_response_style,
    polish_pass_default: c.polish_pass_default ?? DEFAULTS.polish_pass_default,
    strict_grounding_default: c.strict_grounding_default ?? DEFAULTS.strict_grounding_default,
    ask_back_default: c.ask_back_default ?? DEFAULTS.ask_back_default,
    memory_extract_every_n_turns:
      c.memory_extract_every_n_turns ?? DEFAULTS.memory_extract_every_n_turns,
    memory_token_budget: c.memory_token_budget ?? DEFAULTS.memory_token_budget,
    saved_fragments_json: c.saved_fragments_json ?? [],
    rag_enabled: c.rag_enabled,
    rag_collection: c.rag_collection,
    knowledge_enabled: c.knowledge_enabled,
    model: c.model,
  };
}

export function useConversationProperties(
  conversationId: number | null,
  source: Conversation | null | undefined,
  onPersisted?: (patch: ConversationProperties) => void,
): ConversationPropertiesState {
  const [values, setValues] = useState<ConversationProperties>(() => pickProperties(source));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<ConversationProperties>({});
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    setValues(pickProperties(source));
    pendingRef.current = {};
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, [conversationId, source]);

  const flush = useCallback(async () => {
    if (conversationId == null) return;
    if (Object.keys(pendingRef.current).length === 0) return;
    const patch = pendingRef.current;
    pendingRef.current = {};
    setSaving(true);
    setError(null);
    try {
      await patchConversation(conversationId, patch);
      setSavedAt(Date.now());
      onPersisted?.(patch);
    } catch (err) {
      setError((err as Error)?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [conversationId, onPersisted]);

  const setField = useCallback(
    <K extends keyof ConversationProperties>(key: K, value: ConversationProperties[K]) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      pendingRef.current = { ...pendingRef.current, [key]: value };
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null;
        void flush();
      }, 500);
    },
    [flush],
  );

  return { values, setField, saving, savedAt, error, flush };
}
