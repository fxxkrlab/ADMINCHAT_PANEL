import api from './api';
import type { PaginatedResponse } from '../types';

// === Types ===
export interface TagItem {
  id: number;
  name: string;
  color: string;
}

export interface UserGroupItem {
  id: number;
  name: string;
  description?: string;
  member_count?: number;
}

export interface UserListItem {
  id: number;
  tg_uid: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  is_premium: boolean;
  dc_id?: number;
  phone_region?: string;
  is_blocked: boolean;
  tags: TagItem[];
  message_count: number;
  last_active_at?: string;
}

export interface ConversationBrief {
  id: number;
  source_type: string;
  status: string;
  last_message_at?: string;
  created_at?: string;
}

export interface UserDetailData {
  id: number;
  tg_uid: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
  is_premium: boolean;
  dc_id?: number;
  phone_region?: string;
  is_blocked: boolean;
  block_reason?: string;
  tags: TagItem[];
  groups: UserGroupItem[];
  turnstile_verified: boolean;
  turnstile_expires_at?: string;
  first_seen_at?: string;
  last_active_at?: string;
  total_messages: number;
  conversations_count: number;
  conversations: ConversationBrief[];
}

export interface BlacklistUser {
  id: number;
  tg_uid: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  is_blocked: boolean;
  block_reason?: string;
  tags: TagItem[];
  last_active_at?: string;
  updated_at?: string;
}

export interface DashboardStatsData {
  total_conversations: number;
  open_conversations: number;
  resolved_conversations: number;
  blocked_users: number;
  total_messages_today: number;
  faq_hit_rate: number;
  active_bots: number;
  total_bots: number;
  trends: {
    conversations: number;
    messages: number;
  };
  bot_pool: Array<{
    id: number;
    name: string;
    username?: string;
    status: 'online' | 'limited' | 'offline';
    rate_limit_remaining?: number | null;
  }>;
  faq_top: Array<{
    rule_id: number;
    name: string;
    hits: number;
  }>;
  missed_keywords: Array<{
    id: number;
    keyword: string;
    count: number;
    last_seen?: string;
  }>;
}

// === User API ===

export interface UserListParams {
  page?: number;
  page_size?: number;
  search?: string;
  tag?: string;
  group_id?: number;
  is_blocked?: boolean;
}

export async function getUsers(params: UserListParams = {}): Promise<PaginatedResponse<UserListItem>> {
  const { data } = await api.get('/users', { params });
  return data.data;
}

export async function searchUsers(params: {
  tg_uid?: number;
  username?: string;
  tag?: string;
  group_id?: number;
}): Promise<UserListItem[]> {
  const { data } = await api.get('/users/search', { params });
  return data.data;
}

export async function getUserDetail(id: number): Promise<UserDetailData> {
  const { data } = await api.get(`/users/${id}`);
  return data.data;
}

export async function blockUser(id: number, reason?: string): Promise<void> {
  await api.post(`/users/${id}/block`, { reason });
}

export async function unblockUser(id: number): Promise<void> {
  await api.post(`/users/${id}/unblock`);
}

export async function addTagToUser(userId: number, tagId: number): Promise<TagItem> {
  const { data } = await api.post(`/users/${userId}/tags`, { tag_id: tagId });
  return data.data;
}

export async function removeTagFromUser(userId: number, tagId: number): Promise<void> {
  await api.delete(`/users/${userId}/tags/${tagId}`);
}

export async function addUserToGroup(userId: number, groupId: number): Promise<void> {
  await api.post(`/users/${userId}/groups`, { group_id: groupId });
}

// === Tags API ===

export async function getTags(): Promise<TagItem[]> {
  const { data } = await api.get('/tags');
  return data.data;
}

export async function createTag(name: string, color: string): Promise<TagItem> {
  const { data } = await api.post('/tags', { name, color });
  return data.data;
}

export async function deleteTag(id: number): Promise<void> {
  await api.delete(`/tags/${id}`);
}

// === User Groups API ===

export async function getUserGroups(): Promise<UserGroupItem[]> {
  const { data } = await api.get('/user-groups');
  return data.data;
}

export async function createUserGroup(name: string, description?: string): Promise<UserGroupItem> {
  const { data } = await api.post('/user-groups', { name, description });
  return data.data;
}

export async function deleteUserGroup(id: number): Promise<void> {
  await api.delete(`/user-groups/${id}`);
}

// === Blacklist API ===

export async function getBlacklist(params: {
  page?: number;
  page_size?: number;
} = {}): Promise<PaginatedResponse<BlacklistUser>> {
  const { data } = await api.get('/blacklist', { params });
  return data.data;
}

// === Dashboard Stats API ===

export async function getDashboardStats(): Promise<DashboardStatsData> {
  const { data } = await api.get('/stats/dashboard');
  return data.data;
}
