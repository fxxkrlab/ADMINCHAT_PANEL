import api from './api';
import type { SettingItem } from '../types';

export async function getSettings(): Promise<{ items: SettingItem[] }> {
  const { data } = await api.get('/settings');
  return data.data;
}

export async function updateSettings(settings: Record<string, unknown>): Promise<{ items: SettingItem[] }> {
  const { data } = await api.patch('/settings', { settings });
  return data.data;
}

export interface VersionInfo {
  current_version: string;
  build_version: string;
  latest_version: string | null;
  update_available: boolean;
}

export async function getVersionInfo(): Promise<VersionInfo> {
  const { data } = await api.get('/settings/version');
  return data.data;
}
