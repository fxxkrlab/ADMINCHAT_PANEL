import api from './api';
import type {
  FAQQuestion,
  FAQAnswer,
  FAQRule,
  FAQGroup,
  FAQCategory,
  FAQRankingItem,
  MissedKeyword,
  MissedKeywordFilter,
  MatchMode,
  ResponseMode,
  ReplyMode,
} from '../types';

// ---- Questions ----

export async function getQuestions(): Promise<FAQQuestion[]> {
  const { data } = await api.get('/faq/questions');
  return data.data;
}

export async function createQuestion(body: {
  keyword: string;
  match_mode: MatchMode;
}): Promise<FAQQuestion> {
  const { data } = await api.post('/faq/questions', body);
  return data.data;
}

export async function updateQuestion(
  id: number,
  body: Partial<{ keyword: string; match_mode: MatchMode; is_active: boolean }>
): Promise<FAQQuestion> {
  const { data } = await api.patch(`/faq/questions/${id}`, body);
  return data.data;
}

export async function deleteQuestion(id: number): Promise<void> {
  await api.delete(`/faq/questions/${id}`);
}

// ---- Answers ----

export async function getAnswers(): Promise<FAQAnswer[]> {
  const { data } = await api.get('/faq/answers');
  return data.data;
}

export async function createAnswer(body: {
  content: string;
  content_type?: string;
  media_file_id?: string;
}): Promise<FAQAnswer> {
  const { data } = await api.post('/faq/answers', body);
  return data.data;
}

export async function updateAnswer(
  id: number,
  body: Partial<{ content: string; content_type: string; media_file_id: string; is_active: boolean }>
): Promise<FAQAnswer> {
  const { data } = await api.patch(`/faq/answers/${id}`, body);
  return data.data;
}

export async function deleteAnswer(id: number): Promise<void> {
  await api.delete(`/faq/answers/${id}`);
}

// ---- Rules ----

export interface FAQRuleCreateData {
  name?: string;
  question_ids: number[];
  answer_ids: number[];
  response_mode: ResponseMode;
  reply_mode: ReplyMode;
  ai_config?: Record<string, unknown>;
  priority?: number;
  daily_ai_limit?: number;
  category_id?: number | null;
  is_active?: boolean;
}

export interface FAQRuleUpdateData {
  name?: string;
  question_ids?: number[];
  answer_ids?: number[];
  response_mode?: ResponseMode;
  reply_mode?: ReplyMode;
  ai_config?: Record<string, unknown>;
  priority?: number;
  daily_ai_limit?: number;
  category_id?: number | null;
  is_active?: boolean;
}

export async function getRules(params?: {
  reply_mode?: string;
  is_active?: boolean;
  category_id?: number;
  group_id?: number;
}): Promise<FAQRule[]> {
  const { data } = await api.get('/faq/rules', { params });
  return data.data;
}

export async function getRule(id: number): Promise<FAQRule> {
  // Fetch all rules and find the one - API doesn't have a single-rule endpoint
  const rules = await getRules();
  const rule = rules.find((r) => r.id === id);
  if (!rule) throw new Error(`Rule ${id} not found`);
  return rule;
}

export async function createRule(body: FAQRuleCreateData): Promise<FAQRule> {
  const { data } = await api.post('/faq/rules', body);
  return data.data;
}

export async function updateRule(
  id: number,
  body: FAQRuleUpdateData
): Promise<FAQRule> {
  const { data } = await api.patch(`/faq/rules/${id}`, body);
  return data.data;
}

export async function deleteRule(id: number): Promise<void> {
  await api.delete(`/faq/rules/${id}`);
}

// ---- Ranking ----

export async function getRanking(
  period?: 'today' | 'week' | 'month' | 'all'
): Promise<FAQRankingItem[]> {
  const { data } = await api.get('/faq/ranking', {
    params: period ? { period } : {},
  });
  return data.data;
}

// ---- Missed Keywords ----

export async function getMissedKeywords(): Promise<MissedKeyword[]> {
  const { data } = await api.get('/faq/missed-keywords');
  return data.data;
}

export async function deleteMissedKeyword(id: number): Promise<void> {
  await api.delete(`/faq/missed-keywords/${id}`);
}

// ---- Missed Keyword Filters ----

export async function getMissedKeywordFilters(): Promise<MissedKeywordFilter[]> {
  const { data } = await api.get('/faq/missed-keyword-filters');
  return data.data;
}

export async function createMissedKeywordFilter(body: {
  pattern: string;
  match_mode: 'exact' | 'prefix' | 'contains' | 'regex';
  description?: string;
}): Promise<MissedKeywordFilter> {
  const { data } = await api.post('/faq/missed-keyword-filters', body);
  return data.data;
}

export async function deleteMissedKeywordFilter(id: number): Promise<void> {
  await api.delete(`/faq/missed-keyword-filters/${id}`);
}

// ---- FAQ Groups ----

export async function getFAQGroups(): Promise<FAQGroup[]> {
  const { data } = await api.get('/faq/groups');
  return data.data;
}

export async function createFAQGroup(body: {
  name: string;
  description?: string;
  bot_group_id?: number | null;
  is_active?: boolean;
}): Promise<FAQGroup> {
  const { data } = await api.post('/faq/groups', body);
  return data.data;
}

export async function updateFAQGroup(
  id: number,
  body: Partial<{ name: string; description: string; bot_group_id: number | null; is_active: boolean }>
): Promise<FAQGroup> {
  const { data } = await api.patch(`/faq/groups/${id}`, body);
  return data.data;
}

export async function deleteFAQGroup(id: number): Promise<void> {
  await api.delete(`/faq/groups/${id}`);
}

// ---- FAQ Categories ----

export async function getFAQCategories(groupId?: number): Promise<FAQCategory[]> {
  const { data } = await api.get('/faq/categories', {
    params: groupId ? { group_id: groupId } : {},
  });
  return data.data;
}

export async function createFAQCategory(body: {
  name: string;
  faq_group_id: number;
  bot_group_id?: number | null;
  is_active?: boolean;
}): Promise<FAQCategory> {
  const { data } = await api.post('/faq/categories', body);
  return data.data;
}

export async function updateFAQCategory(
  id: number,
  body: Partial<{ name: string; bot_group_id: number | null; is_active: boolean }>
): Promise<FAQCategory> {
  const { data } = await api.patch(`/faq/categories/${id}`, body);
  return data.data;
}

export async function deleteFAQCategory(id: number): Promise<void> {
  await api.delete(`/faq/categories/${id}`);
}
