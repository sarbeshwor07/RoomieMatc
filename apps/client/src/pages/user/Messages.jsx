/**
 * Messages.jsx (Tenant)
 *
 * Real-time chat powered by Socket.io.
 * - Messages appear instantly when sent (no polling, no reload).
 * - Typing indicator shown when the other person is typing.
 * - Connection status badge in header.
 * - Auto-scrolls to newest message on every new_message event.
 */
import React, { useState, useContext, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { AuthContext } from "@shared/context/AuthContext";
import { SocketContext } from "@shared/context/SocketContext";
import { useMessages } from "@shared/hooks/useMessages";
import Avatar from "@shared/components/common/Avatar";
import Button from "@shared/components/common/Button";
import { apiContactAdmin } from "@shared/services/api";

export const Messages = () => {
  const { currentUser } = useContext(AuthContext);
  const { isConnected, typingUsers, sendTyping } = useContext(SocketContext);
  const {
    threads,
    loadingConversations,
    activeConvId,
    activeMessages,
    loadingMessages,
    openConversation,
    sendMessage,
    getThread,
  } = useMessages();

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeThreadId, setActiveThreadId] = useState("");
  const [inputText, setInputText]           = useState("");
  const [typingTimeout, setTypingTimeout]   = useState(null);
  const [connectingAdmin, setConnectingAdmin] = useState(false);
  const messagesEndRef                      = useRef(null);
  const inputRef                            = useRef(null);

  const handleContactAdmin = useCallback(async () => {
    setConnectingAdmin(true);
    try {
      const data = await apiContactAdmin();
      if (data?.conversation?.id) {
        setActiveThreadId(data.conversation.id);
        setSearchParams({ thread: data.conversation.id });
        openConversation(data.conversation.id);
        setTimeout(() => inputRef.current?.focus(), 150);
      }
    } catch (err) {
      alert(err.message || "Failed to connect with RoomieMatch administrator.");
    } finally {
      setConnectingAdmin(false);
    }
  }, [openConversation, setSearchParams]);

  // Open thread from URL param or default to first thread or handle ?contact=admin
  useEffect(() => {
    const contactParam = searchParams.get("contact");
    if (contactParam === "admin") {
      handleContactAdmin();
      return;
    }

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
  }, [threads, searchParams, handleContactAdmin]);

  // Auto-scroll on every new message
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
    // Stop typing indicator
    sendTyping(activeThreadId, false);
    if (typingTimeout) { clearTimeout(typingTimeout); setTypingTimeout(null); }
  };

  // Typing indicator — send "typing:true" while user types, stop 2s after last keystroke
  const handleInputChange = useCallback((e) => {
    setInputText(e.target.value);
    if (!activeThreadId) return;
    sendTyping(activeThreadId, true);
    if (typingTimeout) clearTimeout(typingTimeout);
    const t = setTimeout(() => {
      sendTyping(activeThreadId, false);
      setTypingTimeout(null);
    }, 2000);
    setTypingTimeout(t);
  }, [activeThreadId, sendTyping, typingTimeout]);

  const getRecipient = (thread) => {
    const data = thread.participants_data || [];
    return data.find(p => p.id !== currentUser?.id) || null;
  };

  const activeThread    = getThread(activeThreadId);
  const displayMessages = activeMessages;

  // Who is typing in the active conversation?
  const activeTypers = (typingUsers[activeThreadId] || []).filter(u => u.userId !== currentUser?.id);

  return (
    <div className="h-[calc(100vh-130px)] max-w-6xl mx-auto bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm flex overflow-hidden">

      {/* ── Thread List Sidebar ─────────────────────────────────────────── */}
      <div className="w-80 border-r border-outline-variant flex flex-col shrink-0">
        <div className="p-4 border-b border-outline-variant bg-surface-container-low flex items-center justify-between">
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Messages</h2>
          {/* Socket connection status */}
          <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
            isConnected
              ? "bg-secondary-container/40 text-secondary"
              : "bg-error-container/40 text-error"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-secondary" : "bg-error"}`} />
            {isConnected ? "Live" : "Offline"}
          </span>
        </div>

        {/* Contact Support / Admin Banner */}
        <div className="p-3 border-b border-outline-variant bg-primary-container/10">
          <button
            onClick={handleContactAdmin}
            disabled={connectingAdmin}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-primary hover:bg-primary/90 text-on-primary rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-60"
          >
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">support_agent</span>
              <span>{connectingAdmin ? "Connecting to Support..." : "Chat with RoomieMatch Admin"}</span>
            </span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>

        <div className="flex-grow overflow-y-auto divide-y divide-outline-variant/60">
          {loadingConversations && threads.length === 0 ? (
            <div className="p-8 text-center text-body-md text-on-surface-variant flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              Loading...
            </div>
          ) : threads.length === 0 ? (
            <div className="p-8 text-center text-body-md text-on-surface-variant flex flex-col items-center gap-3">
              <span className="material-symbols-outlined text-[36px] text-outline">forum</span>
              <p>No active conversations yet.</p>
              <button
                onClick={handleContactAdmin}
                disabled={connectingAdmin}
                className="px-4 py-2 bg-surface-container-high hover:bg-surface-container border border-outline-variant text-on-surface rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px] text-primary">support_agent</span>
                Have questions? Message Support
              </button>
            </div>
          ) : (
            threads.map((thread) => {
              const recipient = getRecipient(thread);
              const isSel     = thread.id === activeThreadId;
              const lastMsg   = thread.messages?.[thread.messages.length - 1];
              const hasTyping = (typingUsers[thread.id] || []).some(u => u.userId !== currentUser?.id);
              return (
                <button
                  key={thread.id}
                  onClick={() => handleSelectThread(thread.id)}
                  className={`w-full text-left p-4 flex items-center gap-3 transition-colors ${
                    isSel ? "bg-primary-container/20 border-r-4 border-primary" : "hover:bg-surface-container-low"
                  }`}
                >
                  <div className="relative shrink-0">
                    <Avatar src={recipient?.profile_image} name={recipient?.name} size="md" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <span className="font-label-md text-label-md text-on-surface font-bold truncate">
                        {recipient?.name || "User"}
                      </span>
                      {lastMsg && !hasTyping && (
                        <span className="text-[10px] text-outline font-medium shrink-0 ml-1">
                          {new Date(lastMsg.timestamp || lastMsg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      {hasTyping ? (
                        <p className="text-xs text-primary font-semibold italic flex items-center gap-1">
                          <span className="flex gap-0.5">
                            <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                          </span>
                          typing...
                        </p>
                      ) : (
                        <p className="text-xs text-on-surface-variant truncate flex-1">
                          {lastMsg ? (lastMsg.text || lastMsg.body) : "No messages yet."}
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

      {/* ── Chat Window ─────────────────────────────────────────────────── */}
      <div className="flex-grow flex flex-col bg-surface">
        {activeThread ? (
          <>
            {/* Header */}
            <div className="px-6 py-3 border-b border-outline-variant bg-surface-container-lowest flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar
                  src={getRecipient(activeThread)?.profile_image}
                  name={getRecipient(activeThread)?.name}
                  size="md"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-label-md text-label-md text-on-surface font-bold">
                      {getRecipient(activeThread)?.name || "User"}
                    </h3>
                    {getRecipient(activeThread)?.role === "admin" && (
                      <span className="inline-flex items-center gap-0.5 bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        <span className="material-symbols-outlined text-[12px] icon-fill">admin_panel_settings</span>
                        Support Team
                      </span>
                    )}
                  </div>
                  {activeTypers.length > 0 ? (
                    <span className="text-xs text-primary font-semibold italic">typing...</span>
                  ) : (
                    <span className="text-xs text-outline uppercase font-bold">
                      {getRecipient(activeThread)?.role === "admin" ? "Official Support" : (getRecipient(activeThread)?.role || "")}
                    </span>
                  )}
                </div>
              </div>

              {/* Property context banner */}
              {activeThread.property && (
                <div className="hidden sm:flex items-center gap-2 bg-surface-container-high px-3 py-1 rounded-lg border border-outline-variant text-xs">
                  <span className="material-symbols-outlined text-[16px] text-primary">home</span>
                  <span className="font-bold text-on-surface truncate max-w-xs">
                    {activeThread.property.title}
                  </span>
                  <span className="text-primary font-bold">(Rs. {Number(activeThread.property.price).toLocaleString()})</span>
                </div>
              )}
            </div>

            {/* Message feed */}
            <div className="flex-grow p-6 overflow-y-auto space-y-4">
              {loadingMessages && displayMessages.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-on-surface-variant gap-2 text-sm">
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                  Loading messages...
                </div>
              ) : displayMessages.length === 0 ? (
                <div className="text-center text-body-md text-on-surface-variant py-8">
                  Start the conversation by sending a message below.
                </div>
              ) : (
                displayMessages.map((msg) => {
                  const senderId = msg.sender_id || msg.senderId;
                  const body     = msg.body      || msg.text;
                  const time     = msg.created_at || msg.timestamp;
                  const isMe     = senderId === currentUser?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      {!isMe && (
                        <Avatar
                          src={msg.sender_image}
                          name={msg.sender_name}
                          size="xs"
                          className="shrink-0 mt-1 mr-2"
                        />
                      )}
                      <div className={`max-w-[65%] rounded-2xl px-4 py-2.5 shadow-sm ${
                        isMe
                          ? "bg-primary text-on-primary rounded-br-none"
                          : "bg-surface-container-lowest text-on-surface border border-outline-variant/60 rounded-bl-none"
                      }`}>
                        <p className="text-body-md whitespace-pre-line leading-relaxed">{body}</p>
                        <div className={`flex items-center justify-end gap-1 mt-1`}>
                          <span className={`text-[9px] font-semibold ${isMe ? "text-on-primary/70" : "text-outline"}`}>
                            {time ? new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                          </span>
                          {/* Read receipt for sent messages */}
                          {isMe && (
                            <span className={`material-symbols-outlined text-[12px] ${msg.is_read ? "text-secondary" : "text-on-primary/50"}`}>
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
                    <span className="w-2 h-2 bg-outline rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-outline rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-outline rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input bar */}
            <form onSubmit={handleSend} className="p-4 border-t border-outline-variant bg-surface-container-lowest flex items-center gap-3">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) handleSend(e); }}
                placeholder={isConnected ? "Type your message..." : "Reconnecting..."}
                disabled={!isConnected && inputText === ""}
                className="flex-grow bg-surface-container border border-outline-variant rounded-lg px-4 py-3 text-body-md text-on-surface focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary outline-none disabled:opacity-60"
              />
              <Button
                type="submit"
                variant="primary"
                disabled={!inputText.trim()}
                className="py-3 px-5 shrink-0"
              >
                <span className="material-symbols-outlined text-[22px]">send</span>
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-surface-container-low">
            <span className="material-symbols-outlined text-[64px] text-outline mb-4">chat</span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">Select a Conversation</h3>
            <p className="text-body-md text-on-surface-variant max-w-sm mt-2">
              Choose a thread from the sidebar, or start a new chat from a property or roommate profile.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
