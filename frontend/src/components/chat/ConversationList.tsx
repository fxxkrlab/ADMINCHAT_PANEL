import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useChatStore } from '../../stores/chatStore';
import { useDebouncedCallback } from '../../hooks/useDebounce';
import { ConversationItemSkeleton } from '../ui/Skeleton';
import { formatRelativeTime } from '../../utils/time';
import type { Conversation } from '../../types';

type FilterTab = 'all' | 'open' | 'resolved';

function getInitials(conv: Conversation): string {
  const user = conv.user;
  if (user.first_name) {
    return (user.first_name[0] + (user.last_name?.[0] || '')).toUpperCase();
  }
  if (user.username) return user.username[0].toUpperCase();
  return '?';
}

function getAvatarColor(id: number): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#82E0AA', '#AED6F1', '#F1948A', '#BB8FCE',
  ];
  return colors[id % colors.length];
}

function getDisplayName(conv: Conversation): string {
  const user = conv.user;
  const name = user.first_name
    ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`
    : user.username || `User#${user.telegram_id || user.tg_uid}`;

  if (conv.source === 'group' || conv.source_type === 'group') {
    const groupName = conv.group_name || conv.source_group?.title || 'Group';
    return `# ${groupName} - ${name}`;
  }
  return name;
}

function getTgUid(conv: Conversation): string {
  return String(conv.user.telegram_id || conv.user.tg_uid || '');
}

function getLastMessagePreview(conv: Conversation): string {
  const msg = conv.last_message;
  if (!msg) return 'No messages yet';

  const text = msg.content || msg.text_content || '';
  if (text) return text.length > 50 ? text.slice(0, 50) + '...' : text;

  const type = msg.message_type || msg.content_type;
  if (type === 'photo') return '[Photo]';
  if (type === 'video') return '[Video]';
  if (type === 'document') return '[File]';
  if (type === 'sticker') return '[Sticker]';
  if (type === 'voice') return '[Voice]';
  return '[Message]';
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}

// Memoized individual conversation item to prevent re-renders
const ConversationItem = memo(function ConversationItem({
  conversation,
  isActive,
  onClick,
}: ConversationItemProps) {
  const unread = conversation.unread_count || 0;
  const status = conversation.status;
  const tags = conversation.user.tags || [];
  const lastMsgTime = conversation.last_message?.created_at || conversation.updated_at;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 border-b border-border-subtle transition-colors hover:bg-bg-elevated/50 ${
        isActive ? 'bg-bg-elevated' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white"
            style={{ backgroundColor: getAvatarColor(conversation.id) }}
          >
            {getInitials(conversation)}
          </div>
          {unread > 0 && (
            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-accent border-2 border-bg-card" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-text-primary truncate">
              {getDisplayName(conversation)}
            </span>
            <span className="text-[10px] text-text-muted shrink-0">
              {lastMsgTime ? formatRelativeTime(lastMsgTime) : ''}
            </span>
          </div>

          <div className="text-[11px] text-accent font-mono mt-0.5">
            {getTgUid(conversation)}
          </div>

          <div className="flex items-center justify-between gap-2 mt-1">
            <span className="text-xs text-text-secondary truncate">
              {getLastMessagePreview(conversation)}
            </span>
            <div
              className={`w-2 h-2 rounded-full shrink-0 ${
                status === 'open' || status === 'pending' || status === 'active'
                  ? 'bg-orange'
                  : status === 'resolved'
                    ? 'bg-green'
                    : 'bg-red'
              }`}
              title={status}
            />
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
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
      </div>
    </button>
  );
}, (prev, next) => {
  return (
    prev.conversation.id === next.conversation.id
    && prev.isActive === next.isActive
    && prev.conversation.unread_count === next.conversation.unread_count
    && prev.conversation.status === next.conversation.status
    && prev.conversation.last_message?.id === next.conversation.last_message?.id
    && prev.conversation.updated_at === next.conversation.updated_at
  );
});

export default function ConversationList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const conversations = useChatStore((s) => s.conversations);
  const conversationsLoading = useChatStore((s) => s.conversationsLoading);
  const selectedConversationId = useChatStore((s) => s.selectedConversationId);
  const fetchConversations = useChatStore((s) => s.fetchConversations);
  const selectConversation = useChatStore((s) => s.selectConversation);
  const setFilter = useChatStore((s) => s.setFilter);

  // Virtual scroll container ref
  const parentRef = useRef<HTMLDivElement>(null);

  // Initial fetch
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleTabChange = useCallback(
    (tab: FilterTab) => {
      setActiveTab(tab);
      if (tab === 'all') {
        setFilter({ status: undefined });
      } else {
        setFilter({ status: tab });
      }
    },
    [setFilter]
  );

  // Debounced search (300ms)
  const debouncedSetFilter = useDebouncedCallback(
    (value: string) => {
      setFilter({ search: value || undefined });
    },
    300,
  );

  const handleSearch = useCallback(
    (value: string) => {
      setSearchQuery(value);
      debouncedSetFilter(value);
    },
    [debouncedSetFilter]
  );

  // Memoize conversation click handlers to avoid re-creating on every render
  const handleConversationClick = useCallback(
    (id: number) => {
      selectConversation(id);
    },
    [selectConversation]
  );

  // Memoize the filtered/sorted conversation list
  const conversationList = useMemo(() => conversations, [conversations]);

  // Virtual scrolling for the conversation list
  const virtualizer = useVirtualizer({
    count: conversationList.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88, // estimated row height in px
    overscan: 5,
  });

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'resolved', label: 'Resolved' },
  ];

  return (
    <div className="flex flex-col h-full w-80 border-r border-border-subtle bg-bg-card shrink-0">
      {/* Search bar */}
      <div className="p-4 border-b border-border-subtle">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-placeholder"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by name, TGUID, or tag..."
            className="w-full h-11 pl-9 pr-4 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary placeholder:text-text-placeholder focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex border-b border-border-subtle">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? 'text-accent border-b-2 border-accent'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conversation list with virtual scrolling */}
      <div ref={parentRef} className="flex-1 overflow-y-auto">
        {conversationsLoading && conversations.length === 0 ? (
          <div className="space-y-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <ConversationItemSkeleton key={i} />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-3 py-8 text-center text-text-muted text-sm">
            No conversations found.
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const conv = conversationList[virtualRow.index];
              return (
                <div
                  key={conv.id}
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
                  <ConversationItem
                    conversation={conv}
                    isActive={conv.id === selectedConversationId}
                    onClick={() => handleConversationClick(conv.id)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
