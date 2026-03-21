import { create } from 'zustand';
import { useShallow } from 'zustand/shallow';
import type { Conversation, Message } from '../types';
import {
  getConversations,
  getMessages,
  sendMessage as apiSendMessage,
  updateConversationStatus as apiUpdateStatus,
  type ConversationListParams,
  type SendMessageData,
} from '../services/chatApi';

interface ChatState {
  // Conversation list
  conversations: Conversation[];
  conversationsTotal: number;
  conversationsLoading: boolean;
  conversationsFilter: ConversationListParams;

  // Selected conversation
  selectedConversationId: number | null;
  selectedConversation: Conversation | null;

  // Messages
  messages: Message[];
  messagesTotal: number;
  messagesLoading: boolean;
  messagesPage: number;
  hasMoreMessages: boolean;

  // Sending
  sending: boolean;

  // Actions
  fetchConversations: (params?: ConversationListParams) => Promise<void>;
  selectConversation: (id: number | null) => Promise<void>;
  fetchMessages: (conversationId: number, page?: number) => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  sendMessage: (data: SendMessageData) => Promise<void>;
  updateConversationStatus: (id: number, status: string) => Promise<void>;
  setFilter: (filter: Partial<ConversationListParams>) => void;

  // WebSocket handlers
  handleNewMessage: (message: Message) => void;
  handleConversationUpdated: (conversation: Partial<Conversation> & { id: number }) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  conversationsTotal: 0,
  conversationsLoading: false,
  conversationsFilter: {},

  selectedConversationId: null,
  selectedConversation: null,

  messages: [],
  messagesTotal: 0,
  messagesLoading: false,
  messagesPage: 1,
  hasMoreMessages: false,

  sending: false,

  fetchConversations: async (params?: ConversationListParams) => {
    const filter = params ?? get().conversationsFilter;
    set({ conversationsLoading: true });
    try {
      const result = await getConversations(filter);
      set({
        conversations: result.items,
        conversationsTotal: result.total,
        conversationsLoading: false,
        conversationsFilter: filter,
      });
    } catch {
      set({ conversationsLoading: false });
    }
  },

  selectConversation: async (id: number | null) => {
    if (id === null) {
      set({ selectedConversationId: null, selectedConversation: null, messages: [], messagesPage: 1 });
      return;
    }

    const conv = get().conversations.find((c) => c.id === id) ?? null;
    set({
      selectedConversationId: id,
      selectedConversation: conv,
      messages: [],
      messagesPage: 1,
      hasMoreMessages: false,
    });

    // Fetch messages
    await get().fetchMessages(id, 1);
  },

  fetchMessages: async (conversationId: number, page: number = 1) => {
    set({ messagesLoading: true });
    try {
      const result = await getMessages(conversationId, { page, page_size: 50 });
      if (page === 1) {
        // Reverse to show oldest first (API returns newest first)
        set({
          messages: [...result.items].reverse(),
          messagesTotal: result.total,
          messagesPage: page,
          messagesLoading: false,
          hasMoreMessages: result.page < result.total_pages,
        });
      } else {
        // Prepend older messages
        const existing = get().messages;
        set({
          messages: [...[...result.items].reverse(), ...existing],
          messagesPage: page,
          messagesLoading: false,
          hasMoreMessages: result.page < result.total_pages,
        });
      }
    } catch {
      set({ messagesLoading: false });
    }
  },

  loadMoreMessages: async () => {
    const { selectedConversationId, messagesPage, hasMoreMessages, messagesLoading } = get();
    if (!selectedConversationId || !hasMoreMessages || messagesLoading) return;
    await get().fetchMessages(selectedConversationId, messagesPage + 1);
  },

  sendMessage: async (data: SendMessageData) => {
    const { selectedConversationId } = get();
    if (!selectedConversationId) return;

    set({ sending: true });
    try {
      const message = await apiSendMessage(selectedConversationId, data);
      // Append to messages
      set((state) => ({
        messages: [...state.messages, message],
        sending: false,
      }));

      // Update conversation in list
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === selectedConversationId
            ? {
                ...c,
                last_message: message,
                updated_at: message.created_at,
              }
            : c
        ),
      }));
    } catch {
      set({ sending: false });
      throw new Error('Failed to send message');
    }
  },

  updateConversationStatus: async (id: number, status: string) => {
    try {
      await apiUpdateStatus(id, status);
      // Update in list
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, status: status as Conversation['status'] } : c
        ),
        selectedConversation:
          state.selectedConversation?.id === id
            ? { ...state.selectedConversation, status: status as Conversation['status'] }
            : state.selectedConversation,
      }));
    } catch {
      // ignore
    }
  },

  setFilter: (filter: Partial<ConversationListParams>) => {
    const current = get().conversationsFilter;
    const newFilter = { ...current, ...filter };
    get().fetchConversations(newFilter);
  },

  // WebSocket handlers
  handleNewMessage: (message: Message) => {
    const { selectedConversationId } = get();

    // If this message belongs to the selected conversation, append it
    if (message.conversation_id === selectedConversationId) {
      set((state) => ({
        messages: [...state.messages, message],
      }));
    }

    // Update conversation in list - bump to top with new message
    set((state) => {
      const convIndex = state.conversations.findIndex((c) => c.id === message.conversation_id);
      if (convIndex === -1) return state;

      const updated = [...state.conversations];
      const conv = {
        ...updated[convIndex],
        last_message: message,
        updated_at: message.created_at,
        unread_count:
          message.conversation_id !== selectedConversationId
            ? (updated[convIndex].unread_count || 0) + 1
            : updated[convIndex].unread_count,
      };
      updated.splice(convIndex, 1);
      updated.unshift(conv);
      return { conversations: updated };
    });
  },

  handleConversationUpdated: (data: Partial<Conversation> & { id: number }) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === data.id ? { ...c, ...data } : c
      ),
      selectedConversation:
        state.selectedConversation?.id === data.id
          ? { ...state.selectedConversation, ...data }
          : state.selectedConversation,
    }));
  },
}));

/**
 * Shallow selector helper for useChatStore.
 * Use this when selecting multiple values to prevent unnecessary re-renders:
 *   const { messages, messagesLoading } = useChatStoreShallow((s) => ({
 *     messages: s.messages,
 *     messagesLoading: s.messagesLoading,
 *   }));
 */
export function useChatStoreShallow<T>(selector: (state: ChatState) => T): T {
  return useChatStore(useShallow(selector));
}
