import { useState, useMemo, useCallback } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, Crown, MessageSquare, Tag, Users } from 'lucide-react';
import Header from '../components/layout/Header';
import { useDebounceValue } from '../hooks/useDebounce';
import { UserCardSkeleton } from '../components/ui/Skeleton';
import { getUsers, getTags, getUserGroups } from '../services/usersApi';
import type { UserListItem, TagItem } from '../services/usersApi';

const AVATAR_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];

function UserAvatar({ user }: { user: UserListItem }) {
  const color = AVATAR_COLORS[user.id % AVATAR_COLORS.length];
  const initials = (user.first_name?.[0] ?? user.username?.[0] ?? '?').toUpperCase();
  return (
    <div
      className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-semibold font-['Space_Grotesk'] mx-auto"
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  );
}

function TagBadge({ tag }: { tag: TagItem }) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold font-['JetBrains_Mono']"
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
        className="w-8 h-8 flex items-center justify-center rounded-md text-[#6a6a6a] hover:text-white hover:bg-[#141414] border border-[#2f2f2f] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft size={16} />
      </button>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`dots-${i}`} className="px-2 text-[#6a6a6a] text-sm">...</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`w-8 h-8 flex items-center justify-center rounded-md text-sm transition-colors ${
              p === page
                ? 'bg-accent text-black font-semibold'
                : 'border border-[#2f2f2f] text-[#8a8a8a] hover:bg-[#141414]'
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="w-8 h-8 flex items-center justify-center rounded-md text-[#6a6a6a] hover:text-white hover:bg-[#141414] border border-[#2f2f2f] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

export default function UsersGrid() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedTag, _setSelectedTag] = useState('');
  const [selectedGroup, _setSelectedGroup] = useState<number | undefined>();
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Debounce search input by 300ms so API isn't hit on every keystroke
  const debouncedSearch = useDebounceValue(search, 300);

  const { data: _tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: getTags,
    staleTime: 60_000,
  });

  const { data: _groupsData } = useQuery({
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
    placeholderData: keepPreviousData,
  });

  const users = useMemo(() => usersData?.items ?? [], [usersData]);
  const totalPages = usersData?.total_pages ?? 0;

  const handlePageChange = useCallback((p: number) => setPage(p), []);

  return (
    <div className="flex flex-col h-full">
      <Header title="Users" />
      <div className="flex-1 px-8 py-6 overflow-y-auto">
        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#4a4a4a]" />
            <input
              type="text"
              placeholder="Search by TGUID, username, or tag..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full h-10 pl-10 pr-4 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-white placeholder:text-[#4a4a4a] focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <button
            className="inline-flex items-center gap-2 h-10 px-4 border border-[#2f2f2f] rounded-lg text-sm text-[#8a8a8a] hover:text-white hover:bg-[#141414] transition-colors"
          >
            <Tag size={14} />
            Tags
          </button>

          <button
            className="inline-flex items-center gap-2 h-10 px-4 border border-[#2f2f2f] rounded-lg text-sm text-[#8a8a8a] hover:text-white hover:bg-[#141414] transition-colors"
          >
            <Users size={14} />
            Groups
          </button>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <UserCardSkeleton key={i} />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="bg-[#0A0A0A] border border-[#2f2f2f] rounded-[10px] p-12 text-center text-[#6a6a6a] text-sm">
            No users found.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-4">
              {users.map((user: UserListItem) => (
                <div
                  key={user.id}
                  onClick={() => navigate(`/users/${user.id}`)}
                  className="bg-[#0A0A0A] border border-[#2f2f2f] rounded-[10px] p-5 cursor-pointer hover:border-accent/30 hover:bg-[#141414] transition-all text-center"
                >
                  <UserAvatar user={user} />

                  <div className="mt-3 mb-1">
                    <div className="flex items-center justify-center gap-1.5">
                      <p className="text-[15px] font-semibold text-white truncate">
                        {user.first_name ?? 'Unknown'} {user.last_name ?? ''}
                      </p>
                      {user.is_premium && <Crown size={12} className="text-[#FFD700] shrink-0" />}
                    </div>
                    {user.username && (
                      <p className="text-[12px] text-accent font-['JetBrains_Mono'] mt-0.5">@{user.username}</p>
                    )}
                  </div>

                  {/* Tags */}
                  {user.tags.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-1 my-2">
                      {user.tags.map((tag) => (
                        <TagBadge key={tag.id} tag={tag} />
                      ))}
                    </div>
                  )}

                  {/* Info rows */}
                  <div className="space-y-1.5 mt-3 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#6a6a6a]">TGUID</span>
                      <span className="text-[11px] text-[#8a8a8a] font-['JetBrains_Mono']">{user.tg_uid}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#6a6a6a]">DC</span>
                      <span className="text-[11px] text-[#8a8a8a] font-['JetBrains_Mono']">{user.dc_id ?? '--'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#6a6a6a]">Region</span>
                      <span className="text-[11px] text-[#8a8a8a] font-['JetBrains_Mono']">{user.phone_region ?? '--'}</span>
                    </div>
                  </div>

                  {/* Message count */}
                  <div className="flex items-center justify-center gap-1 mt-3 text-[#6a6a6a]">
                    <MessageSquare size={12} />
                    <span className="text-[11px] font-['JetBrains_Mono']">{user.message_count}</span>
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
