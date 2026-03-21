import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Crown, Shield, ShieldOff, Tag, Users, MessageSquare,
  Globe, Smartphone, Clock, CheckCircle, XCircle, Plus, X, ExternalLink,
} from 'lucide-react';
import Header from '../components/layout/Header';
import {
  getUserDetail, getTags, getUserGroups,
  blockUser, unblockUser, addTagToUser, removeTagFromUser, addUserToGroup,
} from '../services/usersApi';
import type { TagItem, UserGroupItem } from '../services/usersApi';

const AVATAR_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];

import { formatDateTime } from '../utils/time';

function formatDate(iso?: string | null) {
  if (!iso) return '--';
  return formatDateTime(iso);
}

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = Number(id);

  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [showBlockModal, setShowBlockModal] = useState(false);

  const { data: user, isLoading } = useQuery({
    queryKey: ['user-detail', userId],
    queryFn: () => getUserDetail(userId),
    enabled: !!userId,
  });

  const { data: allTags } = useQuery({
    queryKey: ['tags'],
    queryFn: getTags,
  });

  const { data: allGroups } = useQuery({
    queryKey: ['user-groups'],
    queryFn: getUserGroups,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['user-detail', userId] });

  const blockMutation = useMutation({
    mutationFn: (reason?: string) => blockUser(userId, reason),
    onSuccess: () => { invalidate(); setShowBlockModal(false); setBlockReason(''); },
  });

  const unblockMutation = useMutation({
    mutationFn: () => unblockUser(userId),
    onSuccess: invalidate,
  });

  const addTagMutation = useMutation({
    mutationFn: (tagId: number) => addTagToUser(userId, tagId),
    onSuccess: () => { invalidate(); setShowTagPicker(false); },
  });

  const removeTagMutation = useMutation({
    mutationFn: (tagId: number) => removeTagFromUser(userId, tagId),
    onSuccess: invalidate,
  });

  const addGroupMutation = useMutation({
    mutationFn: (groupId: number) => addUserToGroup(userId, groupId),
    onSuccess: () => { invalidate(); setShowGroupPicker(false); },
  });

  if (isLoading || !user) {
    return (
      <div className="flex flex-col h-full">
        <Header title="User Detail" />
        <div className="flex-1 flex items-center justify-center text-[#6a6a6a] text-sm">
          {isLoading ? 'Loading...' : 'User not found'}
        </div>
      </div>
    );
  }

  const avatarColor = AVATAR_COLORS[user.id % AVATAR_COLORS.length];
  const initials = (user.first_name?.[0] ?? user.username?.[0] ?? '?').toUpperCase();
  const assignedTagIds = new Set(user.tags.map((t) => t.id));
  const assignedGroupIds = new Set(user.groups.map((g) => g.id));
  const availableTags = (allTags ?? []).filter((t: TagItem) => !assignedTagIds.has(t.id));
  const availableGroups = (allGroups ?? []).filter((g: UserGroupItem) => !assignedGroupIds.has(g.id));

  return (
    <div className="flex flex-col h-full">
      <Header title={`User: ${user.first_name ?? user.username ?? `#${user.id}`}`} />
      <div className="flex-1 p-8 overflow-y-auto">
        {/* Back button */}
        <button
          onClick={() => navigate('/users')}
          className="flex items-center gap-1.5 text-sm text-[#6a6a6a] hover:text-[#00D9FF] mb-4 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Users
        </button>

        <div className="grid grid-cols-3 gap-6">
          {/* Left column: User info */}
          <div className="col-span-2 space-y-4">
            {/* Profile card */}
            <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-6">
              <div className="flex items-start gap-5">
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-semibold font-['Space_Grotesk'] shrink-0"
                  style={{ backgroundColor: avatarColor }}
                >
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-xl font-semibold text-[#FFFFFF] font-['Space_Grotesk']">
                      {user.first_name ?? ''} {user.last_name ?? ''}
                    </h2>
                    {user.is_premium && <Crown size={16} className="text-[#FFD700]" />}
                    {user.is_blocked && (
                      <span className="px-2 py-0.5 rounded text-xs bg-[#FF4444]/10 text-[#FF4444] border border-red/20">
                        BLOCKED
                      </span>
                    )}
                  </div>
                  {user.username && (
                    <p className="text-sm text-[#00D9FF] font-mono mb-3">@{user.username}</p>
                  )}

                  <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                    <InfoRow icon={Smartphone} label="TGUID" value={String(user.tg_uid)} mono />
                    <InfoRow icon={Globe} label="DC" value={user.dc_id ? `DC ${user.dc_id}` : '--'} mono />
                    <InfoRow icon={Globe} label="Region" value={user.phone_region ?? '--'} />
                    <InfoRow icon={Globe} label="Language" value={user.language_code ?? '--'} />
                    <InfoRow icon={Clock} label="First Seen" value={formatDate(user.first_seen_at)} />
                    <InfoRow icon={Clock} label="Last Active" value={formatDate(user.last_active_at)} />
                    <InfoRow icon={MessageSquare} label="Messages" value={String(user.total_messages)} mono />
                    <InfoRow icon={MessageSquare} label="Conversations" value={String(user.conversations_count)} mono />
                  </div>
                </div>
              </div>
            </div>

            {/* Turnstile verification */}
            <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <Shield size={16} className="text-[#00D9FF]" />
                <h3 className="text-sm font-semibold text-[#FFFFFF] font-['Space_Grotesk']">Turnstile Verification</h3>
              </div>
              <div className="flex items-center gap-3">
                {user.turnstile_verified ? (
                  <>
                    <CheckCircle size={16} className="text-[#059669]" />
                    <span className="text-sm text-[#059669]">Verified</span>
                    {user.turnstile_expires_at && (
                      <span className="text-xs text-[#6a6a6a] ml-2">
                        Expires: {formatDate(user.turnstile_expires_at)}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <XCircle size={16} className="text-[#FF4444]" />
                    <span className="text-sm text-[#FF4444]">Not Verified</span>
                  </>
                )}
              </div>
            </div>

            {/* Conversation history */}
            <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare size={16} className="text-[#00D9FF]" />
                <h3 className="text-sm font-semibold text-[#FFFFFF] font-['Space_Grotesk']">Conversation History</h3>
              </div>
              {user.conversations.length === 0 ? (
                <p className="text-sm text-[#6a6a6a] py-2">No conversations yet.</p>
              ) : (
                <div className="space-y-2">
                  {user.conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => navigate(`/chat/${conv.id}`)}
                      className="flex items-center justify-between px-4 py-3 rounded-lg bg-[#141414] cursor-pointer hover:bg-[#141414]/80 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-2 h-2 rounded-full ${
                          conv.status === 'open' ? 'bg-[#FF8800]' : conv.status === 'resolved' ? 'bg-[#059669]' : 'bg-[#FF4444]'
                        }`} />
                        <div>
                          <p className="text-sm text-[#FFFFFF]">
                            #{conv.id} - {conv.source_type}
                          </p>
                          <p className="text-xs text-[#6a6a6a]">{formatDate(conv.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          conv.status === 'open'
                            ? 'bg-[#FF8800]/10 text-[#FF8800]'
                            : conv.status === 'resolved'
                            ? 'bg-[#059669]/10 text-[#059669]'
                            : 'bg-[#FF4444]/10 text-[#FF4444]'
                        }`}>
                          {conv.status}
                        </span>
                        <ExternalLink size={14} className="text-[#6a6a6a] group-hover:text-[#00D9FF] transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column: Tags, Groups, Actions */}
          <div className="space-y-4">
            {/* Tags management */}
            <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Tag size={16} className="text-[#00D9FF]" />
                  <h3 className="text-sm font-semibold text-[#FFFFFF] font-['Space_Grotesk']">Tags</h3>
                </div>
                <button
                  onClick={() => setShowTagPicker(!showTagPicker)}
                  className="w-6 h-6 rounded flex items-center justify-center text-[#6a6a6a] hover:text-[#00D9FF] hover:bg-[#00D9FF]/10 transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-2">
                {user.tags.length === 0 ? (
                  <p className="text-xs text-[#6a6a6a]">No tags assigned</p>
                ) : (
                  user.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
                      style={{
                        backgroundColor: `${tag.color}20`,
                        color: tag.color,
                        border: `1px solid ${tag.color}40`,
                      }}
                    >
                      {tag.name}
                      <button
                        onClick={() => removeTagMutation.mutate(tag.id)}
                        className="hover:opacity-70 transition-opacity"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))
                )}
              </div>

              {showTagPicker && (
                <div className="border-t border-[#1A1A1A] pt-2 mt-2 space-y-1">
                  {availableTags.length > 0 ? (
                    availableTags.map((tag: TagItem) => (
                      <button
                        key={tag.id}
                        onClick={() => addTagMutation.mutate(tag.id)}
                        className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-[#141414] transition-colors"
                      >
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                        <span className="text-[#8a8a8a]">{tag.name}</span>
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-[#6a6a6a] py-1">No more tags available</p>
                  )}
                </div>
              )}
            </div>

            {/* Groups management */}
            <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-[#00D9FF]" />
                  <h3 className="text-sm font-semibold text-[#FFFFFF] font-['Space_Grotesk']">Groups</h3>
                </div>
                <button
                  onClick={() => setShowGroupPicker(!showGroupPicker)}
                  className="w-6 h-6 rounded flex items-center justify-center text-[#6a6a6a] hover:text-[#00D9FF] hover:bg-[#00D9FF]/10 transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>

              <div className="space-y-1.5">
                {user.groups.length === 0 ? (
                  <p className="text-xs text-[#6a6a6a]">No groups assigned</p>
                ) : (
                  user.groups.map((group) => (
                    <div
                      key={group.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#141414]"
                    >
                      <Users size={12} className="text-[#8B5CF6]" />
                      <span className="text-sm text-[#FFFFFF]">{group.name}</span>
                    </div>
                  ))
                )}
              </div>

              {showGroupPicker && (
                <div className="border-t border-[#1A1A1A] pt-2 mt-2 space-y-1">
                  {availableGroups.length > 0 ? (
                    availableGroups.map((group: UserGroupItem) => (
                      <button
                        key={group.id}
                        onClick={() => addGroupMutation.mutate(group.id)}
                        className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-[#141414] transition-colors"
                      >
                        <Users size={12} className="text-[#6a6a6a]" />
                        <span className="text-[#8a8a8a]">{group.name}</span>
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-[#6a6a6a] py-1">No more groups available</p>
                  )}
                </div>
              )}
            </div>

            {/* Block / Unblock */}
            <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-6">
              <h3 className="text-sm font-semibold text-[#FFFFFF] font-['Space_Grotesk'] mb-3">Actions</h3>
              {user.is_blocked ? (
                <div>
                  {user.block_reason && (
                    <p className="text-xs text-[#6a6a6a] mb-2">
                      Reason: <span className="text-[#FF4444]">{user.block_reason}</span>
                    </p>
                  )}
                  <button
                    onClick={() => unblockMutation.mutate()}
                    disabled={unblockMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#059669]/10 text-[#059669] border border-green/20 hover:bg-[#059669]/20 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    <ShieldOff size={16} />
                    {unblockMutation.isPending ? 'Unblocking...' : 'Unblock User'}
                  </button>
                </div>
              ) : (
                <>
                  {!showBlockModal ? (
                    <button
                      onClick={() => setShowBlockModal(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#FF4444]/10 text-[#FF4444] border border-red/20 hover:bg-[#FF4444]/20 transition-colors text-sm font-medium"
                    >
                      <Shield size={16} />
                      Block User
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Block reason (optional)"
                        value={blockReason}
                        onChange={(e) => setBlockReason(e.target.value)}
                        className="w-full h-11 px-4 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-[#FFFFFF] placeholder:text-[#4a4a4a] focus:outline-none focus:border-red transition-colors"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => blockMutation.mutate(blockReason || undefined)}
                          disabled={blockMutation.isPending}
                          className="flex-1 px-3 py-2 rounded-lg bg-[#FF4444] text-white text-sm font-medium hover:bg-red/80 transition-colors disabled:opacity-50"
                        >
                          {blockMutation.isPending ? 'Blocking...' : 'Confirm Block'}
                        </button>
                        <button
                          onClick={() => { setShowBlockModal(false); setBlockReason(''); }}
                          className="px-3 py-2 rounded-lg bg-[#141414] text-[#6a6a6a] text-sm hover:text-[#8a8a8a] transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, mono }: {
  icon: React.ElementType;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={13} className="text-[#6a6a6a] shrink-0" />
      <span className="text-xs text-[#6a6a6a] w-24">{label}</span>
      <span className={`text-xs text-[#8a8a8a] ${mono ? "font-['JetBrains_Mono']" : ''}`}>{value}</span>
    </div>
  );
}
