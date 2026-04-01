import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowPathIcon,
  ChatBubbleLeftRightIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  UserCircleIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../components/ui';
import { buildAssetUrl } from '../config/appConfig';
import { formatRoleLabel } from '../utils/formatters';
import chatService from '../services/chatService';
import realtimeService from '../services/realtimeService';

const formatContactName = (user) => {
  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  return fullName || user?.username || 'Unknown user';
};

const formatMessageTime = (value) => {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return '';

  return new Date(timestamp).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

const formatRelativeConversationTime = (value) => {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) return '';

  const date = new Date(timestamp);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  if (sameDay) {
    return date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric'
  });
};

const matchConversation = (conversation, query) => {
  if (!query) return true;
  const normalizedQuery = query.toLowerCase();
  const user = conversation?.otherUser || {};
  const haystack = [
    formatContactName(user),
    user.username || '',
    user.email || '',
    formatRoleLabel(user.role, 'Player')
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(normalizedQuery);
};

const sortConversations = (items = []) => {
  return [...items].sort((leftItem, rightItem) => {
    const leftTime = Date.parse(leftItem?.lastMessageAt || leftItem?.updatedAt || leftItem?.createdAt || '') || 0;
    const rightTime = Date.parse(rightItem?.lastMessageAt || rightItem?.updatedAt || rightItem?.createdAt || '') || 0;
    return rightTime - leftTime;
  });
};

const mergeConversation = (items, nextConversation) => {
  const existing = Array.isArray(items) ? items : [];
  const nextItems = [...existing.filter((item) => Number(item.id) !== Number(nextConversation.id)), nextConversation];
  return sortConversations(nextItems);
};

const ChatPage = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [openingUserId, setOpeningUserId] = useState(null);
  const [sending, setSending] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState('');
  const [directoryUsers, setDirectoryUsers] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [lastMarkedConversationId, setLastMarkedConversationId] = useState(null);
  const deferredQuery = useDeferredValue(query.trim());
  const messagesEndRef = useRef(null);
  const workspaceBase = location.pathname.startsWith('/owner') ? '/owner' : '/app';

  const clearRouteParams = useCallback(
    (keys = []) => {
      const nextParams = new URLSearchParams(searchParams);
      keys.forEach((key) => nextParams.delete(key));
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const activeConversation = useMemo(
    () => conversations.find((item) => Number(item.id) === Number(activeConversationId)) || null,
    [conversations, activeConversationId]
  );

  const filteredConversations = useMemo(() => {
    return sortConversations(conversations.filter((conversation) => matchConversation(conversation, deferredQuery)));
  }, [conversations, deferredQuery]);

  const availableDirectoryUsers = useMemo(() => {
    const existingConversationIds = new Set(
      conversations
        .map((conversation) => Number(conversation?.otherUser?.id))
        .filter((value) => Number.isInteger(value) && value > 0)
    );

    const filtered = directoryUsers.filter((person) => !existingConversationIds.has(Number(person.id)));
    return deferredQuery ? filtered.slice(0, 12) : filtered.slice(0, 8);
  }, [conversations, deferredQuery, directoryUsers]);

  const updateConversationFromSummary = useCallback((summary) => {
    if (!summary?.id) return;
    setConversations((current) => mergeConversation(current, summary));
  }, []);

  const loadConversations = useCallback(
    async ({ preserveSelection = true, silent = false } = {}) => {
      try {
        if (!silent) {
          setLoadingConversations(true);
        }
        setError('');
        const response = await chatService.getConversations();
        const nextConversations = sortConversations(Array.isArray(response.data) ? response.data : []);

        setConversations(nextConversations);
        setActiveConversationId((current) => {
          if (preserveSelection && current && nextConversations.some((item) => Number(item.id) === Number(current))) {
            return current;
          }
          return nextConversations[0]?.id || null;
        });
      } catch (loadError) {
        setError(loadError.error || t('chat_load_failed', 'Failed to load chats.'));
      } finally {
        if (!silent) {
          setLoadingConversations(false);
        }
      }
    },
    [t]
  );

  const loadMessages = useCallback(
    async (conversationId, { silent = false } = {}) => {
      if (!conversationId) {
        setMessages([]);
        return;
      }

      try {
        if (!silent) {
          setLoadingMessages(true);
        }
        setError('');
        const response = await chatService.getMessages(conversationId, { limit: 80 });
        const payload = response.data || {};
        const nextMessages = Array.isArray(payload.messages) ? payload.messages : [];
        const summary = payload.conversation;

        setMessages(nextMessages);
        if (summary?.id) {
          updateConversationFromSummary(summary);
          if (Number(summary.unreadCount || 0) > 0 && Number(lastMarkedConversationId) !== Number(summary.id)) {
            const readResponse = await chatService.markRead(summary.id);
            const readAt = readResponse?.data?.readAt || new Date().toISOString();
            setMessages((current) =>
              current.map((message) =>
                Number(message.recipientId) === Number(user?.id) && !message.readAt
                  ? { ...message, readAt }
                  : message
              )
            );
            setConversations((current) =>
              current.map((conversation) =>
                Number(conversation.id) === Number(summary.id)
                  ? {
                      ...conversation,
                      unreadCount: 0,
                      lastMessage:
                        conversation.lastMessage && Number(conversation.lastMessage.recipientId) === Number(user?.id)
                          ? { ...conversation.lastMessage, readAt }
                          : conversation.lastMessage
                    }
                  : conversation
              )
            );
            setLastMarkedConversationId(summary.id);
          }
        }
      } catch (loadError) {
        setError(loadError.error || t('chat_messages_failed', 'Failed to load messages.'));
      } finally {
        if (!silent) {
          setLoadingMessages(false);
        }
      }
    },
    [lastMarkedConversationId, t, updateConversationFromSummary, user?.id]
  );

  const loadDirectoryUsers = useCallback(
    async (searchValue = '') => {
      try {
        setSearchingUsers(true);
        const response = await chatService.searchUsers(searchValue, {
          limit: searchValue ? 12 : 24
        });
        setDirectoryUsers(Array.isArray(response.data) ? response.data : []);
      } catch (_) {
        setDirectoryUsers([]);
      } finally {
        setSearchingUsers(false);
      }
    },
    []
  );

  const openConversationWithUser = useCallback(
    async (targetUserId, { focusComposer = true } = {}) => {
      if (!targetUserId) return;

      try {
        setOpeningUserId(Number(targetUserId));
        setError('');
        const response = await chatService.openConversation(targetUserId);
        const summary = response.data;
        if (!summary?.id) return;

        setActiveConversationId(summary.id);
        updateConversationFromSummary(summary);
        setLastMarkedConversationId(null);
        await loadMessages(summary.id);
        if (focusComposer) {
          window.setTimeout(() => {
            const composer = document.getElementById('chat-composer');
            composer?.focus();
          }, 30);
        }
      } catch (openError) {
        const message = openError.error || t('chat_open_failed', 'Failed to open chat.');
        setError(message);
        showToast(message, { type: 'error' });
      } finally {
        setOpeningUserId(null);
      }
    },
    [loadMessages, showToast, t, updateConversationFromSummary]
  );

  const handleSendMessage = async () => {
    const trimmed = draft.trim();
    if (!trimmed || !activeConversationId || sending) return;

    try {
      setSending(true);
      setError('');
      const response = await chatService.sendMessage(activeConversationId, trimmed);
      const payload = response.data || {};
      const nextMessage = payload.message;
      const summary = payload.conversation;

      if (nextMessage?.id) {
        setMessages((current) => [...current, nextMessage]);
      }
      if (summary?.id) {
        updateConversationFromSummary(summary);
      }
      setDraft('');
    } catch (sendError) {
      const message = sendError.error || t('chat_send_failed', 'Failed to send message.');
      setError(message);
      showToast(message, { type: 'error' });
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    loadConversations({ preserveSelection: false });
  }, [loadConversations]);

  useEffect(() => {
    loadDirectoryUsers(deferredQuery);
  }, [deferredQuery, loadDirectoryUsers]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    setLastMarkedConversationId(null);
    loadMessages(activeConversationId);
  }, [activeConversationId, loadMessages]);

  useEffect(() => {
    const routeUserId = Number(searchParams.get('user'));
    const routeConversationId = Number(searchParams.get('conversation'));

    if (Number.isInteger(routeUserId) && routeUserId > 0) {
      openConversationWithUser(routeUserId).finally(() => {
        clearRouteParams(['user', 'conversation']);
      });
      return;
    }

    if (Number.isInteger(routeConversationId) && routeConversationId > 0) {
      setActiveConversationId(routeConversationId);
      clearRouteParams(['conversation']);
    }
  }, [clearRouteParams, openConversationWithUser, searchParams]);

  useEffect(() => {
    const unsubscribe = realtimeService.subscribe((event) => {
      if (!event?.event || !String(event.event).startsWith('chat:')) return;

      loadConversations({ silent: true });

      const realtimeConversationId = Number(event.payload?.conversationId);
      if (activeConversationId && realtimeConversationId === Number(activeConversationId)) {
        loadMessages(activeConversationId, { silent: true });
      }
    });

    return unsubscribe;
  }, [activeConversationId, loadConversations, loadMessages]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadConversations({ silent: true });
      if (activeConversationId) {
        loadMessages(activeConversationId, { silent: true });
      }
    }, 20000);

    return () => window.clearInterval(interval);
  }, [activeConversationId, loadConversations, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeConversationId, messages.length]);

  const handleConversationSelect = (conversationId) => {
    setActiveConversationId(conversationId);
    setLastMarkedConversationId(null);
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_38%),linear-gradient(135deg,_#ffffff_0%,_#f8fafc_55%,_#ecfdf5_100%)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 ring-1 ring-emerald-100">
              <ChatBubbleLeftRightIcon className="h-4 w-4" />
              {t('nav_chat', 'Chat')}
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
              {t('chat_title', 'Talk with players, captains, owners, and admins')}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
              {t(
                'chat_subtitle',
                'Search any account, open a direct conversation, and keep all football coordination in one place.'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              loadConversations();
              if (activeConversationId) {
                loadMessages(activeConversationId, { silent: true });
              }
            }}
            className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:text-emerald-700"
          >
            <ArrowPathIcon className="h-4 w-4" />
            {t('chat_refresh', 'Refresh')}
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <label className="relative block">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('chat_search_placeholder', 'Search users or conversations')}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
              />
            </label>
          </div>

          <div className="space-y-5 px-5 py-5">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">{t('chat_existing_chats', 'Chats')}</h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                  {filteredConversations.length}
                </span>
              </div>
              <div className="space-y-2">
                {loadingConversations ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    {t('chat_loading_conversations', 'Loading conversations...')}
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    {t('chat_no_conversations', 'No conversations yet. Start one from the people list below.')}
                  </div>
                ) : (
                  filteredConversations.map((conversation) => {
                    const contact = conversation.otherUser || {};
                    const isActive = Number(conversation.id) === Number(activeConversationId);
                    return (
                      <button
                        key={conversation.id}
                        type="button"
                        onClick={() => handleConversationSelect(conversation.id)}
                        className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                          isActive
                            ? 'border-emerald-200 bg-emerald-50 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <img
                          src={buildAssetUrl(contact.avatarUrl)}
                          alt={`${formatContactName(contact)} avatar`}
                          className="h-12 w-12 rounded-2xl border border-slate-200 bg-slate-100 object-cover"
                          onError={(event) => {
                            const fallbackUrl = buildAssetUrl();
                            if (event.currentTarget.src !== fallbackUrl) {
                              event.currentTarget.src = fallbackUrl;
                            }
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900">{formatContactName(contact)}</p>
                              <p className="mt-0.5 truncate text-xs text-slate-500">
                                @{contact.username || 'user'} · {formatRoleLabel(contact.role, 'Player')}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-[11px] text-slate-400">
                                {formatRelativeConversationTime(conversation.lastMessageAt)}
                              </span>
                              {Number(conversation.unreadCount || 0) > 0 ? (
                                <span className="inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                                  {conversation.unreadCount}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <p className="mt-2 truncate text-xs text-slate-500">
                            {conversation.lastMessage?.body || t('chat_start_prompt', 'Start the conversation')}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">{t('chat_people', 'People you can chat with')}</h2>
                {searchingUsers ? (
                  <span className="text-[11px] font-semibold text-slate-400">{t('common_loading', 'Loading...')}</span>
                ) : null}
              </div>
              <div className="space-y-2">
                {availableDirectoryUsers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    {t('chat_no_people', 'No people found for this search.')}
                  </div>
                ) : (
                  availableDirectoryUsers.map((person) => {
                    const isOpening = Number(openingUserId) === Number(person.id);
                    return (
                      <div
                        key={person.id}
                        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3"
                      >
                        <img
                          src={buildAssetUrl(person.avatarUrl)}
                          alt={`${formatContactName(person)} avatar`}
                          className="h-11 w-11 rounded-2xl border border-slate-200 bg-white object-cover"
                          onError={(event) => {
                            const fallbackUrl = buildAssetUrl();
                            if (event.currentTarget.src !== fallbackUrl) {
                              event.currentTarget.src = fallbackUrl;
                            }
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">{formatContactName(person)}</p>
                          <p className="truncate text-xs text-slate-500">
                            @{person.username || 'user'} · {formatRoleLabel(person.role, 'Player')}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={isOpening}
                          onClick={() => openConversationWithUser(person.id)}
                          className="inline-flex items-center rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isOpening ? t('common_loading', 'Loading...') : t('chat_start_button', 'Chat')}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </aside>

        <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
          {!activeConversation ? (
            <div className="flex min-h-[640px] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-emerald-50 text-emerald-600">
                <ChatBubbleLeftRightIcon className="h-10 w-10" />
              </div>
              <h2 className="mt-6 text-2xl font-black text-slate-950">{t('chat_empty_title', 'Select a chat')}</h2>
              <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
                {t(
                  'chat_empty_description',
                  'Pick an existing conversation or search for a player, captain, owner, or admin to start messaging.'
                )}
              </p>
              <button
                type="button"
                onClick={() => navigate(`${workspaceBase}/profile`)}
                className="mt-6 inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700"
              >
                <UserCircleIcon className="h-4 w-4" />
                {t('chat_open_profile', 'Open my profile')}
              </button>
            </div>
          ) : (
            <div className="flex min-h-[640px] flex-col">
              <header className="border-b border-slate-200 bg-[linear-gradient(135deg,_#ffffff_0%,_#f8fafc_60%,_#ecfdf5_100%)] px-6 py-5">
                <div className="flex items-center gap-4">
                  <img
                    src={buildAssetUrl(activeConversation.otherUser?.avatarUrl)}
                    alt={`${formatContactName(activeConversation.otherUser)} avatar`}
                    className="h-14 w-14 rounded-[22px] border border-slate-200 bg-white object-cover"
                    onError={(event) => {
                      const fallbackUrl = buildAssetUrl();
                      if (event.currentTarget.src !== fallbackUrl) {
                        event.currentTarget.src = fallbackUrl;
                      }
                    }}
                  />
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-black text-slate-950">
                      {formatContactName(activeConversation.otherUser)}
                    </h2>
                    <p className="truncate text-sm text-slate-500">
                      @{activeConversation.otherUser?.username || 'user'} ·{' '}
                      {formatRoleLabel(activeConversation.otherUser?.role, 'Player')}
                    </p>
                  </div>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,_#f8fafc_0%,_#ffffff_55%,_#f8fafc_100%)] px-6 py-6">
                {loadingMessages ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    {t('chat_loading_messages', 'Loading messages...')}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-slate-100 text-slate-400">
                      <ChatBubbleLeftRightIcon className="h-8 w-8" />
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-slate-900">{t('chat_no_messages_title', 'No messages yet')}</h3>
                    <p className="mt-2 max-w-sm text-sm text-slate-500">
                      {t('chat_no_messages_description', 'Send the first message to start coordinating with this user.')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[78%] rounded-[24px] px-4 py-3 shadow-sm ${
                            message.isOwn
                              ? 'bg-slate-900 text-white'
                              : 'border border-slate-200 bg-white text-slate-800'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
                          <div
                            className={`mt-2 flex items-center justify-end gap-2 text-[11px] ${
                              message.isOwn ? 'text-slate-300' : 'text-slate-400'
                            }`}
                          >
                            <span>{formatMessageTime(message.createdAt)}</span>
                            {message.isOwn ? (
                              <span>{message.readAt ? t('chat_read', 'Read') : t('chat_sent', 'Sent')}</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <footer className="border-t border-slate-200 bg-white px-6 py-5">
                <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-3">
                  <textarea
                    id="chat-composer"
                    rows={3}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={t('chat_compose_placeholder', 'Write a message and press Enter to send')}
                    className="w-full resize-none border-0 bg-transparent px-2 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  />
                  <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-2 pt-3">
                    <p className="text-xs text-slate-400">
                      {t('chat_compose_hint', 'Use Shift + Enter for a new line.')}
                    </p>
                    <button
                      type="button"
                      disabled={sending || !draft.trim()}
                      onClick={handleSendMessage}
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <PaperAirplaneIcon className="h-4 w-4" />
                      {sending ? t('common_saving', 'Saving...') : t('action_send', 'Send')}
                    </button>
                  </div>
                </div>
              </footer>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ChatPage;
