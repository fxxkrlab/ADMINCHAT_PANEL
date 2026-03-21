import api from './api';
import type { Admin } from '../types';

export interface AdminCreateData {
  username: string;
  password: string;
  display_name?: string;
  email?: string;
  role: string;
}

export interface AdminUpdateData {
  display_name?: string;
  email?: string;
  role?: string;
  password?: string;
  is_active?: boolean;
}

export async function getAdmins(): Promise<{ items: Admin[]; total: number }> {
  const { data } = await api.get('/admins');
  return data.data;
}

export async function createAdmin(body: AdminCreateData): Promise<Admin> {
  const { data } = await api.post('/admins', body);
  return data.data;
}

export async function updateAdmin(id: number, body: AdminUpdateData): Promise<Admin> {
  const { data } = await api.patch(`/admins/${id}`, body);
  return data.data;
}

export async function deactivateAdmin(id: number): Promise<void> {
  await api.delete(`/admins/${id}`);
}

export async function updateAdminPermissions(id: number, permissions: Record<string, unknown>): Promise<Admin> {
  const { data } = await api.patch(`/admins/${id}/permissions`, { permissions });
  return data.data;
}
