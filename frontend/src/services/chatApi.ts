import api from './api';
import type { Conversation, Message, PaginatedResponse } from '../types';

export interface ConversationListParams {
  status?: string;
  source_type?: string;
  assigned_to?: number;
  search?: string;
  sort?: string;
  page?: number;
  page_size?: number;
}

export interface MessageListParams {
  page?: number;
  page_size?: number;
}

export interface SendMessageData {
  content_type?: string;
  text_content?: string;
  parse_mode?: string;
  file?: File;
}

export async function getConversations(
  params: ConversationListParams = {}
): Promise<PaginatedResponse<Conversation>> {
  const { data } = await api.get('/conversations', { params });
  return data.data;
}

export async function getConversation(id: number): Promise<Conversation> {
  const { data } = await api.get(`/conversations/${id}`);
  return data.data;
}

export async function getMessages(
  conversationId: number,
  params: MessageListParams = {}
): Promise<PaginatedResponse<Message>> {
  const { data } = await api.get(`/conversations/${conversationId}/messages`, { params });
  return data.data;
}

export async function sendMessage(
  conversationId: number,
  msgData: SendMessageData
): Promise<Message> {
  if (msgData.file) {
    const formData = new FormData();
    formData.append('file', msgData.file);
    if (msgData.text_content) formData.append('text_content', msgData.text_content);
    if (msgData.content_type) formData.append('content_type', msgData.content_type);
    if (msgData.parse_mode) formData.append('parse_mode', msgData.parse_mode);

    const { data } = await api.post(`/conversations/${conversationId}/messages`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data;
  }

  // Text-only: use FormData too since backend expects Form fields
  const formData = new FormData();
  formData.append('content_type', msgData.content_type || 'text');
  if (msgData.text_content) formData.append('text_content', msgData.text_content);
  if (msgData.parse_mode) formData.append('parse_mode', msgData.parse_mode);

  const { data } = await api.post(`/conversations/${conversationId}/messages`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}

export async function updateConversationStatus(
  id: number,
  status: string
): Promise<{ id: number; status: string }> {
  const { data } = await api.patch(`/conversations/${id}/status`, { status });
  return data.data;
}

export async function assignConversation(
  id: number,
  assignedTo: number | null
): Promise<{ id: number; assigned_to: number | null }> {
  const { data } = await api.patch(`/conversations/${id}/assign`, { assigned_to: assignedTo });
  return data.data;
}
