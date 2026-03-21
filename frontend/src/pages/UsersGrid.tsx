import { useState, useMemo, useCallback } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, Crown, MessageSquare } from 'lucide-react';
import Header from '../components/layout/Header';
import { useDebounceValue } from '../hooks/useDebounce';
import { UserCardSkeleton } from '../components/ui/Skeleton';
import { getUsers, getTags, getUserGroups } from '../services/usersApi';
import type { UserListItem, TagItem, UserGroupItem } from '../services/usersApi';

const AVATAR_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];

function UserAvatar({ user }: { user: UserListItem }) {
  const color = AVATAR_COLORS[user.id % AVATAR_COLORS.length];
  const initials = (user.first_name?.[0] ?? user.username?.[0] ?? '?').toUpperCase();
  return (
    <div
      className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-semibold font-['Space_Grotesk'] shrink-0"
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  );
}

function TagBadge({ tag }: { tag: TagItem }) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
      style={{
        backgroundColor: `${tag.color}20`,
        color: tag.color,
        border: `1px solid ${tag.color}40`,
      }}
    >
      {tag.name}
    </span>
  );
}

function Pagination({ page, totalPages, onPageChange }: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages: (number | '...')[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft size={16} />
      </button>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`dots-${i}`} className="px-2 text-text-muted text-sm">...</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`w-8 h-8 flex items-center justify-center rounded-md text-sm transition-colors ${
              p === page
                ? 'bg-accent text-black font-semibold'
                : 'border border-border text-text-secondary hover:bg-bg-elevated'
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

export default function UsersGrid() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<number | undefined>();
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Debounce search input by 300ms so API isn't hit on every keystroke
  const debouncedSearch = useDebounceValue(search, 300);

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: getTags,
    staleTime: 60_000,
  });

  const { data: groupsData } = useQuery({
    queryKey: ['user-groups'],
    queryFn: getUserGroups,
    staleTime: 60_000,
  });

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users', page, pageSize, debouncedSearch, selectedTag, selectedGroup],
    queryFn: () =>
      getUsers({
        page,
        page_size: pageSize,
        search: debouncedSearch || undefined,
        tag: selectedTag || undefined,
        group_id: selectedGroup,
      }),
    staleTime: 30_000,
    placeholderData: keepPreviousData, // Keep previous page data while loading next page
  });

  const users = useMemo(() => usersData?.items ?? [], [usersData]);
  const totalPages = usersData?.total_pages ?? 0;

  const handlePageChange = useCallback((p: number) => setPage(p), []);

  return (
    <div className="flex flex-col h-full">
      <Header title="Users" />
      <div className="flex-1 p-8 overflow-y-auto">
        {/* Filters */}
        <div className="flex items-center gap-3 mb-8">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-placeholder" />
            <input
              type="text"
              placeholder="Search by TGUID, username, or tag..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full h-11 pl-9 pr-4 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary placeholder:text-text-placeholder focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <select
            value={selectedTag}
            onChange={(e) => { setSelectedTag(e.target.value); setPage(1); }}
            className="h-11 px-4 bg-bg-elevated border border-border rounded-lg text-sm text-text-secondary focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer"
          >
            <option value="">All Tags</option>
            {tagsData?.map((tag: TagItem) => (
              <option key={tag.id} value={tag.name}>{tag.name}</option>
            ))}
          </select>

          <select
            value={selectedGroup ?? ''}
            onChange={(e) => { setSelectedGroup(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
            className="h-11 px-4 bg-bg-elevated border border-border rounded-lg text-sm text-text-secondary focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer"
          >
            <option value="">All Groups</option>
            {groupsData?.map((group: UserGroupItem) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <UserCardSkeleton key={i} />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="bg-bg-card border border-border-subtle rounded-xl p-12 text-center text-text-muted text-sm">
            No users found.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-6">
              {users.map((user: UserListItem) => (
                <div
                  key={user.id}
                  onClick={() => navigate(`/users/${user.id}`)}
                  className="bg-bg-card border border-border-subtle rounded-xl p-6 cursor-pointer hover:border-accent/30 hover:bg-bg-elevated transition-all group"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <UserAvatar user={user} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-text-primary truncate">
                          {user.first_name ?? 'Unknown'} {user.last_name ?? ''}
                        </p>
                        {user.is_premium && <Crown size={12} className="text-[#FFD700] shrink-0" />}
                      </div>
                      {user.username && (
                        <p className="text-xs text-accent font-mono">@{user.username}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-text-muted uppercase tracking-wide">TGUID</span>
                      <span className="text-xs text-text-secondary font-['JetBrains_Mono']">{user.tg_uid}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-text-muted uppercase tracking-wide">DC</span>
                      <span className="text-xs text-text-secondary font-['JetBrains_Mono']">{user.dc_id ?? '--'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-text-muted uppercase tracking-wide">Region</span>
                      <span className="text-xs text-text-secondary font-['JetBrains_Mono']">{user.phone_region ?? '--'}</span>
                    </div>
                  </div>

                  {/* Tags */}
                  {user.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {user.tags.map((tag) => (
                        <TagBadge key={tag.id} tag={tag} />
                      ))}
                    </div>
                  )}

                  {/* Message count */}
                  <div className="flex items-center gap-1 text-text-muted">
                    <MessageSquare size={12} />
                    <span className="text-xs font-['JetBrains_Mono']">{user.message_count}</span>
                  </div>
                </div>
              ))}
            </div>

            <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
          </>
        )}
      </div>
    </div>
  );
}
