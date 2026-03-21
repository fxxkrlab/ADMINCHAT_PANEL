import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Zap, X, CheckCircle, XCircle, Loader2, BarChart3, Activity } from 'lucide-react';
import Header from '../components/layout/Header';
import { getAIConfigs, createAIConfig, updateAIConfig, deleteAIConfig, testAIConfig, getAIUsage } from '../services/aiConfigApi';
import type { AIConfig, AIConfigCreate, AIConfigUpdate, AITestResult, AIUsageStats } from '../types';

// ---- Provider badge ----
function ProviderBadge({ provider }: { provider: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    openai: { color: 'text-green', bg: 'bg-green/10' },
    anthropic: { color: 'text-orange', bg: 'bg-orange/10' },
    custom: { color: 'text-purple', bg: 'bg-purple/10' },
  };
  const s = map[provider] || map.custom;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${s.color} ${s.bg}`}>
      {provider}
    </span>
  );
}

// ---- Tab definitions ----
const TABS = [
  { key: 'configs', label: 'AI Providers', icon: Zap },
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
        <div className="flex items-center gap-1 mb-8 bg-bg-card border border-border-subtle rounded-lg p-1 w-fit">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === key
                  ? 'bg-accent/10 text-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated/50'
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
              <p className="text-text-secondary text-sm">
                Configure AI providers for FAQ engine &middot; {configs.length} provider{configs.length !== 1 ? 's' : ''}
              </p>
              <button
                onClick={() => { resetForm(); setEditingConfig(null); setShowForm(true); }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-black text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" /> Add Provider
              </button>
            </div>

            {/* Config cards */}
            {configsLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
              </div>
            ) : configs.length === 0 ? (
              <div className="bg-bg-card border border-border-subtle rounded-xl p-12 text-center">
                <Zap className="w-8 h-8 text-text-muted mx-auto mb-3" />
                <p className="text-sm text-text-muted">No AI providers configured. Add one to enable AI features.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {configs.map((config) => {
                  const testResult = testResults[config.id];
                  return (
                    <div key={config.id} className="bg-bg-card border border-border-subtle rounded-xl p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-sm font-semibold text-text-primary">{config.name}</h3>
                            <ProviderBadge provider={config.provider} />
                            {!config.is_active && (
                              <span className="text-xs text-text-muted bg-bg-elevated px-2 py-0.5 rounded">Disabled</span>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-x-8 gap-y-1.5 text-xs">
                            <div>
                              <span className="text-text-muted">Base URL:</span>{' '}
                              <span className="text-text-secondary font-mono">{config.base_url}</span>
                            </div>
                            <div>
                              <span className="text-text-muted">Model:</span>{' '}
                              <span className="text-text-secondary font-mono">{config.model || 'default'}</span>
                            </div>
                            <div>
                              <span className="text-text-muted">API Key:</span>{' '}
                              <span className="text-text-secondary font-mono">{config.api_key_masked}</span>
                            </div>
                            <div>
                              <span className="text-text-muted">Temperature:</span>{' '}
                              <span className="text-accent font-mono">{config.default_params?.temperature ?? 0.7}</span>
                            </div>
                            <div>
                              <span className="text-text-muted">Max Tokens:</span>{' '}
                              <span className="text-accent font-mono">{config.default_params?.max_tokens ?? 500}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleTest(config.id)}
                            disabled={testResult === 'loading'}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-bg-elevated border border-border text-text-secondary hover:text-accent hover:border-accent transition-colors disabled:opacity-50"
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
                            className="p-1.5 rounded hover:bg-bg-elevated transition-colors text-text-secondary hover:text-text-primary"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(config.id)}
                            className="p-1.5 rounded hover:bg-red/10 transition-colors text-text-secondary hover:text-red"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Test result */}
                      {testResult && testResult !== 'loading' && (
                        <div className={`mt-3 p-3 rounded-lg border text-xs ${
                          testResult.success
                            ? 'bg-green/5 border-green/20'
                            : 'bg-red/5 border-red/20'
                        }`}>
                          <div className="flex items-center gap-2">
                            {testResult.success ? (
                              <CheckCircle className="w-4 h-4 text-green flex-shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red flex-shrink-0" />
                            )}
                            <span className={testResult.success ? 'text-green' : 'text-red'}>
                              {testResult.success ? 'Connection successful' : 'Connection failed'}
                            </span>
                            {testResult.latency_ms > 0 && (
                              <span className="text-text-muted ml-2 font-mono">
                                {testResult.latency_ms.toFixed(0)}ms
                              </span>
                            )}
                            {testResult.tokens_used > 0 && (
                              <span className="text-text-muted font-mono">
                                {testResult.tokens_used} tokens
                              </span>
                            )}
                          </div>
                          {testResult.response_text && (
                            <p className="mt-1.5 text-text-secondary truncate">{testResult.response_text}</p>
                          )}
                          {testResult.error && (
                            <p className="mt-1.5 text-red">{testResult.error}</p>
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
                <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
              </div>
            ) : !usage ? (
              <div className="bg-bg-card border border-border-subtle rounded-xl p-12 text-center">
                <BarChart3 className="w-8 h-8 text-text-muted mx-auto mb-3" />
                <p className="text-sm text-text-muted">No usage data available.</p>
              </div>
            ) : (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-6 mb-8">
                  <div className="bg-bg-card border border-border-subtle rounded-xl p-6">
                    <p className="text-xs text-text-muted mb-1">Total Requests (30d)</p>
                    <p className="text-2xl font-bold text-text-primary font-mono">{usage.total_requests.toLocaleString()}</p>
                  </div>
                  <div className="bg-bg-card border border-border-subtle rounded-xl p-6">
                    <p className="text-xs text-text-muted mb-1">Total Tokens</p>
                    <p className="text-2xl font-bold text-accent font-mono">{usage.total_tokens.toLocaleString()}</p>
                  </div>
                  <div className="bg-bg-card border border-border-subtle rounded-xl p-6">
                    <p className="text-xs text-text-muted mb-1">Estimated Cost</p>
                    <p className="text-2xl font-bold text-orange font-mono">${usage.total_cost.toFixed(4)}</p>
                  </div>
                </div>

                {/* Per-provider stats */}
                {usage.per_config_stats.length > 0 && (
                  <div className="bg-bg-card border border-border-subtle rounded-xl overflow-hidden mb-8">
                    <div className="px-6 py-4 border-b border-border-subtle">
                      <h3 className="text-sm font-semibold text-text-primary">Usage by Provider</h3>
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border-subtle">
                          <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono'] px-6 py-4">Provider</th>
                          <th className="text-right text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono'] px-6 py-4">Requests</th>
                          <th className="text-right text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono'] px-6 py-4">Tokens</th>
                          <th className="text-right text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono'] px-6 py-4">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usage.per_config_stats.map((stat, i) => (
                          <tr key={i} className="border-b border-border-subtle/50">
                            <td className="px-6 py-4.5 text-sm text-text-primary">{stat.config_name}</td>
                            <td className="px-6 py-4.5 text-sm text-text-secondary text-right font-mono">{stat.requests.toLocaleString()}</td>
                            <td className="px-6 py-4.5 text-sm text-accent text-right font-mono">{stat.tokens.toLocaleString()}</td>
                            <td className="px-6 py-4.5 text-sm text-orange text-right font-mono">${stat.cost.toFixed(4)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Daily stats table */}
                {usage.daily_stats.length > 0 && (
                  <div className="bg-bg-card border border-border-subtle rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-border-subtle">
                      <h3 className="text-sm font-semibold text-text-primary">Daily Breakdown</h3>
                    </div>
                    <div className="max-h-[400px] overflow-auto">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-bg-card">
                          <tr className="border-b border-border-subtle">
                            <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono'] px-6 py-4">Date</th>
                            <th className="text-right text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono'] px-6 py-4">Requests</th>
                            <th className="text-right text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono'] px-6 py-4">Tokens</th>
                            <th className="text-right text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono'] px-6 py-4">Cost</th>
                            <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono'] px-6 py-4 w-40">Volume</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...usage.daily_stats].reverse().map((day, i) => {
                            const maxReq = Math.max(...usage.daily_stats.map((d) => d.requests), 1);
                            const pct = (day.requests / maxReq) * 100;
                            return (
                              <tr key={i} className="border-b border-border-subtle/50">
                                <td className="px-6 py-4.5 text-sm text-text-primary font-mono">{day.date}</td>
                                <td className="px-6 py-4.5 text-sm text-text-secondary text-right font-mono">{day.requests}</td>
                                <td className="px-6 py-4.5 text-sm text-accent text-right font-mono">{day.tokens.toLocaleString()}</td>
                                <td className="px-6 py-4.5 text-sm text-orange text-right font-mono">${day.cost.toFixed(4)}</td>
                                <td className="px-6 py-4.5">
                                  <div className="w-full h-2 rounded-full bg-bg-elevated overflow-hidden">
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

        {/* ======== CREATE / EDIT FORM MODAL ======== */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-bg-page border border-border rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-auto">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-semibold text-text-primary">
                  {editingConfig ? `Edit Provider: ${editingConfig.name}` : 'Add AI Provider'}
                </h3>
                <button onClick={() => { setShowForm(false); setEditingConfig(null); resetForm(); }} className="text-text-muted hover:text-text-primary">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs text-text-secondary mb-2">Name *</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="My OpenAI Config"
                    className="w-full h-11 px-4 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary placeholder:text-text-placeholder focus:outline-none focus:border-accent transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-2">Provider</label>
                  <select
                    value={formProvider}
                    onChange={(e) => setFormProvider(e.target.value)}
                    className="w-full h-11 px-4 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="custom">Custom (OpenAI-compatible)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-2">API Format</label>
                  <select
                    value={formApiFormat}
                    onChange={(e) => setFormApiFormat(e.target.value)}
                    className="w-full h-11 px-4 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
                  >
                    <option value="openai_chat">OpenAI Chat Completions</option>
                    <option value="anthropic_responses">Anthropic Responses (CRS)</option>
                  </select>
                  <p className="text-[10px] text-text-muted mt-1">
                    {formApiFormat === 'openai_chat'
                      ? 'Standard /v1/chat/completions endpoint'
                      : 'CRS /v1/responses endpoint (Claude Relay Service)'}
                  </p>
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-2">Base URL *</label>
                  <input
                    type="url"
                    value={formBaseUrl}
                    onChange={(e) => setFormBaseUrl(e.target.value)}
                    placeholder={formApiFormat === 'openai_chat' ? 'https://api.openai.com/v1' : 'https://crs.bcx.im/openai'}
                    className="w-full h-11 px-4 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary placeholder:text-text-placeholder font-mono focus:outline-none focus:border-accent transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-2">
                    API Key {editingConfig ? '(leave blank to keep current)' : '*'}
                  </label>
                  <input
                    type="password"
                    value={formApiKey}
                    onChange={(e) => setFormApiKey(e.target.value)}
                    placeholder={editingConfig ? editingConfig.api_key_masked : 'sk-...'}
                    className="w-full h-11 px-4 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary placeholder:text-text-placeholder font-mono focus:outline-none focus:border-accent transition-colors"
                    required={!editingConfig}
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-2">Model</label>
                  <input
                    type="text"
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    placeholder="gpt-3.5-turbo"
                    className="w-full h-11 px-4 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary placeholder:text-text-placeholder font-mono focus:outline-none focus:border-accent transition-colors"
                  />
                </div>

                {/* Sliders */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-text-secondary mb-2">
                      Temperature: <span className="text-accent font-mono">{formTemperature.toFixed(2)}</span>
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
                    <div className="flex justify-between text-[10px] text-text-muted mt-0.5">
                      <span>Precise</span>
                      <span>Creative</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-2">
                      Max Tokens: <span className="text-accent font-mono">{formMaxTokens}</span>
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
                    <div className="flex justify-between text-[10px] text-text-muted mt-0.5">
                      <span>50</span>
                      <span>4000</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setEditingConfig(null); resetForm(); }}
                    className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-black text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
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
                  <p className="text-xs text-red">
                    Failed: {((createMutation.error || updateMutation.error) as Error)?.message || 'Unknown error'}
                  </p>
                )}
              </form>
            </div>
          </div>
        )}

        {/* Delete confirmation */}
        {deleteConfirm !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-bg-page border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Delete AI Provider</h3>
              <p className="text-sm text-text-secondary mb-5">
                Are you sure? This will remove the AI configuration permanently.
              </p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary">
                  Cancel
                </button>
                <button
                  onClick={() => deleteMutation.mutate(deleteConfirm)}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 bg-red text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
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
