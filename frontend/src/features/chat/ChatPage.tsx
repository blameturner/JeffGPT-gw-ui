import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ChatBubble } from '../../components/chat/ChatBubble';
import { ComposerDock } from '../../components/ComposerDock';
import { Sheet } from '../../components/Sheet';
import { styleLabel } from '../../lib/styles/styleLabel';
import { useWasRecentlyHidden } from '../../hooks/useWasRecentlyHidden';
import { SidebarBody } from './SidebarBody';
import { ChatHeader } from './components/ChatHeader';
import { PropertiesDrawer } from './components/PropertiesDrawer';
import { SearchModeSelector } from './components/SearchModeSelector';
import { useAutoScrollToBottom } from './hooks/useAutoScrollToBottom';
import { useChatConfig } from './hooks/useChatConfig';
import { useConversations } from './hooks/useConversations';
import { useChat } from './hooks/useChat';
import { useStreamRecovery } from './hooks/useStreamRecovery';
import { useChatMemory } from './hooks/useChatMemory';
import { useConversationProperties } from './hooks/useConversationProperties';
import { loadSearchMode, saveSearchMode } from './lib/searchModeStorage';
import { SavedFragmentsMenu } from './components/SavedFragmentsMenu';
import { AttachContextMenu, AttachmentChips } from './components/AttachContextMenu';
import { MessageActions } from './components/MessageActions';
import type { SavedFragment } from '../../api/types/SavedFragment';

const EMPTY_STATE_PROMPTS = [
  'Summarise the last week of my work',
  'Help me plan a focused day',
  'Explain something I should understand by now',
];

export function ChatPage() {
  const navigate = useNavigate();
  void navigate; // available for future use (logout etc.)

  const vis = useWasRecentlyHidden();

  const config = useChatConfig();
  const convs = useConversations();

  const activeIdRef = useRef(convs.activeId);
  activeIdRef.current = convs.activeId;

  const chat = useChat({
    activeId: convs.activeId,
    activeIdRef,
    model: config.model,
    styleKey: config.styleKey,
    searchMode: config.searchMode,
    ragEnabled: config.ragEnabled,
    knowledgeEnabled: config.knowledgeEnabled,
    polishPass: config.polishPass,
    getAttachedUrls: () => config.attachedUrls,
    clearAttachments: config.clearAttachments,
    setActiveId: convs.setActiveId,
    setConversations: convs.setConversations,
    setConversationTopics: convs.setConversationTopics,
    visIsHidden: vis.isHidden,
    visJustResumed: vis.justResumed,
  });

  // Load persisted search mode when the active conversation changes.
  useEffect(() => {
    config.setSearchMode(loadSearchMode(convs.activeId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convs.activeId]);

  const recovery = useStreamRecovery({
    activeIdRef,
    model: config.model,
    setActiveId: convs.setActiveId,
    setModel: config.setModel as (m: string) => void,
    setModels: config.setModels,
    setMessages: chat.setMessages,
    setSending: chat.setSending,
    setConversations: convs.setConversations,
    setLoadingConversations: convs.setLoadingConversations,
    setError: chat.setError,
    setChatStyles: config.setChatStyles,
    setStyleKey: config.setStyleKey as (v: string) => void,
    setConversationTopics: convs.setConversationTopics,
    streamAbortRef: chat.streamAbortRef,
    processStream: chat.processStream,
  });

  // Sync grounding from stats
  useEffect(() => {
    if (convs.stats?.conversation && 'contextual_grounding_enabled' in convs.stats.conversation) {
      config.setGrounding(
        (convs.stats.conversation as { contextual_grounding_enabled?: boolean })
          .contextual_grounding_enabled !== false,
      );
    }
  }, [convs.stats]);

  const properties = useConversationProperties(
    convs.activeId,
    convs.activeConversation,
    (patch) => {
      // Reflect patched fields into the local conversations list so subsequent reads see them.
      if (convs.activeId == null) return;
      convs.setConversations((prev) =>
        prev.map((c) =>
          c.Id === convs.activeId ? { ...c, ...patch } : c,
        ),
      );
      if ('contextual_grounding_enabled' in patch && patch.contextual_grounding_enabled != null) {
        config.setGrounding(patch.contextual_grounding_enabled);
      }
      if ('default_response_style' in patch && patch.default_response_style) {
        config.setStyleKey(patch.default_response_style);
      }
      if ('model' in patch && patch.model) {
        config.setModel(patch.model);
      }
      if ('polish_pass_default' in patch && patch.polish_pass_default != null) {
        config.setPolishPass(patch.polish_pass_default);
      }
    },
  );

  const memory = useChatMemory(convs.activeId);

  // Apply per-conversation defaults when the conversation changes.
  useEffect(() => {
    const c = convs.activeConversation;
    if (!c) return;
    if (c.polish_pass_default != null) config.setPolishPass(c.polish_pass_default);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convs.activeId]);

  const [memoryFocusToken, setMemoryFocusToken] = useState<number | undefined>(undefined);

  const { scrollRef, isAtBottom, scrollToBottom } = useAutoScrollToBottom(chat.messages);

  const newChatOpts = {
    setMessages: chat.setMessages,
    setError: chat.setError,
    clearRetryTimer: recovery.clearRetryTimer,
  };

  function changeSearchMode(mode: typeof config.searchMode) {
    config.setSearchMode(mode);
    saveSearchMode(convs.activeId, mode);
  }

  async function handleConsentRun(m: import('../../components/chat/DisplayMessage').DisplayMessage) {
    if (!m.sourceUserText) return;
    await chat.retryWithConsent({
      pendingAssistantId: m.id,
      userText: m.sourceUserText,
      mode: config.searchMode,
      confirmed: true,
    });
  }

  async function handleConsentSkip(m: import('../../components/chat/DisplayMessage').DisplayMessage) {
    if (!m.sourceUserText) return;
    changeSearchMode('disabled');
    await chat.retryWithConsent({
      pendingAssistantId: m.id,
      userText: m.sourceUserText,
      mode: 'disabled',
      confirmed: false,
    });
  }

  return (
    <>
    <div className="h-full flex bg-bg text-fg">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-80 border-r border-border bg-panel/60 flex-col">
        <SidebarBody
          onNewChat={() => convs.newChat(newChatOpts)}
          conversations={convs.conversations}
          activeId={convs.activeId}
          onSelect={(c) => void convs.selectConversation(c, {
            model: config.model,
            chatStyles: config.chatStyles,
            setStyleKey: config.setStyleKey,
            setMessages: chat.setMessages,
            setError: chat.setError,
            scheduleRetry: recovery.scheduleRetry,
            setModel: config.setModel,
          })}
          loading={convs.loadingConversations}
        />
      </aside>

      {/* Mobile sidebar sheet */}
      <Sheet
        open={convs.sidebarOpen}
        side="left"
        onClose={() => convs.setSidebarOpen(false)}
        label="Conversations"
      >
        <SidebarBody
          onNewChat={() => {
            convs.newChat(newChatOpts);
            convs.setSidebarOpen(false);
          }}
          conversations={convs.conversations}
          activeId={convs.activeId}
          onSelect={(c) => {
            void convs.selectConversation(c, {
              model: config.model,
              chatStyles: config.chatStyles,
              setStyleKey: config.setStyleKey,
              setMessages: chat.setMessages,
              setError: chat.setError,
              scheduleRetry: recovery.scheduleRetry,
              setModel: config.setModel,
            });
            convs.setSidebarOpen(false);
          }}
          loading={convs.loadingConversations}
        />
      </Sheet>

      <main className="flex-1 flex flex-col min-w-0">
        <ChatHeader
          activeConversation={convs.activeConversation}
          conversationTopics={convs.conversationTopics}
          onOpenSidebar={() => convs.setSidebarOpen(true)}
          drawerOpen={convs.drawerOpen}
          onToggleDrawer={() => convs.setDrawerOpen((v) => !v)}
        />

        {/* Message list */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-6 py-6 md:py-10">
          <div className="max-w-3xl mx-auto space-y-5">
            {chat.messages.length === 0 ? (
              <div className="pt-16 md:pt-20 text-center px-2">
                <p className="font-display text-3xl md:text-4xl font-semibold tracking-tightest leading-tight">
                  Ask Jeffy anything.
                </p>
                <p className="text-muted text-sm mt-3 font-sans">
                  {config.model ? `Model \u00b7 ${config.model}` : 'Select a Jeff to begin'}
                </p>
                {config.model && (
                  <div className="mt-8 flex flex-wrap justify-center gap-2">
                    {EMPTY_STATE_PROMPTS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => chat.setInput(p)}
                        className="text-[12px] sm:text-[13px] font-sans px-3 py-1.5 rounded-full border border-border text-muted bg-panel/40 hover:border-fg hover:text-fg transition-colors"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              chat.messages.map((m) => (
                <div key={m.id} className="group relative space-y-1">
                  <ChatBubble
                    message={m}
                    onConsentRun={handleConsentRun}
                    onConsentSkip={handleConsentSkip}
                    onRetry={(mm) => {
                      if (!mm.sourceUserText) return;
                      chat.setMessages((ms) => {
                        const idx = ms.findIndex((x) => x.id === mm.id);
                        if (idx <= 0) return ms.filter((x) => x.id !== mm.id);
                        const prev = ms[idx - 1];
                        const toDrop = new Set([mm.id]);
                        if (prev?.role === 'user') toDrop.add(prev.id);
                        return ms.filter((x) => !toDrop.has(x.id));
                      });
                      void chat.send(mm.sourceUserText);
                    }}
                    onEdit={
                      m.role === 'user' && !chat.sending
                        ? (mm) => {
                            chat.setMessages((ms) => {
                              const idx = ms.findIndex((x) => x.id === mm.id);
                              if (idx < 0) return ms;
                              const toDrop = new Set([mm.id]);
                              const next = ms[idx + 1];
                              if (next && next.role === 'assistant') toDrop.add(next.id);
                              return ms.filter((x) => !toDrop.has(x.id));
                            });
                            chat.setInput(mm.content);
                          }
                        : undefined
                    }
                  />
                  <MessageActions
                    message={m}
                    sending={chat.sending}
                    memory={memory}
                    onRefine={(prompt) => void chat.send(prompt)}
                    onReroll={() => {
                      if (!m.sourceUserText) return;
                      chat.setMessages((ms) => {
                        const idx = ms.findIndex((x) => x.id === m.id);
                        if (idx < 0) return ms;
                        const prev = ms[idx - 1];
                        const toDrop = new Set([m.id]);
                        if (prev?.role === 'user') toDrop.add(prev.id);
                        return ms.filter((x) => !toDrop.has(x.id));
                      });
                      void chat.send(m.sourceUserText);
                    }}
                    onFork={() => {
                      // Lightweight fork: copy content of this message to a new chat as the input.
                      convs.newChat(newChatOpts);
                      chat.setInput(`Continuing from a previous chat:\n\n${m.content}`);
                    }}
                    onPin={(body) => {
                      void memory.add({
                        category: body.category,
                        text: body.text,
                        pinned: body.pinned,
                        status: 'active',
                      });
                    }}
                  />
                  {m.role === 'assistant' && m.status === 'complete' && m.responseStyle && (
                    <div className="flex justify-start">
                      <span className="text-[9px] font-sans uppercase tracking-[0.14em] text-muted pl-5 inline-flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-fg/50" />
                        {styleLabel(m.responseStyle)}
                      </span>
                    </div>
                  )}
                  {m.role === 'assistant' && m.status === 'complete' && memory.items.some((it) => it.pinned && it.status === 'active') && (
                    <div className="flex justify-start">
                      <button
                        type="button"
                        onClick={() => {
                          convs.setDrawerOpen(true);
                          setMemoryFocusToken(Date.now());
                        }}
                        className="text-[9px] font-sans uppercase tracking-[0.14em] text-muted hover:text-fg pl-5 inline-flex items-center gap-1"
                        title="Open chat memory"
                      >
                        📌 memory · {memory.items.filter((it) => it.pinned && it.status === 'active').length} item{memory.items.filter((it) => it.pinned && it.status === 'active').length === 1 ? '' : 's'} pinned
                      </button>
                    </div>
                  )}
                  {m.role === 'assistant' && m.status === 'complete' && m.contextChars != null && (
                    <div className="flex justify-start">
                      <span className="text-[10px] font-sans uppercase tracking-[0.14em] text-muted pl-5">
                        Memory \u00b7 {m.contextChars.toLocaleString()} chars of context
                        {m.tokensOut != null && (
                          <span className="ml-2">\u00b7 {m.tokensOut.toLocaleString()} tok out</span>
                        )}
                      </span>
                    </div>
                  )}
                  {m.role === 'assistant' &&
                    m.status === 'complete' &&
                    m.contextChars == null &&
                    m.tokensOut != null && (
                      <div className="flex justify-start">
                        <span className="text-[10px] font-sans uppercase tracking-[0.14em] text-muted pl-5">
                          {m.tokensOut.toLocaleString()} tok out
                          {m.tokensIn != null && (
                            <span className="ml-2">\u00b7 {m.tokensIn.toLocaleString()} in</span>
                          )}
                        </span>
                      </div>
                    )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Jump to bottom */}
        {!isAtBottom && chat.messages.length > 0 && (
          <div className="px-3 sm:px-6 pb-2 pointer-events-none">
            <div className="max-w-3xl mx-auto flex justify-center">
              <button
                type="button"
                onClick={() => scrollToBottom(true)}
                className="pointer-events-auto text-[11px] uppercase tracking-[0.14em] font-sans px-3 py-1.5 rounded-full border border-border bg-panel/90 backdrop-blur text-fg hover:bg-panelHi transition-colors flex items-center gap-1.5 shadow-card"
                aria-label="Jump to latest"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                Jump to latest
              </button>
            </div>
          </div>
        )}

        {/* Error banner */}
        {chat.error && (
          <div className="px-3 sm:px-6 pb-2">
            <div className="max-w-3xl mx-auto">
              <p className="text-xs text-red-600 font-sans break-words">{chat.error}</p>
            </div>
          </div>
        )}

        {/* Composer */}
        <ComposerDock
          value={chat.input}
          onChange={chat.setInput}
          onSend={() => void chat.send()}
          onStop={() => { chat.streamAbortRef.current?.abort(); }}
          sending={chat.sending}
          disabled={!config.model}
          placeholder={config.model ? 'Message JeffGPT\u2026' : 'Load a Jeff to start'}
          models={config.models}
          model={config.model}
          onModelChange={config.setModel}
          styles={config.chatStyles?.styles}
          styleKey={config.styleKey}
          onStyleChange={(k) => {
            config.setStyleKey(k);
            if (convs.activeId != null) {
              try { window.localStorage.setItem(`chatStyle:${convs.activeId}`, k); } catch {}
            }
          }}
          toggles={config.buildToggles(convs.activeId)}
          searchSlot={
            <SearchModeSelector
              value={config.searchMode}
              onChange={changeSearchMode}
            />
          }
          composerStartSlot={
            <AttachContextMenu
              attachedFiles={config.attachedFiles}
              attachedUrls={config.attachedUrls}
              onAddFiles={(f) => config.setAttachedFiles([...config.attachedFiles, ...f])}
              onAddUrl={(u) => config.setAttachedUrls([...config.attachedUrls, u])}
              onRemoveFile={(i) =>
                config.setAttachedFiles(config.attachedFiles.filter((_, idx) => idx !== i))
              }
              onRemoveUrl={(i) =>
                config.setAttachedUrls(config.attachedUrls.filter((_, idx) => idx !== i))
              }
            />
          }
          composerEndSlot={
            <SavedFragmentsMenu
              fragments={(properties.values.saved_fragments_json ?? []) as SavedFragment[]}
              onInsert={(text) => chat.setInput(chat.input ? `${chat.input}\n${text}` : text)}
              onAdd={(frag) => {
                const next = [
                  ...((properties.values.saved_fragments_json ?? []) as SavedFragment[]),
                  frag,
                ];
                properties.setField('saved_fragments_json', next);
              }}
              disabled={convs.activeId == null}
            />
          }
          onComposerKeyDown={(e) => {
            if (e.key === 'Escape' && (config.attachedFiles.length || config.attachedUrls.length)) {
              e.preventDefault();
              config.clearAttachments();
              return true;
            }
            return false;
          }}
          attachmentPreview={
            <AttachmentChips
              attachedFiles={config.attachedFiles}
              attachedUrls={config.attachedUrls}
              onRemoveFile={(i) =>
                config.setAttachedFiles(config.attachedFiles.filter((_, idx) => idx !== i))
              }
              onRemoveUrl={(i) =>
                config.setAttachedUrls(config.attachedUrls.filter((_, idx) => idx !== i))
              }
            />
          }
        />
      </main>

      {/* Properties drawer */}
      {convs.drawerOpen && (
        <PropertiesDrawer
          activeId={convs.activeId}
          activeConversation={convs.activeConversation}
          searchMode={config.searchMode}
          properties={properties}
          memory={memory}
          styles={config.chatStyles}
          models={config.models}
          stats={convs.stats}
          loadingStats={convs.loadingStats}
          refreshStats={() => void convs.refreshStats()}
          renameTitle={convs.renameTitle}
          setRenameTitle={convs.setRenameTitle}
          renaming={convs.renaming}
          renameError={convs.renameError}
          saveRename={() => void convs.saveRename()}
          deleteChat={() => void convs.deleteChat(newChatOpts)}
          activeTitle={convs.activeConversation?.title ?? ''}
          onClose={() => convs.setDrawerOpen(false)}
          scrollToMemoryToken={memoryFocusToken}
        />
      )}
    </div>
    </>
  );
}
