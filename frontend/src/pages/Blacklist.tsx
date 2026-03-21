import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldOff, ChevronLeft, ChevronRight } from 'lucide-react';
import Header from '../components/layout/Header';
import { getBlacklist, unblockUser } from '../services/usersApi';
import type { BlacklistUser } from '../services/usersApi';

const AVATAR_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];

function formatDate(iso?: string | null) {
  if (!iso) return '--';
  return new Date(iso).toLocaleString();
}

export default function Blacklist() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['blacklist', page, pageSize],
    queryFn: () => getBlacklist({ page, page_size: pageSize }),
  });

  const unblockMutation = useMutation({
    mutationFn: (userId: number) => unblockUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blacklist'] });
    },
  });

  const users = data?.items ?? [];
  const totalPages = data?.total_pages ?? 0;
  const total = data?.total ?? 0;

  return (
    <div className="flex flex-col h-full">
      <Header title="Blacklist" />
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="flex items-center justify-between mb-8">
          <p className="text-sm text-[#6a6a6a]">
            {total} blocked user{total !== 1 ? 's' : ''}
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-[#6a6a6a] text-sm">
            Loading...
          </div>
        ) : users.length === 0 ? (
          <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-12 text-center text-[#6a6a6a] text-sm">
            No blocked users.
          </div>
        ) : (
          <>
            <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[48px_1fr_120px_1fr_160px_160px_100px] gap-4 px-6 py-4 border-b border-[#1A1A1A] text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono']">
                <span />
                <span>Name</span>
                <span>TGUID</span>
                <span>Block Reason</span>
                <span>Blocked Date</span>
                <span>Last Active</span>
                <span className="text-right">Action</span>
              </div>

              {/* Rows */}
              {users.map((user: BlacklistUser) => {
                const avatarColor = AVATAR_COLORS[user.id % AVATAR_COLORS.length];
                const initials = (user.first_name?.[0] ?? user.username?.[0] ?? '?').toUpperCase();

                return (
                  <div
                    key={user.id}
                    className="grid grid-cols-[48px_1fr_120px_1fr_160px_160px_100px] gap-4 px-6 py-4 border-b border-[#1A1A1A] last:border-b-0 items-center hover:bg-[#141414]/50 transition-colors"
                  >
                    {/* Avatar */}
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                      style={{ backgroundColor: avatarColor }}
                    >
                      {initials}
                    </div>

                    {/* Name */}
                    <div className="min-w-0">
                      <p className="text-sm text-[#FFFFFF] truncate">
                        {user.first_name ?? 'Unknown'} {user.last_name ?? ''}
                      </p>
                      {user.username && (
                        <p className="text-xs text-[#00D9FF] font-mono truncate">@{user.username}</p>
                      )}
                    </div>

                    {/* TGUID */}
                    <span className="text-xs text-[#8a8a8a] font-['JetBrains_Mono']">
                      {user.tg_uid}
                    </span>

                    {/* Block Reason */}
                    <span className="text-xs text-[#FF4444] truncate" title={user.block_reason ?? undefined}>
                      {user.block_reason || '--'}
                    </span>

                    {/* Blocked Date */}
                    <span className="text-xs text-[#6a6a6a] font-['JetBrains_Mono']">
                      {formatDate(user.updated_at)}
                    </span>

                    {/* Last Active */}
                    <span className="text-xs text-[#6a6a6a] font-['JetBrains_Mono']">
                      {formatDate(user.last_active_at)}
                    </span>

                    {/* Action */}
                    <div className="flex justify-end">
                      <button
                        onClick={() => unblockMutation.mutate(user.id)}
                        disabled={unblockMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#059669]/10 text-[#059669] border border-green/20 hover:bg-[#059669]/20 transition-colors text-xs font-medium disabled:opacity-50"
                      >
                        <ShieldOff size={12} />
                        Unblock
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 mt-4">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg text-[#6a6a6a] hover:text-[#FFFFFF] hover:bg-[#141414] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm text-[#6a6a6a] px-3">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg text-[#6a6a6a] hover:text-[#FFFFFF] hover:bg-[#141414] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
