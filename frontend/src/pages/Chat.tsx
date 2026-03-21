import { useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ConversationList from '../components/chat/ConversationList';
import ChatWindow from '../components/chat/ChatWindow';
import { useChatStore } from '../stores/chatStore';
import { useWebSocket } from '../hooks/useWebSocket';
import type { WSEvent, Message, Conversation } from '../types';

export default function Chat() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const selectConversation = useChatStore((s) => s.selectConversation);
  const handleNewMessage = useChatStore((s) => s.handleNewMessage);
  const handleConversationUpdated = useChatStore((s) => s.handleConversationUpdated);
  const handleNewConversation = useChatStore((s) => s.handleNewConversation);

  // Select conversation from URL param
  useEffect(() => {
    if (conversationId) {
      const id = parseInt(conversationId, 10);
      if (!isNaN(id)) {
        selectConversation(id);
      }
    }
  }, [conversationId, selectConversation]);

  // WebSocket integration
  const onWSMessage = useCallback(
    (event: WSEvent) => {
      console.log('[WS] Event received:', event.type);
      switch (event.type) {
        case 'new_message':
          handleNewMessage(event.data as Message);
          break;
        case 'conversation_updated':
          handleConversationUpdated(event.data as Conversation & { id: number });
          break;
      }

      // Handle new_conversation as a generic event (not in WSEvent union but backend may send it)
      if ((event as { type: string }).type === 'new_conversation') {
        handleNewConversation((event as unknown as { data: Conversation }).data);
      }
    },
    [handleNewMessage, handleConversationUpdated, handleNewConversation]
  );

  const { isConnected } = useWebSocket({ onMessage: onWSMessage });

  return (
    <div className="flex h-full overflow-hidden">
      <ConversationList />
      <ChatWindow />
      {/* WebSocket connection indicator */}
      <div className="fixed bottom-12 right-4 z-40">
        <div
          className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green' : 'bg-red'}`}
          title={isConnected ? 'WebSocket connected' : 'WebSocket disconnected'}
        />
      </div>
    </div>
  );
}
