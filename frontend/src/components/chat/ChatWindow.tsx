import { useCallback, useEffect, useRef } from 'react';
import {
  Ban,
  CheckCircle2,
  ChevronUp,
  Loader2,
  MapPin,
  RotateCcw,
  User,
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useChatStore } from '../../stores/chatStore';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import type { Conversation } from '../../types';

function getDisplayName(conv: Conversation): string {
  const user = conv.user;
  return user.first_name
    ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`
    : user.username || `User#${user.telegram_id || user.tg_uid}`;
}

function getAvatarColor(id: number): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  ];
  return colors[id % colors.length];
}

function getInitials(conv: Conversation): string {
  const user = conv.user;
  if (user.first_name) {
    return (user.first_name[0] + (user.last_name?.[0] || '')).toUpperCase();
  }
  if (user.username) return user.username[0].toUpperCase();
  return '?';
}

export default function ChatWindow() {
  const selectedConversation = useChatStore((s) => s.selectedConversation);
  const selectedConversationId = useChatStore((s) => s.selectedConversationId);
  const messages = useChatStore((s) => s.messages);
  const messagesLoading = useChatStore((s) => s.messagesLoading);
  const hasMoreMessages = useChatStore((s) => s.hasMoreMessages);
  const loadMoreMessages = useChatStore((s) => s.loadMoreMessages);
  const updateConversationStatus = useChatStore((s) => s.updateConversationStatus);
  const conversations = useChatStore((s) => s.conversations);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(0);

  // Get the conversation from the list if selectedConversation is null
  const conv =
    selectedConversation ??
    (selectedConversationId
      ? conversations.find((c) => c.id === selectedConversationId) ?? null
      : null);

  // Virtual scrolling for messages
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => messagesContainerRef.current,
    estimateSize: () => 80, // estimated message height
    overscan: 10,
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      const isLoadingOlder = prevMessageCount.current > 0 && messages.length - prevMessageCount.current > 1;
      if (!isLoadingOlder) {
        // Scroll to the last virtual item
        requestAnimationFrame(() => {
          virtualizer.scrollToIndex(messages.length - 1, { align: 'end', behavior: 'smooth' });
        });
      }
    }
    prevMessageCount.current = messages.length;
  }, [messages.length, virtualizer]);

  // Scroll to bottom on conversation change
  useEffect(() => {
    if (selectedConversationId && messages.length > 0) {
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(messages.length - 1, { align: 'end' });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversationId]);

  const handleLoadMore = useCallback(() => {
    loadMoreMessages();
  }, [loadMoreMessages]);

  const handleToggleStatus = useCallback(() => {
    if (!conv) return;
    const newStatus = conv.status === 'resolved' ? 'open' : 'resolved';
    updateConversationStatus(conv.id, newStatus);
  }, [conv, updateConversationStatus]);

  if (!conv) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
        Select a conversation to start chatting.
      </div>
    );
  }

  const user = conv.user;
  const tags = user.tags || [];
  const tgUid = user.telegram_id || user.tg_uid || '';
  const botName =
    conv.primary_bot?.bot_username ||
    conv.primary_bot?.display_name ||
    undefined;
  const isResolved = conv.status === 'resolved';

  return (
    <div className="flex-1 flex flex-col h-full min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-bg-card shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white shrink-0"
            style={{ backgroundColor: getAvatarColor(conv.id) }}
          >
            {getInitials(conv)}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text-primary truncate">
                {getDisplayName(conv)}
              </span>
              {user.is_premium && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple/10 text-purple font-medium">
                  Premium
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-text-muted">
              <span className="font-mono">{tgUid}</span>
              {user.dc_id && (
                <span className="flex items-center gap-0.5">
                  <MapPin size={9} />
                  DC{user.dc_id}
                </span>
              )}
              {user.phone_region && <span>{user.phone_region}</span>}
              {(conv.source === 'group' || conv.source_type === 'group') && (
                <span className="text-accent">
                  # {conv.group_name || conv.source_group?.title || 'Group'}
                </span>
              )}
            </div>
          </div>

          {tags.length > 0 && (
            <div className="flex gap-1 ml-2">
              {tags.map((tag, i) => {
                const tagName = typeof tag === 'string' ? tag : tag.name;
                const tagColor = typeof tag === 'string' ? '#3B82F6' : tag.color;
                return (
                  <span
                    key={i}
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: tagColor + '20',
                      color: tagColor,
                    }}
                  >
                    {tagName}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red hover:bg-red/10 border border-red/20 transition-colors"
            title="Block user"
          >
            <Ban size={13} />
            Block
          </button>

          <button
            onClick={handleToggleStatus}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isResolved
                ? 'text-orange hover:bg-orange/10 border border-orange/20'
                : 'text-green hover:bg-green/10 border border-green/20'
            }`}
          >
            {isResolved ? (
              <>
                <RotateCcw size={13} />
                Reopen
              </>
            ) : (
              <>
                <CheckCircle2 size={13} />
                Resolve
              </>
            )}
          </button>
        </div>
      </div>

      {/* Messages area with virtual scrolling */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-6 py-4"
      >
        {/* Load more button */}
        {hasMoreMessages && (
          <div className="flex justify-center mb-4">
            <button
              onClick={handleLoadMore}
              disabled={messagesLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-muted hover:text-text-secondary bg-bg-elevated rounded-full border border-border-subtle transition-colors disabled:opacity-50"
            >
              {messagesLoading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <ChevronUp size={12} />
              )}
              Load older messages
            </button>
          </div>
        )}

        {/* Loading state */}
        {messagesLoading && messages.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-text-muted" />
          </div>
        )}

        {/* Empty state */}
        {!messagesLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-text-muted text-sm">
            <User size={32} className="mb-2 opacity-50" />
            No messages yet.
          </div>
        )}

        {/* Virtualized message list */}
        {messages.length > 0 && (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const msg = messages[virtualRow.index];
              return (
                <div
                  key={msg.id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <MessageBubble message={msg} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Input */}
      <MessageInput
        botName={botName}
        conversationId={conv.id}
        sourceType={conv.source_type || conv.source}
      />
    </div>
  );
}
