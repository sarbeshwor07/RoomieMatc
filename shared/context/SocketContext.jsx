/**
 * SocketContext.jsx — Socket.io-powered real-time messaging context.
 *
 * Architecture:
 *   - REST API  → initial conversation list load + message history
 *   - Socket.io → real-time message delivery (instant, no polling)
 *
 * Connection lifecycle:
 *   1. User logs in → socket connects with JWT in handshake.auth.token
 *   2. User opens a conversation → emit join_conversation
 *   3. User sends a message → emit send_message (saved to DB + broadcast by server)
 *   4. Server emits new_message to room → appended instantly to activeMessages
 *   5. User logs out → socket disconnects
 *
 * Conversations list is still refreshed via REST on:
 *   - Initial login
 *   - After sending a message (to update last_message preview)
 *   - On new_message event (to update sidebar preview + unread counts)
 *
 * Exposed API:
 *   conversations          — array of conversation objects
 *   activeMessages         — messages in the open conversation
 *   activeConvId           — currently open conversation ID
 *   loadingConversations   — boolean
 *   loadingMessages        — boolean
 *   typingUsers            — Map<conversationId, { userId, userName }[]>
 *   isConnected            — socket connection status
 *   openConversation(id)   — join room + fetch messages
 *   sendMessage(id, text)  — emit send_message over socket
 *   getOrCreateThread(uid, propId?) — REST call, returns convId
 *   markRead(id)           — REST call + emit join (which marks read server-side)
 *   reloadConversations()  — manual REST refresh
 */
import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useRef
} from "react";
import { io } from "socket.io-client";
import { AuthContext } from "./AuthContext";
import {
  apiListConversations,
  apiGetOrCreateConversation,
  apiGetMessages,
  apiMarkConversationRead,
} from "../services/api";

export const SocketContext = createContext();

const SOCKET_URL =
  import.meta.env?.VITE_SOCKET_URL ||
  (import.meta.env?.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "")
    : typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost:4000");

export const SocketProvider = ({ children }) => {
  const { currentUser } = useContext(AuthContext);

  // ── State ────────────────────────────────────────────────────────────────
  const [conversations,        setConversations]        = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [activeConvId,         setActiveConvId]         = useState(null);
  const [activeMessages,       setActiveMessages]       = useState([]);
  const [loadingMessages,      setLoadingMessages]      = useState(false);
  const [isConnected,          setIsConnected]          = useState(false);
  const [typingUsers,          setTypingUsers]          = useState({}); // { [convId]: [{userId,userName}] }

  // Stable refs — avoid stale closures in socket event handlers
  const socketRef       = useRef(null);
  const activeConvIdRef = useRef(null);

  // ── REST: load conversation list ─────────────────────────────────────────
  const reloadConversations = useCallback(async () => {
    if (!currentUser) return;
    setLoadingConversations(true);
    try {
      const data = await apiListConversations();
      setConversations(data.conversations || []);
    } catch {
      // silent on failures
    } finally {
      setLoadingConversations(false);
    }
  }, [currentUser]);

  // ── Socket.io connection lifecycle ───────────────────────────────────────
  useEffect(() => {
    if (!currentUser) {
      // Logged out — disconnect and clean up
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      setConversations([]);
      setActiveMessages([]);
      setActiveConvId(null);
      activeConvIdRef.current = null;
      return;
    }

    const jwt = localStorage.getItem("roomiematch_jwt");
    if (!jwt) return;

    // Create socket — auto-connects on creation
    const socket = io(SOCKET_URL, {
      auth: { token: jwt },
      transports: ["websocket", "polling"],
      reconnection:      true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });
    socketRef.current = socket;

    // ── Connection events ─────────────────────────────────────────────────
    socket.on("connect", () => {
      console.log("[Socket] Connected:", socket.id);
      setIsConnected(true);
      // Load conversations once connected
      reloadConversations();
      // Re-join the active conversation room if one was open
      if (activeConvIdRef.current) {
        socket.emit("join_conversation", { conversationId: activeConvIdRef.current });
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
      setIsConnected(false);
    });

    socket.on("connect_error", (err) => {
      console.warn("[Socket] Connection error:", err.message);
      setIsConnected(false);
    });

    // ── Real-time message received ────────────────────────────────────────
    socket.on("new_message", ({ message }) => {
      if (!message) return;

      // If the message is for the currently open conversation, append it immediately
      if (message.conversation_id === activeConvIdRef.current) {
        setActiveMessages(prev => {
          // Avoid duplicates (e.g. if sender already appended optimistically)
          if (prev.some(m => m.id === message.id)) return prev;
          return [...prev, message];
        });
      }

      // Always update the conversation sidebar preview
      setConversations(prev =>
        prev.map(c => {
          if (c.id !== message.conversation_id) return c;
          const isActive = message.conversation_id === activeConvIdRef.current;
          return {
            ...c,
            last_message: {
              id:         message.id,
              sender_id:  message.sender_id,
              body:       message.body,
              is_read:    isActive ? 1 : 0,
              created_at: message.created_at,
            },
            // Increment unread only if we are NOT currently viewing this conversation
            unread_count: isActive
              ? 0
              : (message.sender_id !== currentUser?.id
                  ? (c.unread_count || 0) + 1
                  : c.unread_count || 0),
          };
        })
      );

      // Move this conversation to the top of the list
      setConversations(prev => {
        const idx = prev.findIndex(c => c.id === message.conversation_id);
        if (idx <= 0) return prev;
        const updated = [...prev];
        const [conv]  = updated.splice(idx, 1);
        updated.unshift(conv);
        return updated;
      });
    });

    // ── Read receipts ─────────────────────────────────────────────────────
    socket.on("message_read", ({ conversationId, readBy }) => {
      if (!conversationId) return;
      // If the other person read our messages, update is_read in activeMessages
      if (conversationId === activeConvIdRef.current && readBy !== currentUser?.id) {
        setActiveMessages(prev =>
          prev.map(m => m.sender_id === currentUser?.id ? { ...m, is_read: 1 } : m)
        );
      }
      // Zero out unread count for that conversation
      setConversations(prev =>
        prev.map(c => c.id === conversationId ? { ...c, unread_count: 0 } : c)
      );
    });

    // ── Typing indicators ─────────────────────────────────────────────────
    socket.on("user_typing", ({ conversationId, userId, userName, isTyping }) => {
      setTypingUsers(prev => {
        const current = prev[conversationId] || [];
        if (isTyping) {
          if (current.some(u => u.userId === userId)) return prev;
          return { ...prev, [conversationId]: [...current, { userId, userName }] };
        } else {
          return {
            ...prev,
            [conversationId]: current.filter(u => u.userId !== userId)
          };
        }
      });
    });

    // ── Server-side errors ────────────────────────────────────────────────
    socket.on("error", ({ message }) => {
      console.error("[Socket] Server error:", message);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("new_message");
      socket.off("message_read");
      socket.off("user_typing");
      socket.off("error");
      socket.disconnect();
      socketRef.current = null;
    };
  // Re-run only when the user logs in or out
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // ── Open a conversation ───────────────────────────────────────────────────
  const openConversation = useCallback(async (convId) => {
    if (!convId) return;
    setActiveConvId(convId);
    activeConvIdRef.current = convId;
    setActiveMessages([]);
    setLoadingMessages(true);

    // Fetch message history via REST
    try {
      const data = await apiGetMessages(convId);
      setActiveMessages(data.messages || []);
    } catch (err) {
      console.error("[SocketContext] loadMessages:", err.message);
    } finally {
      setLoadingMessages(false);
    }

    // Zero unread for this conversation locally
    setConversations(prev =>
      prev.map(c => c.id === convId ? { ...c, unread_count: 0 } : c)
    );

    // Join the Socket.io room (server marks messages as read + emits message_read)
    if (socketRef.current?.connected) {
      socketRef.current.emit("join_conversation", { conversationId: convId });
    }
  }, []);

  // ── Send a message ────────────────────────────────────────────────────────
  const sendMessage = useCallback((convId, text) => {
    if (!convId || !text?.trim()) return;

    if (socketRef.current?.connected) {
      // Emit over socket — server saves to DB and broadcasts new_message to room
      socketRef.current.emit("send_message", {
        conversationId: convId,
        body:           text.trim(),
      });
    } else {
      // Fallback: if socket is temporarily disconnected, use REST
      import("../services/api").then(({ apiSendMessage }) => {
        apiSendMessage(convId, text.trim())
          .then(data => {
            setActiveMessages(prev => {
              if (prev.some(m => m.id === data.message.id)) return prev;
              return [...prev, data.message];
            });
            reloadConversations();
          })
          .catch(err => console.error("[SocketContext] REST fallback send:", err.message));
      });
    }
  }, [reloadConversations]);

  // ── Send typing indicator ─────────────────────────────────────────────────
  const sendTyping = useCallback((convId, isTyping) => {
    if (!convId || !socketRef.current?.connected) return;
    socketRef.current.emit("typing", { conversationId: convId, isTyping });
  }, []);

  // ── Get or create conversation thread ────────────────────────────────────
  const getOrCreateThread = useCallback(async (otherUserId, propertyId = null) => {
    if (!currentUser) return null;
    try {
      const data = await apiGetOrCreateConversation(otherUserId, propertyId);
      const convId = data.conversation.id;
      if (data.created) {
        setConversations(prev => [data.conversation, ...prev]);
      }
      return convId;
    } catch (err) {
      console.error("[SocketContext] getOrCreateThread:", err.message);
      return null;
    }
  }, [currentUser]);

  // ── Mark conversation as read ─────────────────────────────────────────────
  const markRead = useCallback(async (convId) => {
    if (!convId) return;
    try {
      await apiMarkConversationRead(convId);
    } catch { /* silent */ }
    setConversations(prev =>
      prev.map(c => c.id === convId ? { ...c, unread_count: 0 } : c)
    );
  }, []);

  // ── Legacy shim: threads array (used by pages via useMessages hook) ───────
  const threads = conversations.map(conv => ({
    id:               conv.id,
    participants:     (conv.participants || []).map(p => p.id),
    participants_data: conv.participants,
    propertyId:       conv.property_id,
    property:         conv.property,
    unread_count:     conv.unread_count,
    messages: conv.id === activeConvId
      ? activeMessages.map(m => ({
          id:        m.id,
          senderId:  m.sender_id,
          text:      m.body,
          timestamp: m.created_at,
          isRead:    m.is_read,
        }))
      : conv.last_message
        ? [{
            id:        conv.last_message.id,
            senderId:  conv.last_message.sender_id,
            text:      conv.last_message.body,
            timestamp: conv.last_message.created_at,
            isRead:    conv.last_message.is_read,
          }]
        : [],
  }));

  return (
    <SocketContext.Provider value={{
      // ── Primary Socket.io API ─────────────────────────────────────────
      conversations,
      loadingConversations,
      activeConvId,
      activeMessages,
      loadingMessages,
      isConnected,
      typingUsers,
      openConversation,
      sendMessage,
      sendTyping,
      getOrCreateThread,
      markRead,
      reloadConversations,
      // ── Legacy shims ──────────────────────────────────────────────────
      messages:       threads,
      setMessages:    () => {},
      sendMockMessage: (threadId, _senderId, text) => sendMessage(threadId, text),
      createNewThread: (uid, propId) => getOrCreateThread(uid, propId),
    }}>
      {children}
    </SocketContext.Provider>
  );
};
