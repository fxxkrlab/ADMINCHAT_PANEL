import api from './api';
import type { AIConfig, AIConfigCreate, AIConfigUpdate, AITestResult, AIUsageStats } from '../types';

export async function getAIConfigs(): Promise<{ items: AIConfig[]; total: number }> {
  const { data } = await api.get('/ai/configs');
  return data.data;
}

export async function createAIConfig(body: AIConfigCreate): Promise<AIConfig> {
  const { data } = await api.post('/ai/configs', body);
  return data.data;
}

export async function updateAIConfig(id: number, body: AIConfigUpdate): Promise<AIConfig> {
  const { data } = await api.patch(`/ai/configs/${id}`, body);
  return data.data;
}

export async function deleteAIConfig(id: number): Promise<void> {
  await api.delete(`/ai/configs/${id}`);
}

export async function testAIConfig(id: number): Promise<AITestResult> {
  const { data } = await api.post(`/ai/configs/${id}/test`);
  return data.data;
}

export async function getAIUsage(days: number = 30): Promise<AIUsageStats> {
  const { data } = await api.get('/ai/usage', { params: { days } });
  return data.data;
}
