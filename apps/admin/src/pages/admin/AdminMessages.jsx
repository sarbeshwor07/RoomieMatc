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
  } = useMessages();

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeThreadId, setActiveThreadId] = useState("");
  const [inputText, setInputText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [typingTimeout, setTypingTimeout] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

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
    e.preventDefault();
    if (!inputText.trim() || !activeThreadId) return;
    sendMessage(activeThreadId, inputText);
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
      <div className="w-80 md:w-96 border-r border-outline-variant flex flex-col shrink-0 bg-surface-container-low/40">
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

          {/* Search box */}
          <div className="relative">
            <span className="material-symbols-outlined text-[18px] text-outline absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full bg-surface-container border border-outline-variant rounded-lg pl-9 pr-3 py-1.5 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>

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
              <p>{searchQuery ? "No matching conversations found." : "No client conversations yet."}</p>
              <p className="text-xs text-outline">
                You can start a conversation directly from any user or property page.
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
                  key={thread.id}
                  onClick={() => handleSelectThread(thread.id)}
                  className={`w-full text-left p-4 flex items-center gap-3 transition-colors ${
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
      <div className="flex-grow flex flex-col bg-surface">
        {activeThread ? (
          <>
            {/* Header */}
            <div className="px-6 py-3 border-b border-outline-variant bg-surface-container-lowest flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Avatar src={recipient?.profile_image} name={recipient?.name} size="md" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-on-surface">
                      {recipient?.name || "Client"}
                    </h3>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container">
                      {recipient?.role || "User"}
                    </span>
                  </div>
                  {activeTypers.length > 0 ? (
                    <span className="text-xs text-primary font-semibold italic">typing...</span>
                  ) : (
                    <span className="text-xs text-outline">ID: {recipient?.id?.substring(0, 8)}...</span>
                  )}
                </div>
              </div>

              {/* Quick links: Property details & User profile */}
              <div className="flex items-center gap-2 flex-wrap">
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
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-primary text-primary hover:bg-primary-container/20 text-xs font-bold transition-colors"
                    title="View User Management Profile"
                  >
                    <span className="material-symbols-outlined text-[15px]">person</span>
                    User Profile
                  </Link>
                )}
              </div>
            </div>

            {/* Message Feed */}
            <div className="flex-grow p-6 overflow-y-auto space-y-4">
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
                        className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm ${
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
              onSubmit={handleSend}
              className="p-4 border-t border-outline-variant bg-surface-container-lowest flex items-center gap-3"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) handleSend(e);
                }}
                placeholder={isConnected ? "Type a message as Administrator..." : "Reconnecting socket..."}
                disabled={!isConnected && inputText === ""}
                className="flex-grow bg-surface-container border border-outline-variant rounded-xl px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary outline-none disabled:opacity-60"
              />
              <Button
                type="submit"
                variant="primary"
                disabled={!inputText.trim()}
                className="py-3 px-5 shrink-0 rounded-xl"
              >
                <span className="material-symbols-outlined text-[20px]">send</span>
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-surface-container-low/20">
            <span className="material-symbols-outlined text-[64px] text-outline mb-3">chat</span>
            <h3 className="text-lg font-bold text-on-surface">Select a Client Conversation</h3>
            <p className="text-sm text-on-surface-variant max-w-sm mt-1">
              Select an existing chat thread from the left, or message a client directly from their user or property profile.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminMessages;

