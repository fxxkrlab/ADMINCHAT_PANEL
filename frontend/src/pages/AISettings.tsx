import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Zap, X, CheckCircle, XCircle, Loader2, BarChart3, Activity, Database } from 'lucide-react';
import Header from '../components/layout/Header';
import { getAIConfigs, createAIConfig, updateAIConfig, deleteAIConfig, testAIConfig, getAIUsage, getRAGConfig, saveRAGConfig, deleteRAGConfig, testRAGConfig } from '../services/aiConfigApi';
import type { AIConfig, AIConfigCreate, AIConfigUpdate, AITestResult, AIUsageStats, RAGTestResult, AuthMethod } from '../types';
import AuthMethodSelector from '../components/ai/AuthMethodSelector';
import OAuthFlowModal from '../components/ai/OAuthFlowModal';

// ---- Provider badge ----
function ProviderBadge({ provider }: { provider: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    openai: { color: 'text-[#059669]', bg: 'bg-[#059669]/10' },
    anthropic: { color: 'text-[#FF8800]', bg: 'bg-[#FF8800]/10' },
    custom: { color: 'text-[#8B5CF6]', bg: 'bg-[#8B5CF6]/10' },
  };
  const s = map[provider] || map.custom;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${s.color} ${s.bg}`}>
      {provider}
    </span>
  );
}

// ---- Auth method badge ----
function AuthMethodBadge({ method, status }: { method: string; status?: string | null }) {
  if (method === 'api_key') return null;
  const label = method.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const statusColors: Record<string, string> = {
    active: 'text-[#059669] bg-[#059669]/10',
    expiring: 'text-[#FF8800] bg-[#FF8800]/10',
    expired: 'text-[#FF4444] bg-[#FF4444]/10',
    no_token: 'text-[#6a6a6a] bg-[#141414]',
  };
  const sc = statusColors[status || 'no_token'] || statusColors.no_token;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${sc}`}>
      {label} {status && status !== 'active' ? `(${status})` : ''}
    </span>
  );
}

// ---- Tab definitions ----
const TABS = [
  { key: 'configs', label: 'AI Providers', icon: Zap },
  { key: 'rag', label: 'RAG Knowledge Base', icon: Database },
  { key: 'usage', label: 'Usage Statistics', icon: BarChart3 },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function AISettings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('configs');
  const [showForm, setShowForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<AIConfig | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<number, AITestResult | 'loading'>>({});
  const [addStep, setAddStep] = useState<'select_method' | 'form' | 'oauth'>('select_method');
  const [selectedAuthMethod, setSelectedAuthMethod] = useState<AuthMethod>('api_key');

  // RAG state
  const [ragProvider, setRagProvider] = useState<string>('disabled');
  const [ragBaseUrl, setRagBaseUrl] = useState('');
  const [ragApiKey, setRagApiKey] = useState('');
  const [ragDatasetId, setRagDatasetId] = useState('');
  const [ragTopK, setRagTopK] = useState(3);
  const [ragTestResult, setRagTestResult] = useState<RAGTestResult | null>(null);
  const [ragSaving, setRagSaving] = useState(false);
  const [ragTesting, setRagTesting] = useState(false);
  const [ragDeleteConfirm, setRagDeleteConfirm] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formProvider, setFormProvider] = useState('openai');
  const [formApiFormat, setFormApiFormat] = useState('openai_chat');
  const [formBaseUrl, setFormBaseUrl] = useState('https://api.openai.com/v1');
  const [formApiKey, setFormApiKey] = useState('');
  const [formModel, setFormModel] = useState('gpt-3.5-turbo');
  const [formTemperature, setFormTemperature] = useState(0.7);
  const [formMaxTokens, setFormMaxTokens] = useState(500);

  const { data: configsData, isLoading: configsLoading } = useQuery({
    queryKey: ['ai-configs'],
    queryFn: getAIConfigs,
  });

  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ['ai-usage'],
    queryFn: () => getAIUsage(30),
    enabled: activeTab === 'usage',
  });

  const { data: ragData, isLoading: ragLoading } = useQuery({
    queryKey: ['rag-config'],
    queryFn: getRAGConfig,
    enabled: activeTab === 'rag',
  });

  // Sync RAG form when data loads
  useEffect(() => {
    if (ragData) {
      if (ragData.source !== 'none' && ragData.provider) {
        setRagProvider(ragData.provider);
        setRagBaseUrl(ragData.dify_base_url || '');
        setRagDatasetId(ragData.dify_dataset_id || '');
        setRagTopK(ragData.top_k || 3);
      } else {
        setRagProvider('disabled');
      }
      setRagApiKey('');
      setRagTestResult(null);
    }
  }, [ragData]);

  const createMutation = useMutation({
    mutationFn: (body: AIConfigCreate) => createAIConfig(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-configs'] });
      setShowForm(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: AIConfigUpdate }) => updateAIConfig(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-configs'] });
      setEditingConfig(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAIConfig(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-configs'] });
      setDeleteConfirm(null);
    },
  });

  const configs = configsData?.items || [];
  const usage = usageData as AIUsageStats | undefined;

  const resetForm = () => {
    setFormName('');
    setFormProvider('openai');
    setFormApiFormat('openai_chat');
    setFormBaseUrl('https://api.openai.com/v1');
    setFormApiKey('');
    setFormModel('gpt-3.5-turbo');
    setFormTemperature(0.7);
    setFormMaxTokens(500);
  };

  const startEdit = (config: AIConfig) => {
    setEditingConfig(config);
    setFormName(config.name);
    setFormProvider(config.provider);
    setFormApiFormat((config as any).api_format || 'openai_chat');
    setFormBaseUrl(config.base_url);
    setFormApiKey(''); // Don't prefill API key
    setFormModel(config.model || '');
    setFormTemperature(Number(config.default_params?.temperature) || 0.7);
    setFormMaxTokens(Number(config.default_params?.max_tokens) || 500);
    setAddStep('form');
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      name: formName.trim(),
      provider: formProvider,
      api_format: formApiFormat,
      base_url: formBaseUrl.trim(),
      model: formModel.trim() || undefined,
      default_params: {
        temperature: formTemperature,
        max_tokens: formMaxTokens,
      },
    };

    if (editingConfig) {
      updateMutation.mutate({
        id: editingConfig.id,
        body: {
          ...body,
          ...(formApiKey ? { api_key: formApiKey } : {}),
        },
      });
    } else {
      createMutation.mutate({ ...body, api_key: formApiKey });
    }
  };

  const handleTest = async (configId: number) => {
    setTestResults((prev) => ({ ...prev, [configId]: 'loading' }));
    try {
      const result = await testAIConfig(configId);
      setTestResults((prev) => ({ ...prev, [configId]: result }));
    } catch {
      setTestResults((prev) => ({
        ...prev,
        [configId]: { success: false, error: 'Network error', latency_ms: 0, tokens_used: 0 },
      }));
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="AI Settings" />
      <div className="flex-1 p-8 overflow-auto">
        {/* Tab navigation */}
        <div className="flex items-center gap-1 mb-8 bg-[#0A0A0A] border border-[#1A1A1A] rounded-lg p-1 w-fit">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === key
                  ? 'bg-[#00D9FF]/10 text-[#00D9FF]'
                  : 'text-[#8a8a8a] hover:text-[#FFFFFF] hover:bg-[#141414]/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ======== CONFIGS TAB ======== */}
        {activeTab === 'configs' && (
          <>
            <div className="flex items-center justify-between mb-8">
              <p className="text-[#8a8a8a] text-sm">
                Configure AI providers for FAQ engine &middot; {configs.length} provider{configs.length !== 1 ? 's' : ''}
              </p>
              <button
                onClick={() => { resetForm(); setEditingConfig(null); setSelectedAuthMethod('api_key'); setAddStep('select_method'); setShowForm(true); }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#00D9FF] text-black text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" /> Add Provider
              </button>
            </div>

            {/* Config cards */}
            {configsLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-6 h-6 text-[#6a6a6a] animate-spin" />
              </div>
            ) : configs.length === 0 ? (
              <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-12 text-center">
                <Zap className="w-8 h-8 text-[#6a6a6a] mx-auto mb-3" />
                <p className="text-sm text-[#6a6a6a]">No AI providers configured. Add one to enable AI features.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {configs.map((config) => {
                  const testResult = testResults[config.id];
                  return (
                    <div key={config.id} className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-sm font-semibold text-[#FFFFFF]">{config.name}</h3>
                            <ProviderBadge provider={config.provider} />
                            <AuthMethodBadge method={config.auth_method || 'api_key'} status={config.oauth_status} />
                            {!config.is_active && (
                              <span className="text-xs text-[#6a6a6a] bg-[#141414] px-2 py-0.5 rounded">Disabled</span>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-x-8 gap-y-1.5 text-xs">
                            <div>
                              <span className="text-[#6a6a6a]">Base URL:</span>{' '}
                              <span className="text-[#8a8a8a] font-mono">{config.base_url}</span>
                            </div>
                            <div>
                              <span className="text-[#6a6a6a]">Model:</span>{' '}
                              <span className="text-[#8a8a8a] font-mono">{config.model || 'default'}</span>
                            </div>
                            <div>
                              <span className="text-[#6a6a6a]">API Key:</span>{' '}
                              <span className="text-[#8a8a8a] font-mono">{config.api_key_masked}</span>
                            </div>
                            <div>
                              <span className="text-[#6a6a6a]">Temperature:</span>{' '}
                              <span className="text-[#00D9FF] font-mono">{config.default_params?.temperature ?? 0.7}</span>
                            </div>
                            <div>
                              <span className="text-[#6a6a6a]">Max Tokens:</span>{' '}
                              <span className="text-[#00D9FF] font-mono">{config.default_params?.max_tokens ?? 500}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleTest(config.id)}
                            disabled={testResult === 'loading'}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#141414] border border-[#2f2f2f] text-[#8a8a8a] hover:text-[#00D9FF] hover:border-[#00D9FF] transition-colors disabled:opacity-50"
                          >
                            {testResult === 'loading' ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Activity className="w-3 h-3" />
                            )}
                            Test
                          </button>
                          <button
                            onClick={() => startEdit(config)}
                            className="p-1.5 rounded hover:bg-[#141414] transition-colors text-[#8a8a8a] hover:text-[#FFFFFF]"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(config.id)}
                            className="p-1.5 rounded hover:bg-[#FF4444]/10 transition-colors text-[#8a8a8a] hover:text-[#FF4444]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Test result */}
                      {testResult && testResult !== 'loading' && (
                        <div className={`mt-3 p-3 rounded-lg border text-xs ${
                          testResult.success
                            ? 'bg-[#059669]/5 border-[#059669]/20'
                            : 'bg-[#FF4444]/5 border-[#FF4444]/20'
                        }`}>
                          <div className="flex items-center gap-2">
                            {testResult.success ? (
                              <CheckCircle className="w-4 h-4 text-[#059669] flex-shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-[#FF4444] flex-shrink-0" />
                            )}
                            <span className={testResult.success ? 'text-[#059669]' : 'text-[#FF4444]'}>
                              {testResult.success ? 'Connection successful' : 'Connection failed'}
                            </span>
                            {testResult.latency_ms > 0 && (
                              <span className="text-[#6a6a6a] ml-2 font-mono">
                                {testResult.latency_ms.toFixed(0)}ms
                              </span>
                            )}
                            {testResult.tokens_used > 0 && (
                              <span className="text-[#6a6a6a] font-mono">
                                {testResult.tokens_used} tokens
                              </span>
                            )}
                          </div>
                          {testResult.response_text && (
                            <p className="mt-1.5 text-[#8a8a8a] truncate">{testResult.response_text}</p>
                          )}
                          {testResult.error && (
                            <p className="mt-1.5 text-[#FF4444]">{testResult.error}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ======== USAGE TAB ======== */}
        {activeTab === 'usage' && (
          <>
            {usageLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-6 h-6 text-[#6a6a6a] animate-spin" />
              </div>
            ) : !usage ? (
              <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-12 text-center">
                <BarChart3 className="w-8 h-8 text-[#6a6a6a] mx-auto mb-3" />
                <p className="text-sm text-[#6a6a6a]">No usage data available.</p>
              </div>
            ) : (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-6 mb-8">
                  <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-6">
                    <p className="text-xs text-[#6a6a6a] mb-1">Total Requests (30d)</p>
                    <p className="text-2xl font-bold text-[#FFFFFF] font-mono">{usage.total_requests.toLocaleString()}</p>
                  </div>
                  <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-6">
                    <p className="text-xs text-[#6a6a6a] mb-1">Total Tokens</p>
                    <p className="text-2xl font-bold text-[#00D9FF] font-mono">{usage.total_tokens.toLocaleString()}</p>
                  </div>
                  <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-6">
                    <p className="text-xs text-[#6a6a6a] mb-1">Estimated Cost</p>
                    <p className="text-2xl font-bold text-[#FF8800] font-mono">${usage.total_cost.toFixed(4)}</p>
                  </div>
                </div>

                {/* Per-provider stats */}
                {usage.per_config_stats.length > 0 && (
                  <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl overflow-hidden mb-8">
                    <div className="px-6 py-4 border-b border-[#1A1A1A]">
                      <h3 className="text-sm font-semibold text-[#FFFFFF]">Usage by Provider</h3>
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#1A1A1A]">
                          <th className="text-left text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono'] px-6 py-4">Provider</th>
                          <th className="text-right text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono'] px-6 py-4">Requests</th>
                          <th className="text-right text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono'] px-6 py-4">Tokens</th>
                          <th className="text-right text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono'] px-6 py-4">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usage.per_config_stats.map((stat, i) => (
                          <tr key={i} className="border-b border-[#1A1A1A]/50">
                            <td className="px-6 py-4.5 text-sm text-[#FFFFFF]">{stat.config_name}</td>
                            <td className="px-6 py-4.5 text-sm text-[#8a8a8a] text-right font-mono">{stat.requests.toLocaleString()}</td>
                            <td className="px-6 py-4.5 text-sm text-[#00D9FF] text-right font-mono">{stat.tokens.toLocaleString()}</td>
                            <td className="px-6 py-4.5 text-sm text-[#FF8800] text-right font-mono">${stat.cost.toFixed(4)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Daily stats table */}
                {usage.daily_stats.length > 0 && (
                  <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-[#1A1A1A]">
                      <h3 className="text-sm font-semibold text-[#FFFFFF]">Daily Breakdown</h3>
                    </div>
                    <div className="max-h-[400px] overflow-auto">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-[#0A0A0A]">
                          <tr className="border-b border-[#1A1A1A]">
                            <th className="text-left text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono'] px-6 py-4">Date</th>
                            <th className="text-right text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono'] px-6 py-4">Requests</th>
                            <th className="text-right text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono'] px-6 py-4">Tokens</th>
                            <th className="text-right text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono'] px-6 py-4">Cost</th>
                            <th className="text-left text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono'] px-6 py-4 w-40">Volume</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...usage.daily_stats].reverse().map((day, i) => {
                            const maxReq = Math.max(...usage.daily_stats.map((d) => d.requests), 1);
                            const pct = (day.requests / maxReq) * 100;
                            return (
                              <tr key={i} className="border-b border-[#1A1A1A]/50">
                                <td className="px-6 py-4.5 text-sm text-[#FFFFFF] font-mono">{day.date}</td>
                                <td className="px-6 py-4.5 text-sm text-[#8a8a8a] text-right font-mono">{day.requests}</td>
                                <td className="px-6 py-4.5 text-sm text-[#00D9FF] text-right font-mono">{day.tokens.toLocaleString()}</td>
                                <td className="px-6 py-4.5 text-sm text-[#FF8800] text-right font-mono">${day.cost.toFixed(4)}</td>
                                <td className="px-6 py-4.5">
                                  <div className="w-full h-2 rounded-full bg-[#141414] overflow-hidden">
                                    <div className="h-full rounded-full bg-accent/60" style={{ width: `${pct}%` }} />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ======== RAG TAB ======== */}
        {activeTab === 'rag' && (
          <>
            {ragLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-6 h-6 text-[#6a6a6a] animate-spin" />
              </div>
            ) : (
              <div className="max-w-2xl">
                {/* Source badge */}
                <div className="flex items-center gap-3 mb-6">
                  <p className="text-[#8a8a8a] text-sm">RAG Knowledge Base configuration</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${
                    ragData?.source === 'database'
                      ? 'text-[#059669] bg-[#059669]/10'
                      : ragData?.source === 'env'
                        ? 'text-[#FF8800] bg-[#FF8800]/10'
                        : 'text-[#6a6a6a] bg-[#141414]'
                  }`}>
                    {ragData?.source === 'database' ? 'Database' : ragData?.source === 'env' ? 'Environment' : 'Not configured'}
                  </span>
                </div>

                <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-6">
                  {/* Provider select */}
                  <div className="mb-5">
                    <label className="block text-xs text-[#8a8a8a] mb-2">Provider</label>
                    <select
                      value={ragProvider}
                      onChange={(e) => { setRagProvider(e.target.value); setRagTestResult(null); }}
                      className="w-full h-11 px-4 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-[#FFFFFF] focus:outline-none focus:border-[#00D9FF] transition-colors"
                    >
                      <option value="disabled">Disabled</option>
                      <option value="dify">Dify</option>
                    </select>
                  </div>

                  {/* Dify config fields */}
                  {ragProvider === 'dify' && (
                    <div className="flex flex-col gap-4">
                      <div>
                        <label className="block text-xs text-[#8a8a8a] mb-2">Base URL *</label>
                        <input
                          type="url"
                          value={ragBaseUrl}
                          onChange={(e) => setRagBaseUrl(e.target.value)}
                          placeholder="http://your-dify-host/v1"
                          className="w-full h-11 px-4 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-[#FFFFFF] placeholder:text-[#4a4a4a] font-mono focus:outline-none focus:border-[#00D9FF] transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#8a8a8a] mb-2">
                          API Key {ragData?.source === 'database' ? '(leave blank to keep current)' : '*'}
                        </label>
                        <input
                          type="password"
                          value={ragApiKey}
                          onChange={(e) => setRagApiKey(e.target.value)}
                          placeholder={ragData?.dify_api_key_masked || 'dataset-...'}
                          className="w-full h-11 px-4 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-[#FFFFFF] placeholder:text-[#4a4a4a] font-mono focus:outline-none focus:border-[#00D9FF] transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#8a8a8a] mb-2">Dataset ID *</label>
                        <input
                          type="text"
                          value={ragDatasetId}
                          onChange={(e) => setRagDatasetId(e.target.value)}
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          className="w-full h-11 px-4 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-[#FFFFFF] placeholder:text-[#4a4a4a] font-mono focus:outline-none focus:border-[#00D9FF] transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#8a8a8a] mb-2">
                          Top K: <span className="text-[#00D9FF] font-mono">{ragTopK}</span>
                        </label>
                        <input
                          type="range"
                          min={1}
                          max={20}
                          step={1}
                          value={ragTopK}
                          onChange={(e) => setRagTopK(Number(e.target.value))}
                          className="w-full accent-accent"
                        />
                        <div className="flex justify-between text-[10px] text-[#6a6a6a] mt-0.5">
                          <span>1 (precise)</span>
                          <span>20 (broad)</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-3 mt-6 pt-5 border-t border-[#1A1A1A]">
                    {ragProvider === 'dify' && (
                      <>
                        <button
                          onClick={async () => {
                            setRagSaving(true);
                            try {
                              const payload: Parameters<typeof saveRAGConfig>[0] = {
                                provider: 'dify',
                                dify_base_url: ragBaseUrl.trim(),
                                dify_api_key: ragApiKey || '',
                                dify_dataset_id: ragDatasetId.trim(),
                                top_k: ragTopK,
                              };
                              await saveRAGConfig(payload);
                              queryClient.invalidateQueries({ queryKey: ['rag-config'] });
                              setRagTestResult(null);
                            } catch (err) {
                              setRagTestResult({ success: false, result_count: 0, error: (err as Error).message });
                            } finally {
                              setRagSaving(false);
                            }
                          }}
                          disabled={ragSaving || !ragBaseUrl.trim() || !ragDatasetId.trim() || (ragData?.source !== 'database' && !ragApiKey)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-[#00D9FF] text-black text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                          {ragSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                          Save
                        </button>
                        <button
                          onClick={async () => {
                            setRagTesting(true);
                            setRagTestResult(null);
                            try {
                              const result = await testRAGConfig();
                              setRagTestResult(result);
                            } catch {
                              setRagTestResult({ success: false, result_count: 0, error: 'Network error' });
                            } finally {
                              setRagTesting(false);
                            }
                          }}
                          disabled={ragTesting}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-[#141414] border border-[#2f2f2f] text-[#8a8a8a] hover:text-[#00D9FF] hover:border-[#00D9FF] transition-colors disabled:opacity-50"
                        >
                          {ragTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                          Test
                        </button>
                      </>
                    )}
                    {ragData?.source === 'database' && (
                      <button
                        onClick={() => setRagDeleteConfirm(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg text-[#FF4444] hover:bg-[#FF4444]/10 transition-colors ml-auto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete DB Config
                      </button>
                    )}
                  </div>

                  {/* Test result */}
                  {ragTestResult && (
                    <div className={`mt-4 p-3 rounded-lg border text-xs ${
                      ragTestResult.success
                        ? 'bg-[#059669]/5 border-[#059669]/20'
                        : 'bg-[#FF4444]/5 border-[#FF4444]/20'
                    }`}>
                      <div className="flex items-center gap-2">
                        {ragTestResult.success ? (
                          <CheckCircle className="w-4 h-4 text-[#059669] flex-shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-[#FF4444] flex-shrink-0" />
                        )}
                        <span className={ragTestResult.success ? 'text-[#059669]' : 'text-[#FF4444]'}>
                          {ragTestResult.success
                            ? `Connection successful — ${ragTestResult.result_count} result${ragTestResult.result_count !== 1 ? 's' : ''} returned`
                            : 'Connection failed'}
                        </span>
                      </div>
                      {ragTestResult.error && (
                        <p className="mt-1.5 text-[#FF4444]">{ragTestResult.error}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Info box */}
                {ragProvider === 'dify' && (
                  <div className="mt-4 px-4 py-3 bg-[#141414] border border-[#2f2f2f] rounded-lg">
                    <p className="text-[11px] text-[#6a6a6a]">
                      RAG uses Dify Knowledge API to retrieve relevant documents, then feeds them to AI for synthesized answers.
                      Configure an AI Provider in the "AI Providers" tab as well for the AI synthesis step.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Delete confirmation */}
            {ragDeleteConfirm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="bg-[#0C0C0C] border border-[#2f2f2f] rounded-xl p-6 w-full max-w-sm shadow-2xl">
                  <h3 className="text-sm font-semibold text-[#FFFFFF] mb-3">Delete RAG Configuration</h3>
                  <p className="text-sm text-[#8a8a8a] mb-5">
                    This will remove the database configuration. If .env has RAG settings, they will be used as fallback.
                  </p>
                  <div className="flex justify-end gap-3">
                    <button onClick={() => setRagDeleteConfirm(false)} className="px-4 py-2 text-sm text-[#8a8a8a] hover:text-[#FFFFFF]">
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await deleteRAGConfig();
                          queryClient.invalidateQueries({ queryKey: ['rag-config'] });
                          setRagDeleteConfirm(false);
                          setRagProvider('disabled');
                          setRagTestResult(null);
                        } catch (err) {
                          setRagDeleteConfirm(false);
                          setRagTestResult({ success: false, result_count: 0, error: `Delete failed: ${(err as Error).message}` });
                        }
                      }}
                      className="px-4 py-2 bg-[#FF4444] text-white text-sm font-medium rounded-lg hover:opacity-90"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ======== CREATE / EDIT FORM MODAL ======== */}
        {showForm && (
          <>
            {/* Step 1: Auth method selection (only for new configs) */}
            {!editingConfig && addStep === 'select_method' && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="bg-[#0C0C0C] border border-[#2f2f2f] rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-auto">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-sm font-semibold text-[#FFFFFF]">Add AI Provider</h3>
                    <button onClick={() => { setShowForm(false); resetForm(); }} className="text-[#6a6a6a] hover:text-[#FFFFFF]">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <AuthMethodSelector selected={selectedAuthMethod} onSelect={setSelectedAuthMethod} />
                  <div className="flex justify-end gap-3 mt-5">
                    <button onClick={() => { setShowForm(false); resetForm(); }} className="px-4 py-2 text-sm text-[#8a8a8a] hover:text-[#FFFFFF]">
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (selectedAuthMethod === 'api_key') {
                          setAddStep('form');
                        } else {
                          setAddStep('oauth');
                        }
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#00D9FF] text-black text-sm font-medium rounded-lg hover:opacity-90"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2a: OAuth flow modal (non-API-Key methods) */}
            {!editingConfig && addStep === 'oauth' && (
              <OAuthFlowModal
                authMethod={selectedAuthMethod}
                onClose={() => { setShowForm(false); resetForm(); }}
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ['ai-configs'] });
                  setShowForm(false);
                  resetForm();
                }}
              />
            )}

            {/* Step 2b: API Key form (existing form, also used for editing) */}
            {(addStep === 'form' || editingConfig) && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="bg-[#0C0C0C] border border-[#2f2f2f] rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-auto">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-sm font-semibold text-[#FFFFFF]">
                      {editingConfig ? `Edit Provider: ${editingConfig.name}` : 'Add AI Provider (API Key)'}
                    </h3>
                    <button onClick={() => { setShowForm(false); setEditingConfig(null); resetForm(); }} className="text-[#6a6a6a] hover:text-[#FFFFFF]">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                      <label className="block text-xs text-[#8a8a8a] mb-2">Name *</label>
                      <input
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="My OpenAI Config"
                        className="w-full h-11 px-4 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-[#FFFFFF] placeholder:text-[#4a4a4a] focus:outline-none focus:border-[#00D9FF] transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#8a8a8a] mb-2">Provider</label>
                      <select
                        value={formProvider}
                        onChange={(e) => setFormProvider(e.target.value)}
                        className="w-full h-11 px-4 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-[#FFFFFF] focus:outline-none focus:border-[#00D9FF] transition-colors"
                      >
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                        <option value="custom">Custom (OpenAI-compatible)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[#8a8a8a] mb-2">API Format</label>
                      <select
                        value={formApiFormat}
                        onChange={(e) => setFormApiFormat(e.target.value)}
                        className="w-full h-11 px-4 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-[#FFFFFF] focus:outline-none focus:border-[#00D9FF] transition-colors"
                      >
                        <option value="openai_chat">OpenAI Chat Completions</option>
                        <option value="anthropic_responses">Anthropic Responses (CRS)</option>
                      </select>
                      <p className="text-[10px] text-[#6a6a6a] mt-1">
                        {formApiFormat === 'openai_chat'
                          ? 'Standard /v1/chat/completions endpoint'
                          : 'CRS /v1/responses endpoint (Claude Relay Service)'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs text-[#8a8a8a] mb-2">Base URL *</label>
                      <input
                        type="url"
                        value={formBaseUrl}
                        onChange={(e) => setFormBaseUrl(e.target.value)}
                        placeholder={formApiFormat === 'openai_chat' ? 'https://api.openai.com/v1' : 'https://crs.bcx.im/openai'}
                        className="w-full h-11 px-4 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-[#FFFFFF] placeholder:text-[#4a4a4a] font-mono focus:outline-none focus:border-[#00D9FF] transition-colors"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#8a8a8a] mb-2">
                        API Key {editingConfig ? '(leave blank to keep current)' : '*'}
                      </label>
                      <input
                        type="password"
                        value={formApiKey}
                        onChange={(e) => setFormApiKey(e.target.value)}
                        placeholder={editingConfig ? editingConfig.api_key_masked : 'sk-...'}
                        className="w-full h-11 px-4 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-[#FFFFFF] placeholder:text-[#4a4a4a] font-mono focus:outline-none focus:border-[#00D9FF] transition-colors"
                        required={!editingConfig}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#8a8a8a] mb-2">Model</label>
                      <input
                        type="text"
                        value={formModel}
                        onChange={(e) => setFormModel(e.target.value)}
                        placeholder="gpt-3.5-turbo"
                        className="w-full h-11 px-4 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-[#FFFFFF] placeholder:text-[#4a4a4a] font-mono focus:outline-none focus:border-[#00D9FF] transition-colors"
                      />
                    </div>

                    {/* Sliders */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-[#8a8a8a] mb-2">
                          Temperature: <span className="text-[#00D9FF] font-mono">{formTemperature.toFixed(2)}</span>
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={2}
                          step={0.05}
                          value={formTemperature}
                          onChange={(e) => setFormTemperature(Number(e.target.value))}
                          className="w-full accent-accent"
                        />
                        <div className="flex justify-between text-[10px] text-[#6a6a6a] mt-0.5">
                          <span>Precise</span>
                          <span>Creative</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-[#8a8a8a] mb-2">
                          Max Tokens: <span className="text-[#00D9FF] font-mono">{formMaxTokens}</span>
                        </label>
                        <input
                          type="range"
                          min={50}
                          max={4000}
                          step={50}
                          value={formMaxTokens}
                          onChange={(e) => setFormMaxTokens(Number(e.target.value))}
                          className="w-full accent-accent"
                        />
                        <div className="flex justify-between text-[10px] text-[#6a6a6a] mt-0.5">
                          <span>50</span>
                          <span>4000</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-2">
                      <button
                        type="button"
                        onClick={() => { setShowForm(false); setEditingConfig(null); resetForm(); }}
                        className="px-4 py-2 text-sm text-[#8a8a8a] hover:text-[#FFFFFF]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={createMutation.isPending || updateMutation.isPending}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#00D9FF] text-black text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
                      >
                        <Zap className="w-4 h-4" />
                        {createMutation.isPending || updateMutation.isPending
                          ? 'Saving...'
                          : editingConfig
                            ? 'Update Provider'
                            : 'Create Provider'}
                      </button>
                    </div>
                    {(createMutation.isError || updateMutation.isError) && (
                      <p className="text-xs text-[#FF4444]">
                        Failed: {((createMutation.error || updateMutation.error) as Error)?.message || 'Unknown error'}
                      </p>
                    )}
                  </form>
                </div>
              </div>
            )}
          </>
        )}

        {/* Delete confirmation */}
        {deleteConfirm !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-[#0C0C0C] border border-[#2f2f2f] rounded-xl p-6 w-full max-w-sm shadow-2xl">
              <h3 className="text-sm font-semibold text-[#FFFFFF] mb-3">Delete AI Provider</h3>
              <p className="text-sm text-[#8a8a8a] mb-5">
                Are you sure? This will remove the AI configuration permanently.
              </p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-[#8a8a8a] hover:text-[#FFFFFF]">
                  Cancel
                </button>
                <button
                  onClick={() => deleteMutation.mutate(deleteConfirm)}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 bg-[#FF4444] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
