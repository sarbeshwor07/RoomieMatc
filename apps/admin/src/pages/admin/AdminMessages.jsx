/**
 * AdminMessages.jsx — Administrator Real-Time Messaging Center
 *
 * Powered by Socket.io and useMessages.
 * Allows administrators to communicate directly with users (tenants and property owners).
 * - Live real-time messaging without manual refresh
 * - Unread message counters and read receipts
 * - Typing indicators
 * - Direct deep-linking to user profile and property registry
 * - Supports ?thread=<convId> URL search query
 */
import React, { useState, useContext, useEffect, useRef, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { AuthContext } from "@shared/context/AuthContext";
import { SocketContext } from "@shared/context/SocketContext";
import { useMessages } from "@shared/hooks/useMessages";
import { apiListUsers, apiSendBroadcast } from "@shared/services/api";
import { Modal } from "@shared/components/common/Modal";
import Avatar from "@shared/components/common/Avatar";
import Button from "@shared/components/common/Button";

export const AdminMessages = () => {
  const { currentUser } = useContext(AuthContext);
  const { isConnected, typingUsers, sendTyping } = useContext(SocketContext);
  const {
    threads,
    loadingConversations,
    activeMessages,
    loadingMessages,
    openConversation,
    sendMessage,
    getThread,
    getOrCreateThread,
    reloadConversations,
  } = useMessages();

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeThreadId, setActiveThreadId] = useState("");
  const [inputText, setInputText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [typingTimeout, setTypingTimeout] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // ── Platform user search state (when searching in sidebar) ───────────────
  const [matchingUsers, setMatchingUsers] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  // ── Start New Chat Modal state ──────────────────────────────────────────
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [loadingAllUsers, setLoadingAllUsers] = useState(false);
  const [userModalSearch, setUserModalSearch] = useState("");
  const [startingChatUserId, setStartingChatUserId] = useState(null);

  // ── Broadcast Modal state ───────────────────────────────────────────────
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastTarget, setBroadcastTarget] = useState("all");
  const [broadcastNotif, setBroadcastNotif] = useState(true);
  const [broadcastChat, setBroadcastChat] = useState(true);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastFeedback, setBroadcastFeedback] = useState("");

  // Open thread from URL param or default to first thread
  useEffect(() => {
    const threadParam = searchParams.get("thread");
    if (threadParam && threadParam !== activeThreadId) {
      setActiveThreadId(threadParam);
      openConversation(threadParam);
    } else if (!threadParam && threads.length > 0 && !activeThreadId) {
      const firstId = threads[0].id;
      setActiveThreadId(firstId);
      openConversation(firstId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads, searchParams]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages]);

  const handleSelectThread = (threadId) => {
    setActiveThreadId(threadId);
    setSearchParams({ thread: threadId });
    openConversation(threadId);
    inputRef.current?.focus();
  };

  const handleSend = (e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    const text = inputText.trim();
    if (!text || !activeThreadId) return;
    sendMessage(activeThreadId, text);
    setInputText("");
    sendTyping(activeThreadId, false);
    if (typingTimeout) {
      clearTimeout(typingTimeout);
      setTypingTimeout(null);
    }
  };

  const handleInputChange = useCallback(
    (e) => {
      setInputText(e.target.value);
      if (!activeThreadId) return;
      sendTyping(activeThreadId, true);
      if (typingTimeout) clearTimeout(typingTimeout);
      const t = setTimeout(() => {
        sendTyping(activeThreadId, false);
        setTypingTimeout(null);
      }, 2000);
      setTypingTimeout(t);
    },
    [activeThreadId, sendTyping, typingTimeout]
  );

  const getRecipient = (thread) => {
    const data = thread?.participants_data || [];
    return data.find((p) => p.id !== currentUser?.id) || null;
  };

  const activeThread = getThread(activeThreadId);
  const recipient = getRecipient(activeThread);
  const activeTypers = (typingUsers[activeThreadId] || []).filter(
    (u) => u.userId !== currentUser?.id
  );

  // ── Live platform user search matching searchQuery ───────────────────────
  useEffect(() => {
    const query = searchQuery.trim();
    if (!query || query.length < 2) {
      setMatchingUsers([]);
      setSearchingUsers(false);
      return;
    }

    setSearchingUsers(true);
    const timer = setTimeout(async () => {
      try {
        const res = await apiListUsers({ search: query, limit: 8 });
        const list = (res.users || []).filter((u) => u.id !== currentUser?.id);
        setMatchingUsers(list);
      } catch (err) {
        console.error("Failed to search platform users:", err);
        setMatchingUsers([]);
      } finally {
        setSearchingUsers(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, currentUser?.id]);

  // ── Load users when New Chat modal opens or search changes ───────────────
  useEffect(() => {
    if (!isNewChatOpen) return;
    let isMounted = true;
    const fetchUsers = async () => {
      setLoadingAllUsers(true);
      try {
        const params = { limit: 50 };
        if (userModalSearch.trim()) params.search = userModalSearch.trim();
        const res = await apiListUsers(params);
        if (isMounted) {
          setAllUsers((res.users || []).filter((u) => u.id !== currentUser?.id));
        }
      } catch (err) {
        console.error("Failed to fetch users for modal:", err);
      } finally {
        if (isMounted) setLoadingAllUsers(false);
      }
    };
    fetchUsers();
    return () => {
      isMounted = false;
    };
  }, [isNewChatOpen, userModalSearch, currentUser?.id]);

  // ── Initiate chat with any platform user ─────────────────────────────────
  const handleStartChatWithUser = async (user) => {
    if (!user?.id) return;
    setStartingChatUserId(user.id);
    try {
      const convId = await getOrCreateThread(user.id);
      if (convId) {
        setIsNewChatOpen(false);
        setSearchQuery("");
        setMatchingUsers([]);
        handleSelectThread(convId);
        setTimeout(() => inputRef.current?.focus(), 200);
      }
    } catch (err) {
      console.error("Failed to start chat with user:", err);
    } finally {
      setStartingChatUserId(null);
    }
  };

  // ── Send broadcast announcement ──────────────────────────────────────────
  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;
    setSendingBroadcast(true);
    setBroadcastFeedback("");
    try {
      const res = await apiSendBroadcast({
        title: broadcastTitle.trim() || "Platform Announcement",
        message: broadcastMessage.trim(),
        target: broadcastTarget,
        sendNotification: broadcastNotif,
        sendChatMessage: broadcastChat,
      });
      setBroadcastFeedback(`Broadcast successfully sent to ${res.recipientsCount || res.sentCount || 0} users!`);
      if (reloadConversations) {
        reloadConversations();
      }
      setTimeout(() => {
        setIsBroadcastOpen(false);
        setBroadcastFeedback("");
        setBroadcastTitle("");
        setBroadcastMessage("");
      }, 1500);
    } catch (err) {
      setBroadcastFeedback(err.message || "Failed to send broadcast.");
    } finally {
      setSendingBroadcast(false);
    }
  };

  // Filter threads by search query
  const filteredThreads = threads.filter((t) => {
    if (!searchQuery.trim()) return true;
    const r = getRecipient(t);
    const query = searchQuery.toLowerCase();
    const nameMatch = r?.name?.toLowerCase().includes(query);
    const propMatch = t.property?.title?.toLowerCase().includes(query);
    return nameMatch || propMatch;
  });

  return (
    <div className="h-[calc(100vh-130px)] max-w-7xl mx-auto bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-sm flex overflow-hidden">

      {/* ── Left Sidebar: Conversation List ─────────────────────────── */}
      <div
        className={`w-full md:w-80 lg:w-96 border-r border-outline-variant flex flex-col shrink-0 bg-surface-container-low/40 ${
          activeThreadId ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="p-4 border-b border-outline-variant bg-surface-container-low space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]">forum</span>
              <h2 className="font-headline-sm text-lg font-bold text-on-surface">Client Messages</h2>
            </div>
            {/* Live Socket Status */}
            <span
              className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                isConnected
                  ? "bg-secondary-container/40 text-secondary"
                  : "bg-error-container/40 text-error"
              }`}
              title={isConnected ? "Real-time socket connected" : "Socket offline - reconnecting"}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isConnected ? "bg-secondary animate-pulse" : "bg-error"
                }`}
              />
              {isConnected ? "Live" : "Offline"}
            </span>
          </div>

          {/* Action buttons: New Chat & Broadcast */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsNewChatOpen(true)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add_comment</span>
              + New Chat
            </button>
            <button
              type="button"
              onClick={() => setIsBroadcastOpen(true)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold transition-all active:scale-95 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">campaign</span>
              Broadcast
            </button>
          </div>

          {/* Search box */}
          <div className="relative">
            <span className="material-symbols-outlined text-[18px] text-outline absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations or users..."
              className="w-full bg-surface-container border border-outline-variant rounded-lg pl-9 pr-8 py-1.5 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            )}
          </div>
        </div>

        {/* Matching Platform Users (live search) */}
        {searchQuery.trim().length >= 2 && (
          <div className="p-3 bg-primary/5 border-b border-outline-variant/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">person_search</span>
                Platform Users ({matchingUsers.length})
              </span>
              {searchingUsers && (
                <span className="material-symbols-outlined text-[14px] animate-spin text-primary">
                  progress_activity
                </span>
              )}
            </div>

            {matchingUsers.length === 0 && !searchingUsers ? (
              <p className="text-[11px] text-on-surface-variant italic">No registered user matches "{searchQuery}".</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {matchingUsers.map((u) => {
                  const isStarting = startingChatUserId === u.id;
                  return (
                    <div
                      key={u.id}
                      className="p-2 rounded-xl bg-surface-container-lowest border border-outline-variant/60 flex items-center justify-between gap-2 shadow-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar src={u.profile_image} name={u.name} size="sm" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-on-surface truncate">{u.name}</p>
                          <div className="flex items-center gap-1 text-[10px] text-on-surface-variant">
                            <span className="capitalize font-semibold text-primary">{u.role}</span>
                            <span>•</span>
                            <span className="truncate max-w-[110px]">{u.email}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleStartChatWithUser(u)}
                        disabled={isStarting}
                        className="px-2.5 py-1 rounded-lg bg-primary text-on-primary text-[11px] font-bold hover:bg-primary/90 shrink-0 transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                      >
                        {isStarting ? (
                          <span className="material-symbols-outlined text-[13px] animate-spin">
                            progress_activity
                          </span>
                        ) : (
                          <span className="material-symbols-outlined text-[13px]">chat</span>
                        )}
                        Chat
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Threads List */}
        <div className="flex-grow overflow-y-auto divide-y divide-outline-variant/60">
          {loadingConversations && threads.length === 0 ? (
            <div className="p-8 text-center text-sm text-on-surface-variant flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[18px] animate-spin text-primary">
                progress_activity
              </span>
              Loading conversations...
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="p-8 text-center text-sm text-on-surface-variant space-y-2">
              <span className="material-symbols-outlined text-[36px] text-outline">inbox</span>
              <p>{searchQuery ? "No conversation threads found." : "No client conversations yet."}</p>
              <p className="text-xs text-outline">
                {searchQuery
                  ? "Use the Platform Users section above or click + New Chat to start talking to this user."
                  : "Click + New Chat above to message any tenant or landlord."}
              </p>
            </div>
          ) : (
            filteredThreads.map((thread) => {
              const r = getRecipient(thread);
              const isSel = thread.id === activeThreadId;
              const lastMsg = thread.messages?.[thread.messages.length - 1];
              const hasTyping = (typingUsers[thread.id] || []).some(
                (u) => u.userId !== currentUser?.id
              );
              return (
                <button
                  type="button"
                  key={thread.id}
                  onClick={() => handleSelectThread(thread.id)}
                  className={`w-full text-left p-4 flex items-center gap-3 transition-colors cursor-pointer ${
                    isSel
                      ? "bg-primary-container/25 border-r-4 border-primary"
                      : "hover:bg-surface-container-low"
                  }`}
                >
                  <div className="relative shrink-0">
                    <Avatar src={r?.profile_image} name={r?.name} size="md" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline gap-1">
                      <span className="text-sm font-bold text-on-surface truncate">
                        {r?.name || "Client"}
                      </span>
                      {lastMsg && !hasTyping && (
                        <span className="text-[10px] text-outline font-medium shrink-0">
                          {new Date(lastMsg.timestamp || lastMsg.created_at).toLocaleTimeString(
                            [],
                            { hour: "2-digit", minute: "2-digit" }
                          )}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-surface-container text-on-surface-variant">
                        {r?.role || "User"}
                      </span>
                      {thread.property && (
                        <span className="text-[10px] text-primary font-semibold truncate max-w-[120px]">
                          • {thread.property.title}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      {hasTyping ? (
                        <p className="text-xs text-primary font-semibold italic flex items-center gap-1">
                          <span className="flex gap-0.5">
                            <span className="w-1 h-1 bg-primary rounded-full animate-bounce" />
                            <span className="w-1 h-1 bg-primary rounded-full animate-bounce delay-100" />
                            <span className="w-1 h-1 bg-primary rounded-full animate-bounce delay-200" />
                          </span>
                          typing...
                        </p>
                      ) : (
                        <p className="text-xs text-on-surface-variant truncate flex-1">
                          {lastMsg ? lastMsg.text || lastMsg.body : "No messages yet."}
                        </p>
                      )}
                      {thread.unread_count > 0 && (
                        <span className="ml-2 bg-primary text-on-primary text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                          {thread.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right: Chat Window ───────────────────────────────────────── */}
      <div
        className={`flex-grow flex-col bg-surface ${
          activeThreadId ? "flex" : "hidden md:flex"
        }`}
      >
        {activeThread ? (
          <>
            {/* Header */}
            <div className="px-3 sm:px-6 py-2.5 sm:py-3 border-b border-outline-variant bg-surface-container-lowest flex items-center justify-between gap-2 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {/* Mobile Back button */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveThreadId("");
                    setSearchParams({});
                  }}
                  className="md:hidden p-1.5 -ml-1 rounded-full hover:bg-surface-container text-on-surface-variant flex items-center justify-center shrink-0 cursor-pointer"
                  title="Back to conversations"
                >
                  <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                </button>
                <Avatar src={recipient?.profile_image} name={recipient?.name} size="md" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <h3 className="text-sm font-bold text-on-surface truncate">
                      {recipient?.name || "Client"}
                    </h3>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container shrink-0">
                      {recipient?.role || "User"}
                    </span>
                  </div>
                  {activeTypers.length > 0 ? (
                    <span className="text-xs text-primary font-semibold italic">typing...</span>
                  ) : (
                    <span className="text-xs text-outline truncate block">ID: {recipient?.id?.substring(0, 8)}...</span>
                  )}
                </div>
              </div>

              {/* Quick links: Property details & User profile */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {activeThread.property && (
                  <Link
                    to={`/admin/properties/${activeThread.property.id}`}
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-low hover:bg-surface-container text-xs font-semibold text-on-surface transition-colors"
                    title="View Property in Registry"
                  >
                    <span className="material-symbols-outlined text-[16px] text-primary">home_work</span>
                    <span className="truncate max-w-[150px]">{activeThread.property.title}</span>
                  </Link>
                )}
                {recipient?.id && (
                  <Link
                    to={`/admin/users/${recipient.id}`}
                    className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg border border-primary text-primary hover:bg-primary-container/20 text-xs font-bold transition-colors"
                    title="View User Management Profile"
                  >
                    <span className="material-symbols-outlined text-[15px]">person</span>
                    <span className="hidden xs:inline">User Profile</span>
                  </Link>
                )}
              </div>
            </div>

            {/* Message Feed */}
            <div className="flex-grow p-3 sm:p-6 overflow-y-auto space-y-3 sm:space-y-4">
              {loadingMessages && activeMessages.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-on-surface-variant gap-2 text-sm">
                  <span className="material-symbols-outlined text-[18px] animate-spin text-primary">
                    progress_activity
                  </span>
                  Loading messages...
                </div>
              ) : activeMessages.length === 0 ? (
                <div className="text-center text-sm text-on-surface-variant py-12 space-y-2">
                  <span className="material-symbols-outlined text-[40px] text-outline">chat</span>
                  <p className="font-semibold text-on-surface">Start of conversation</p>
                  <p className="text-xs text-outline">
                    Send a message below to communicate directly with {recipient?.name || "this user"}.
                  </p>
                </div>
              ) : (
                activeMessages.map((msg) => {
                  const senderId = msg.sender_id || msg.senderId;
                  const body = msg.body || msg.text;
                  const time = msg.created_at || msg.timestamp;
                  const isMe = senderId === currentUser?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      {!isMe && (
                        <Avatar
                          src={msg.sender_image || recipient?.profile_image}
                          name={msg.sender_name || recipient?.name}
                          size="xs"
                          className="shrink-0 mt-1 mr-2"
                        />
                      )}
                      <div
                        className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3.5 sm:px-4 py-2 sm:py-2.5 shadow-sm ${
                          isMe
                            ? "bg-primary text-on-primary rounded-br-none"
                            : "bg-surface-container-lowest text-on-surface border border-outline-variant/70 rounded-bl-none"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-line leading-relaxed">{body}</p>
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <span
                            className={`text-[9px] font-semibold ${
                              isMe ? "text-on-primary/70" : "text-outline"
                            }`}
                          >
                            {time
                              ? new Date(time).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </span>
                          {isMe && (
                            <span
                              className={`material-symbols-outlined text-[13px] ${
                                msg.is_read ? "text-secondary" : "text-on-primary/60"
                              }`}
                              title={msg.is_read ? "Read" : "Sent"}
                            >
                              {msg.is_read ? "done_all" : "done"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Typing bubble */}
              {activeTypers.length > 0 && (
                <div className="flex justify-start">
                  <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-outline rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-outline rounded-full animate-bounce delay-100" />
                    <span className="w-2 h-2 bg-outline rounded-full animate-bounce delay-200" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(e);
              }}
              className="p-2.5 sm:p-4 border-t border-outline-variant bg-surface-container-lowest flex items-center gap-2 sm:gap-3"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={handleInputChange}
                placeholder={isConnected ? "Type a message as Administrator..." : "Reconnecting socket..."}
                disabled={!isConnected && inputText === ""}
                className="flex-grow bg-surface-container border border-outline-variant rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary outline-none disabled:opacity-60"
              />
              <Button
                type="submit"
                variant="primary"
                disabled={!inputText.trim()}
                className="py-2.5 sm:py-3 px-3.5 sm:px-5 shrink-0 rounded-xl cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">send</span>
              </Button>
            </form>
          </>
        ) : (
          <div className="hidden md:flex flex-1 flex-col items-center justify-center text-center p-8 bg-surface-container-low/20">
            <span className="material-symbols-outlined text-[64px] text-outline mb-3">chat</span>
            <h3 className="text-lg font-bold text-on-surface">Select a Client Conversation</h3>
            <p className="text-sm text-on-surface-variant max-w-sm mt-1">
              Select an existing chat thread from the left, or message a client directly from their user or property profile.
            </p>
          </div>
        )}
      </div>

      {/* ── Start New Chat Modal ────────────────────────────────────── */}
      <Modal
        isOpen={isNewChatOpen}
        onClose={() => {
          setIsNewChatOpen(false);
          setUserModalSearch("");
        }}
        title="Start Direct Chat with User"
      >
        <div className="space-y-4">
          <p className="text-xs text-on-surface-variant">
            Select any registered tenant or property owner across the platform to initiate a direct administrator conversation.
          </p>

          <div className="relative">
            <span className="material-symbols-outlined text-[18px] text-outline absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={userModalSearch}
              onChange={(e) => setUserModalSearch(e.target.value)}
              placeholder="Search users by name or email..."
              className="w-full bg-surface-container border border-outline-variant rounded-xl pl-9 pr-3 py-2 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:border-primary"
            />
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-outline-variant/60 border border-outline-variant rounded-xl bg-surface-container-lowest">
            {loadingAllUsers ? (
              <div className="p-8 text-center text-xs text-on-surface-variant flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[18px] animate-spin text-primary">
                  progress_activity
                </span>
                Loading platform users...
              </div>
            ) : allUsers.length === 0 ? (
              <div className="p-8 text-center text-xs text-on-surface-variant">
                No users found.
              </div>
            ) : (
              allUsers.map((u) => {
                const isStarting = startingChatUserId === u.id;
                return (
                  <div
                    key={u.id}
                    className="p-3 flex items-center justify-between gap-3 hover:bg-surface-container-low transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar src={u.profile_image} name={u.name} size="md" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-on-surface truncate">{u.name}</p>
                        <p className="text-xs text-outline truncate">{u.email}</p>
                        <span className="inline-block mt-0.5 text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-surface-container text-on-surface-variant">
                          {u.role}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleStartChatWithUser(u)}
                      disabled={isStarting}
                      className="px-3.5 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 shrink-0 transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      {isStarting ? (
                        <span className="material-symbols-outlined text-[14px] animate-spin">
                          progress_activity
                        </span>
                      ) : (
                        <span className="material-symbols-outlined text-[14px]">send</span>
                      )}
                      Message
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Modal>

      {/* ── Broadcast Announcement Modal ────────────────────────────── */}
      <Modal
        isOpen={isBroadcastOpen}
        onClose={() => {
          if (!sendingBroadcast) {
            setIsBroadcastOpen(false);
            setBroadcastFeedback("");
          }
        }}
        title="Broadcast Announcement to Platform Users"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsBroadcastOpen(false)}
              disabled={sendingBroadcast}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSendBroadcast}
              disabled={
                sendingBroadcast ||
                !broadcastMessage.trim() ||
                (!broadcastNotif && !broadcastChat)
              }
              className="text-xs flex items-center gap-1.5"
            >
              {sendingBroadcast ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">
                    progress_activity
                  </span>
                  Sending Broadcast...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">campaign</span>
                  Send Broadcast
                </>
              )}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-on-surface-variant">
            Send an official platform announcement. You can deliver this announcement as in-app notifications, direct messages in chat threads, or both.
          </p>

          {broadcastFeedback && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold ${
                broadcastFeedback.includes("success")
                  ? "bg-secondary-container/50 text-secondary border border-secondary/30"
                  : "bg-error-container/50 text-error border border-error/30"
              }`}
            >
              {broadcastFeedback}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-on-surface mb-1.5">
              Target Audience
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "all", label: "All Users" },
                { id: "user", label: "Tenants Only" },
                { id: "landlord", label: "Owners Only" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setBroadcastTarget(t.id)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                    broadcastTarget === t.id
                      ? "border-primary bg-primary text-on-primary shadow-sm"
                      : "border-outline-variant bg-surface-container text-on-surface hover:bg-surface-container-high"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface mb-1">
              Announcement Title
            </label>
            <input
              type="text"
              value={broadcastTitle}
              onChange={(e) => setBroadcastTitle(e.target.value)}
              placeholder="e.g. Platform Notice & Maintenance"
              className="w-full bg-surface-container border border-outline-variant rounded-xl px-3 py-2 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface mb-1">
              Announcement Message *
            </label>
            <textarea
              rows={4}
              required
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              placeholder="Write your announcement message here..."
              className="w-full bg-surface-container border border-outline-variant rounded-xl p-3 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:border-primary resize-none"
            />
          </div>

          <div className="space-y-2 pt-1 border-t border-outline-variant">
            <span className="block text-[11px] font-bold text-on-surface uppercase tracking-wider">
              Delivery Channels
            </span>
            <label className="flex items-center gap-2 cursor-pointer text-xs text-on-surface">
              <input
                type="checkbox"
                checked={broadcastNotif}
                onChange={(e) => setBroadcastNotif(e.target.checked)}
                className="rounded text-primary focus:ring-primary h-4 w-4"
              />
              <span>Send In-App Notification (bell icon alerts)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs text-on-surface">
              <input
                type="checkbox"
                checked={broadcastChat}
                onChange={(e) => setBroadcastChat(e.target.checked)}
                className="rounded text-primary focus:ring-primary h-4 w-4"
              />
              <span>Send Direct Support Chat Message (creates/updates chat thread)</span>
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminMessages;

