// === Auth ===
export type Role = 'super_admin' | 'admin' | 'agent';

export interface Admin {
  id: number;
  username: string;
  role: Role;
  display_name?: string;
  is_active: boolean;
  created_at: string;
  last_login?: string;
}

export interface UserInfo {
  id: number;
  username: string;
  role: Role;
  display_name?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: UserInfo;
}

export interface APIResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: UserInfo;
}

// === Users ===
export interface UserTag {
  id: number;
  name: string;
  color: string;
}

export interface TelegramUser {
  id: number;
  telegram_id?: number;
  tg_uid?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  is_premium: boolean;
  dc_id?: number;
  phone_region?: string;
  language_code?: string;
  is_blocked?: boolean;
  photo_url?: string;
  tags: (string | UserTag)[];
  groups?: string[];
  is_blacklisted?: boolean;
  message_count?: number;
  created_at?: string;
  last_active_at?: string;
}

// === Conversations ===
export type ConversationStatus = 'pending' | 'active' | 'open' | 'resolved' | 'blocked';
export type ConversationSource = 'private' | 'group';

export interface SourceGroup {
  id: number;
  title?: string;
  tg_chat_id?: number;
}

export interface BotBrief {
  id: number;
  bot_username?: string;
  display_name?: string;
}

export interface AdminBrief {
  id: number;
  username: string;
  display_name?: string;
}

export interface Conversation {
  id: number;
  user: TelegramUser;
  status: ConversationStatus;
  source?: ConversationSource;
  source_type?: ConversationSource;
  source_group?: SourceGroup;
  group_name?: string;
  unread_count: number;
  last_message?: Message;
  assigned_admin_id?: number;
  assigned_to?: number;
  assigned_admin?: AdminBrief;
  primary_bot?: BotBrief;
  last_message_at?: string;
  created_at: string;
  updated_at: string;
}

// === Messages ===
export type MessageDirection = 'incoming' | 'outgoing' | 'inbound' | 'outbound';
export type SenderType = 'user' | 'admin' | 'bot' | 'faq' | 'ai';
export type MessageType = 'text' | 'photo' | 'video' | 'document' | 'sticker' | 'voice' | 'animation';

export interface Message {
  id: number;
  conversation_id: number;
  direction: MessageDirection;
  sender_type?: SenderType;
  message_type?: MessageType;
  content_type?: string;
  content?: string;
  text_content?: string;
  media_url?: string;
  media_thumbnail_url?: string;
  reply_to_message_id?: number;
  sent_by_admin_id?: number;
  sender_admin_id?: number;
  sender_admin_name?: string;
  sent_by_bot_name?: string;
  via_bot_id?: number;
  via_bot_name?: string;
  faq_matched?: boolean;
  faq_rule_id?: number;
  faq_rule_name?: string;
  created_at: string;
}

// === Bots ===
export type BotStatus = 'online' | 'rate_limited' | 'offline' | 'error';

export interface Bot {
  id: number;
  name: string;
  username: string;
  token_masked: string;
  status: BotStatus;
  priority: number;
  rate_limit_until?: string;
  message_count: number;
  is_active: boolean;
  bot_group_id?: number;
  bot_group_name?: string;
  created_at: string;
}

// === Bot Groups ===
export interface BotGroupMember {
  bot_id: number;
  bot_username?: string;
  display_name?: string;
}

export interface BotGroup {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
  members: BotGroupMember[];
  created_at: string;
  updated_at: string;
}

// === FAQ ===
export type MatchMode = 'exact' | 'prefix' | 'contains' | 'regex' | 'catch_all';
export type ResponseMode = 'single' | 'random' | 'all';
export type ReplyMode = 'direct' | 'ai_only' | 'ai_polish' | 'ai_fallback' | 'ai_intent' | 'ai_template' | 'rag' | 'ai_classify_and_answer';

export interface FAQQuestion {
  id: number;
  keyword: string;
  match_mode: MatchMode;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FAQAnswer {
  id: number;
  content: string;
  content_type: string;
  media_file_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FAQRule {
  id: number;
  name: string;
  questions: FAQQuestion[];
  answers: FAQAnswer[];
  response_mode: ResponseMode;
  reply_mode: ReplyMode;
  ai_config: Record<string, unknown>;
  priority: number;
  daily_ai_limit?: number;
  category_id?: number;
  category_name?: string;
  faq_group_id?: number;
  faq_group_name?: string;
  rag_config_id?: number;
  hit_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// === FAQ Groups & Categories ===
export interface FAQCategory {
  id: number;
  name: string;
  faq_group_id: number;
  bot_group_id?: number;
  bot_group_name?: string;
  is_active: boolean;
  rule_count?: number;
  created_at: string;
  updated_at: string;
}

export interface FAQGroup {
  id: number;
  name: string;
  description?: string;
  bot_group_id?: number;
  bot_group_name?: string;
  is_active: boolean;
  categories: FAQCategory[];
  created_at: string;
  updated_at: string;
}

export interface FAQRankingItem {
  rule_id: number;
  rule_name?: string;
  hit_count: number;
  last_hit_at?: string;
}

export interface MissedKeyword {
  id: number;
  keyword: string;
  occurrence_count: number;
  sample_messages?: string[];
  is_resolved: boolean;
  last_seen_at: string;
  created_at: string;
}

export interface MissedKeywordFilter {
  id: number;
  pattern: string;
  match_mode: 'exact' | 'prefix' | 'contains' | 'regex';
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// === AI ===
export type AuthMethod = 'api_key' | 'openai_oauth' | 'claude_oauth' | 'claude_session' | 'gemini_oauth';
export type OAuthStatus = 'active' | 'expiring' | 'expired' | 'no_token';

export interface AIConfig {
  id: number;
  name: string;
  provider: string;
  base_url: string;
  api_key_masked: string;
  model: string | null;
  default_params: {
    temperature?: number;
    max_tokens?: number;
    [key: string]: unknown;
  };
  is_active: boolean;
  auth_method: AuthMethod;
  oauth_status?: OAuthStatus | null;
  created_at: string;
  updated_at: string;
}

export interface AIConfigCreate {
  name: string;
  provider: string;
  base_url: string;
  api_key: string;
  model?: string;
  default_params?: Record<string, unknown>;
  is_active?: boolean;
}

export interface AIConfigUpdate {
  name?: string;
  provider?: string;
  base_url?: string;
  api_key?: string;
  model?: string;
  default_params?: Record<string, unknown>;
  is_active?: boolean;
}

export interface OAuthAuthUrlResponse {
  auth_url: string;
  state: string;
  flow_type: 'popup' | 'code_paste';
}

export interface OAuthStatusResponse {
  config_id: number;
  auth_method: string;
  oauth_status: OAuthStatus;
  expires_at?: number;
}

export interface AITestResult {
  success: boolean;
  response_text?: string;
  latency_ms: number;
  tokens_used: number;
  error?: string;
}

export interface AIUsageStats {
  total_requests: number;
  total_tokens: number;
  total_cost: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  daily_stats: Array<{
    date: string;
    requests: number;
    tokens: number;
    cost: number;
    prompt_tokens: number;
    completion_tokens: number;
  }>;
  per_config_stats: Array<{
    config_id: number;
    config_name: string;
    model: string;
    requests: number;
    tokens: number;
    cost: number;
    prompt_tokens: number;
    completion_tokens: number;
  }>;
}

// === RAG ===
export interface RagConfig {
  id: number;
  name: string;
  provider: string;
  base_url: string;
  api_key_masked: string;
  dataset_id: string;
  top_k: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RagConfigCreate {
  name: string;
  provider: string;
  base_url: string;
  api_key: string;
  dataset_id: string;
  top_k?: number;
}

export interface RagConfigUpdate {
  name?: string;
  provider?: string;
  base_url?: string;
  api_key?: string;
  dataset_id?: string;
  top_k?: number;
  is_active?: boolean;
}

export interface RAGTestResult {
  success: boolean;
  result_count: number;
  error?: string;
}

// === Settings ===
export interface SettingItem {
  key: string;
  value: unknown;
  description?: string;
  updated_at?: string;
}

export interface SystemSettings {
  turnstile_enabled: boolean;
  turnstile_secret_key: string;
  turnstile_valid_days: number;
  media_cache_days: number;
  auto_assign_enabled: boolean;
  missed_knowledge_update_hours: number;
  [key: string]: unknown;
}

// === Dashboard ===
export interface DashboardStats {
  total_received: number;
  total_handled: number;
  total_pending: number;
  total_blacklisted: number;
  faq_hit_rate: number;
  active_bots: number;
  total_bots: number;
}

// === WebSocket Events ===
export type WSEvent =
  | { type: 'new_message'; data: Message }
  | { type: 'new_conversation'; data: Conversation }
  | { type: 'conversation_updated'; data: Conversation }
  | { type: 'bot_status'; data: Bot }
  | { type: 'stats_update'; data: Partial<DashboardStats> };

// === Audit Log ===
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

// === Pagination ===
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
