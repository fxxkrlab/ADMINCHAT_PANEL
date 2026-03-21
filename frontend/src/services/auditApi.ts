import api from './api';

export interface AuditLogEntry {
  id: number;
  admin_id: number | null;
  admin_username: string | null;
  action: string;
  target_type: string | null;
  target_id: number | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export interface AuditLogListResponse {
  items: AuditLogEntry[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AuditLogFilters {
  page?: number;
  page_size?: number;
  admin_id?: number;
  action?: string;
  target_type?: string;
  date_from?: string;
  date_to?: string;
}

export async function getAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogListResponse> {
  const params = new URLSearchParams();

  if (filters.page) params.set('page', String(filters.page));
  if (filters.page_size) params.set('page_size', String(filters.page_size));
  if (filters.admin_id) params.set('admin_id', String(filters.admin_id));
  if (filters.action) params.set('action', filters.action);
  if (filters.target_type) params.set('target_type', filters.target_type);
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);

  const { data } = await api.get(`/audit-logs?${params.toString()}`);
  return data.data;
}
