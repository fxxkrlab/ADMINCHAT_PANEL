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
      switch (event.type) {
        case 'new_message':
          handleNewMessage(event.data as Message);
          break;
        case 'conversation_updated':
          handleConversationUpdated(event.data as Conversation & { id: number });
          break;
      }
    },
    [handleNewMessage, handleConversationUpdated]
  );

  useWebSocket({ onMessage: onWSMessage });

  return (
    <div className="flex h-full overflow-hidden">
      <ConversationList />
      <ChatWindow />
    </div>
  );
}
