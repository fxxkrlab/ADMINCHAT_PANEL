import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Clock, Shield, Database, Settings as SettingsIcon, Loader2, RefreshCw, ExternalLink, LogIn, Key, Unplug, Info, CheckCircle2 } from 'lucide-react';
import Header from '../components/layout/Header';
import { getSettings, updateSettings, getVersionInfo } from '../services/settingsApi';
import { getMarketStatus, marketConnect, marketDisconnect } from '../services/marketApi';
import type { MarketStatus } from '../services/marketApi';
import { useActivePlugins } from '../plugins/useInstalledPlugins';
import { PluginLoader } from '../plugins/PluginLoader';
import type { SettingItem } from '../types';

// ---- Tab definitions ----
const TABS: { key: string; label: string }[] = [
  { key: 'admins', label: 'Admins' },
  { key: 'system', label: 'System' },
  { key: 'ai', label: 'AI Config' },
  { key: 'market', label: 'Market' },
  { key: 'permissions', label: 'Permissions' },
];

// ---- Helpers ----
function getSettingValue(items: SettingItem[], key: string, fallback: unknown = ''): unknown {
  const item = items.find((s) => s.key === key);
  if (!item) return fallback;
  const val = item.value;
  if (typeof val === 'object' && val !== null && 'value' in (val as Record<string, unknown>)) {
    return (val as Record<string, unknown>).value;
  }
  return val;
}

// ---- Setting card component ----
function SettingCard({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-8 px-5 py-4 border-b border-[#1A1A1A] last:border-0">
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-white">{label}</h4>
        {description && <p className="text-xs text-[#6a6a6a] mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

// ---- Toggle component ----
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        value ? 'bg-[#00D9FF]' : 'bg-[#141414] border border-[#2f2f2f]'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
          value ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ---- Market Tab ----
function MarketTab({
  localSettings,
  setLocalSettings,
  saveMutation,
}: {
  localSettings: Record<string, unknown>;
  setLocalSettings: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  saveMutation: ReturnType<typeof useMutation<unknown, Error, Record<string, unknown>>>;
}) {
  const queryClient = useQueryClient();
  const [connectMethod, setConnectMethod] = useState<'login' | 'api_key'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [connectError, setConnectError] = useState('');

  const { data: status, isLoading: statusLoading } = useQuery<MarketStatus>({
    queryKey: ['market-status'],
    queryFn: getMarketStatus,
    staleTime: 60_000,
  });

  const connectMut = useMutation({
    mutationFn: () => {
      if (connectMethod === 'login') {
        return marketConnect('login', { email, password });
      }
      return marketConnect('api_key', { api_key: apiKey });
    },
    onSuccess: () => {
      setConnectError('');
      setEmail('');
      setPassword('');
      setApiKey('');
      queryClient.invalidateQueries({ queryKey: ['market-status'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || (err as Error)?.message || 'Connection failed';
      setConnectError(msg);
    },
  });

  const disconnectMut = useMutation({
    mutationFn: marketDisconnect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market-status'] });
    },
  });

  const isConnected = status?.connected ?? false;
  const account = status?.account;

  return (
    <div className="space-y-6">
      {/* Market URL */}
      <div className="bg-[#0A0A0A] border border-[#2f2f2f] rounded-[10px] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2f2f2f]">
          <h3 className="text-[18px] font-semibold text-white font-['Space_Grotesk']">ACP Market</h3>
          <p className="text-xs text-[#6a6a6a] mt-1">Configure connection to the ACP Plugin Market</p>
        </div>
        <div className="p-5">
          <SettingCard label="Market URL" description="ACP Market API base URL. Change this if you run a self-hosted Market instance.">
            <input
              type="url"
              value={String(localSettings['acp_market_url'] ?? 'https://acpmarket.novahelix.org/api/v1')}
              onChange={(e) => setLocalSettings((s) => ({ ...s, acp_market_url: e.target.value }))}
              placeholder="https://acpmarket.novahelix.org/api/v1"
              className="w-full md:w-96 h-10 px-3 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-white font-mono placeholder:text-[#4a4a4a] focus:outline-none focus:border-[#00D9FF] transition-colors"
            />
          </SettingCard>
          <div className="flex justify-end pt-3">
            <button
              onClick={() => saveMutation.mutate({
                acp_market_url: localSettings['acp_market_url'] ?? 'https://acpmarket.novahelix.org/api/v1',
              })}
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#00D9FF] text-black text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save URL
            </button>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      <div className="bg-[#0A0A0A] border border-[#2f2f2f] rounded-[10px] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2f2f2f]">
          <h3 className="text-sm font-semibold text-white font-['Space_Grotesk']">Connection Status</h3>
        </div>
        <div className="p-5">
          {statusLoading ? (
            <div className="flex items-center gap-2 text-[#6a6a6a] text-sm">
              <Loader2 size={14} className="animate-spin" />
              Checking connection...
            </div>
          ) : isConnected ? (
            <div className="space-y-4">
              {/* Connected badge */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#059669]" />
                  <span className="text-sm font-medium text-white">Connected</span>
                </div>
                <span className="text-[10px] font-semibold font-['JetBrains_Mono'] px-2 py-0.5 rounded bg-[#00D9FF]/10 text-[#00D9FF]">
                  {status?.auth_type === 'env' ? 'ENV VAR' : status?.auth_type === 'api_key' ? 'API KEY' : 'LOGIN'}
                </span>
              </div>

              {/* Env var notice */}
              {status?.source === 'environment_variable' && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-[#FF8800]/5 border border-[#FF8800]/20 rounded-lg">
                  <Info size={14} className="text-[#FF8800] mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-[#FF8800]">
                    Connected via <span className="font-['JetBrains_Mono']">ACP_MARKET_API_KEY</span> environment variable. Cannot disconnect from UI.
                  </p>
                </div>
              )}

              {/* Account info */}
              {account && (
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 mt-2">
                  {account.username && (
                    <div>
                      <p className="text-[11px] text-[#6a6a6a] mb-0.5">Username</p>
                      <p className="text-sm text-white font-['JetBrains_Mono']">{account.username}</p>
                    </div>
                  )}
                  {account.role && (
                    <div>
                      <p className="text-[11px] text-[#6a6a6a] mb-0.5">Role</p>
                      <span className="text-[10px] font-semibold font-['JetBrains_Mono'] px-2 py-0.5 rounded bg-[#8B5CF6]/10 text-[#8B5CF6]">
                        {account.role.toUpperCase()}
                      </span>
                    </div>
                  )}
                  {account.email && (
                    <div>
                      <p className="text-[11px] text-[#6a6a6a] mb-0.5">Email</p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm text-white font-['JetBrains_Mono']">{account.email}</p>
                        {account.is_verified && <CheckCircle2 size={12} className="text-[#059669]" />}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-[11px] text-[#6a6a6a] mb-0.5">Status</p>
                    <span className={`text-[10px] font-semibold font-['JetBrains_Mono'] px-2 py-0.5 rounded ${
                      account.is_active !== false
                        ? 'bg-[#059669]/10 text-[#059669]'
                        : 'bg-[#FF4444]/10 text-[#FF4444]'
                    }`}>
                      {account.is_active !== false ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                </div>
              )}

              {!account && (
                <p className="text-xs text-[#6a6a6a]">Connected but unable to fetch account details.</p>
              )}

              {/* Disconnect button */}
              {status?.source !== 'environment_variable' && (
                <div className="pt-2">
                  <button
                    onClick={() => disconnectMut.mutate()}
                    disabled={disconnectMut.isPending}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-[#FF4444]/30 text-[#FF4444] text-sm font-medium rounded-lg hover:bg-[#FF4444]/5 disabled:opacity-50 transition-colors"
                  >
                    {disconnectMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Unplug size={14} />}
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Not connected — show login/API key form */
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#6a6a6a]" />
                <span className="text-sm text-[#8a8a8a]">Not connected</span>
              </div>

              {/* Method selector */}
              <div className="flex gap-3">
                <button
                  onClick={() => { setConnectMethod('login'); setConnectError(''); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    connectMethod === 'login'
                      ? 'bg-[#00D9FF]/10 text-[#00D9FF] border border-[#00D9FF]/30'
                      : 'bg-[#141414] text-[#8a8a8a] border border-[#2f2f2f] hover:text-white'
                  }`}
                >
                  <LogIn size={14} />
                  Login with Market account
                </button>
                <button
                  onClick={() => { setConnectMethod('api_key'); setConnectError(''); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    connectMethod === 'api_key'
                      ? 'bg-[#00D9FF]/10 text-[#00D9FF] border border-[#00D9FF]/30'
                      : 'bg-[#141414] text-[#8a8a8a] border border-[#2f2f2f] hover:text-white'
                  }`}
                >
                  <Key size={14} />
                  Paste API Key
                </button>
              </div>

              {/* Login form */}
              {connectMethod === 'login' && (
                <div className="space-y-3 max-w-md">
                  <div>
                    <label className="block text-[11px] text-[#6a6a6a] mb-1.5">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full h-10 px-3 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-white placeholder:text-[#4a4a4a] focus:outline-none focus:border-[#00D9FF] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#6a6a6a] mb-1.5">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full h-10 px-3 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-white placeholder:text-[#4a4a4a] focus:outline-none focus:border-[#00D9FF] transition-colors"
                    />
                  </div>
                  <button
                    onClick={() => connectMut.mutate()}
                    disabled={connectMut.isPending || !email || !password}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#00D9FF] text-black text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    {connectMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
                    Login
                  </button>
                </div>
              )}

              {/* API key form */}
              {connectMethod === 'api_key' && (
                <div className="space-y-3 max-w-md">
                  <div>
                    <label className="block text-[11px] text-[#6a6a6a] mb-1.5">API Key (JWT token)</label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Paste your Market API key or JWT token"
                      className="w-full h-10 px-3 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-white placeholder:text-[#4a4a4a] font-['JetBrains_Mono'] focus:outline-none focus:border-[#00D9FF] transition-colors"
                    />
                  </div>
                  <button
                    onClick={() => connectMut.mutate()}
                    disabled={connectMut.isPending || !apiKey}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#00D9FF] text-black text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    {connectMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
                    Connect
                  </button>
                </div>
              )}

              {/* Error message */}
              {connectError && (
                <p className="text-xs text-[#FF4444]">{connectError}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VersionInfoCard() {
  const { data: versionInfo, isLoading: versionLoading, refetch } = useQuery({
    queryKey: ['version-info'],
    queryFn: getVersionInfo,
    staleTime: 300_000,
  });

  return (
    <div className="mt-8 bg-[#0A0A0A] border border-[#2f2f2f] rounded-[10px] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#2f2f2f] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white font-['Space_Grotesk']">Version Info</h3>
        <button
          onClick={() => refetch()}
          disabled={versionLoading}
          className="p-1.5 rounded-md hover:bg-[#141414] text-[#6a6a6a] hover:text-white transition-colors disabled:opacity-40"
          title="Check for updates"
        >
          <RefreshCw size={14} className={versionLoading ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="px-5 py-4">
        {versionLoading && !versionInfo ? (
          <div className="flex items-center gap-2 text-[#6a6a6a] text-sm">
            <Loader2 size={14} className="animate-spin" />
            Checking version...
          </div>
        ) : versionInfo ? (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-[11px] text-[#6a6a6a] mb-1">Current Version</p>
                <p className="text-sm text-white font-['JetBrains_Mono']">v{versionInfo.current_version}</p>
              </div>
              <div className="flex-1">
                <p className="text-[11px] text-[#6a6a6a] mb-1">Build</p>
                <p className="text-sm text-[#8a8a8a] font-['JetBrains_Mono']">{versionInfo.build_version}</p>
              </div>
              <div className="flex-1">
                <p className="text-[11px] text-[#6a6a6a] mb-1">Latest on GitHub</p>
                <p className="text-sm text-white font-['JetBrains_Mono']">
                  {versionInfo.latest_version ? `v${versionInfo.latest_version}` : 'Unable to check'}
                </p>
              </div>
            </div>
            {versionInfo.update_available && (
              <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-[#00D9FF]/5 border border-[#00D9FF]/20 rounded-lg">
                <span className="text-[11px] font-semibold font-['JetBrains_Mono'] px-2 py-0.5 rounded bg-[#00D9FF]/10 text-[#00D9FF]">
                  Update available: v{versionInfo.latest_version}
                </span>
                <a
                  href="https://github.com/fxxkrlab/ADMINCHAT_PANEL/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-[#00D9FF] hover:underline flex items-center gap-1 ml-auto"
                >
                  View releases <ExternalLink size={11} />
                </a>
              </div>
            )}
            {!versionInfo.update_available && versionInfo.latest_version && (
              <p className="text-[11px] text-[#059669] font-['JetBrains_Mono']">You're on the latest version.</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-[#6a6a6a]">Failed to load version info.</p>
        )}
      </div>
    </div>
  );
}

export default function Settings() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<string>('admins');
  const [localSettings, setLocalSettings] = useState<Record<string, unknown>>({});
  const { data: activePlugins } = useActivePlugins();

  // Build plugin settings tabs
  const pluginSettingsTabs = (activePlugins || []).flatMap(p =>
    (p.manifest.frontend?.settings_tabs || []).map(tab => ({
      key: `plg_${p.plugin_id}_${tab.key}`,
      label: tab.label,
      pluginId: p.plugin_id,
      module: tab.module,
    }))
  );

  // Auto-select plugin settings tab when navigated from Market
  useEffect(() => {
    const state = location.state as { pluginTab?: string } | null;
    if (state?.pluginTab) {
      const matchingTab = pluginSettingsTabs.find(t => t.pluginId === state.pluginTab);
      if (matchingTab) {
        setActiveTab(matchingTab.key);
      }
      // Clear the state so it doesn't re-trigger
      window.history.replaceState({}, '');
    }
  }, [location.state, pluginSettingsTabs]);

  // Merge with core TABS
  const allTabs = [...TABS, ...pluginSettingsTabs.map(t => ({ key: t.key, label: t.label }))];
  const [hasChanges, setHasChanges] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const saveMutation = useMutation({
    mutationFn: (settings: Record<string, unknown>) => updateSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setHasChanges(false);
    },
  });

  const items = data?.items || [];

  // Initialize local settings from fetched data
  useEffect(() => {
    if (items.length > 0) {
      const settings: Record<string, unknown> = {};
      items.forEach((item) => {
        settings[item.key] = getSettingValue(items, item.key);
      });
      setLocalSettings(settings);
    }
  }, [items]);

  const updateLocal = (key: string, value: unknown) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate(localSettings);
  };

  const getLocal = (key: string, fallback: unknown = '') => {
    if (key in localSettings) return localSettings[key];
    return getSettingValue(items, key, fallback);
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="System Settings" />
      <div className="flex-1 px-8 py-6 overflow-auto">
        {/* Tab navigation */}
        <div className="flex items-center gap-6 mb-8 border-b border-[#1A1A1A]">
          {allTabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`pb-3 text-sm font-medium transition-colors relative ${
                activeTab === key
                  ? 'text-[#00D9FF]'
                  : 'text-[#6a6a6a] hover:text-white'
              }`}
            >
              {label}
              {activeTab === key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00D9FF]" />
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-[#6a6a6a] animate-spin" />
          </div>
        ) : (
          <>
            {/* Admins tab - admin table placeholder */}
            {activeTab === 'admins' && (
              <div className="space-y-6">
                {/* Admin table */}
                <div className="bg-[#0A0A0A] border border-[#2f2f2f] rounded-[10px] overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#2f2f2f]">
                        <th className="text-left text-[11px] font-semibold text-[#6a6a6a] uppercase tracking-[0.5px] font-['JetBrains_Mono'] px-5 py-3">Username</th>
                        <th className="text-left text-[11px] font-semibold text-[#6a6a6a] uppercase tracking-[0.5px] font-['JetBrains_Mono'] px-5 py-3">Role</th>
                        <th className="text-left text-[11px] font-semibold text-[#6a6a6a] uppercase tracking-[0.5px] font-['JetBrains_Mono'] px-5 py-3">Status</th>
                        <th className="text-right text-[11px] font-semibold text-[#6a6a6a] uppercase tracking-[0.5px] font-['JetBrains_Mono'] px-5 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-[#1A1A1A]">
                        <td className="px-5 py-3.5 text-sm text-white">admin</td>
                        <td className="px-5 py-3.5">
                          <span className="text-[10px] font-semibold font-['JetBrains_Mono'] px-2 py-0.5 rounded bg-[#00D9FF]/10 text-[#00D9FF]">SUPER ADMIN</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-[10px] font-semibold font-['JetBrains_Mono'] px-2 py-0.5 rounded bg-[#059669]/10 text-[#059669]">ACTIVE</span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button className="px-3 py-1 rounded-md text-xs font-medium text-[#8a8a8a] border border-[#2f2f2f] hover:bg-[#141414] transition-colors">
                            Edit
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Bottom settings cards row */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-[#0A0A0A] border border-[#2f2f2f] rounded-[10px] p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield size={16} className="text-[#00D9FF]" />
                      <span className="text-[13px] font-medium text-white">Turnstile</span>
                    </div>
                    <Toggle
                      value={!!getLocal('turnstile_enabled', false)}
                      onChange={(v) => updateLocal('turnstile_enabled', v)}
                    />
                  </div>
                  <div className="bg-[#0A0A0A] border border-[#2f2f2f] rounded-[10px] p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Database size={16} className="text-[#00D9FF]" />
                      <span className="text-[13px] font-medium text-white">Media Cache</span>
                    </div>
                    <span className="text-sm text-[#8a8a8a] font-['JetBrains_Mono']">{String(getLocal('media_cache_days', 7))} days</span>
                  </div>
                  <div className="bg-[#0A0A0A] border border-[#2f2f2f] rounded-[10px] p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <SettingsIcon size={16} className="text-[#00D9FF]" />
                      <span className="text-[13px] font-medium text-white">Sessions</span>
                    </div>
                    <Toggle
                      value={!!getLocal('auto_assign_enabled', false)}
                      onChange={(v) => updateLocal('auto_assign_enabled', v)}
                    />
                  </div>
                  <div className="bg-[#0A0A0A] border border-[#2f2f2f] rounded-[10px] p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock size={16} className="text-[#00D9FF]" />
                      <span className="text-[13px] font-medium text-white">Knowledge</span>
                    </div>
                    <span className="text-sm text-[#8a8a8a] font-['JetBrains_Mono']">{String(getLocal('missed_knowledge_update_hour', 3))}:00 UTC</span>
                  </div>
                </div>
              </div>
            )}

            {/* System tab */}
            {activeTab === 'system' && (
              <div className="bg-[#0A0A0A] border border-[#2f2f2f] rounded-[10px] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#2f2f2f]">
                  <h3 className="text-[18px] font-semibold text-white font-['Space_Grotesk']">General System Settings</h3>
                </div>
                <SettingCard
                  label="Auto-Assign Conversations"
                  description="Automatically assign new conversations to available agents"
                >
                  <Toggle
                    value={!!getLocal('auto_assign_enabled', false)}
                    onChange={(v) => updateLocal('auto_assign_enabled', v)}
                  />
                </SettingCard>
                <SettingCard
                  label="Session Timeout (minutes)"
                  description="Admin session inactivity timeout"
                >
                  <input
                    type="number"
                    value={String(getLocal('session_timeout_minutes', 60))}
                    onChange={(e) => updateLocal('session_timeout_minutes', Number(e.target.value))}
                    min={5}
                    max={1440}
                    className="w-24 h-10 px-3.5 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-white text-right font-['JetBrains_Mono'] focus:outline-none focus:border-[#00D9FF] transition-colors"
                  />
                </SettingCard>
                <SettingCard
                  label="Default Language"
                  description="Default language for AI and system responses"
                >
                  <select
                    value={String(getLocal('default_language', 'zh-CN'))}
                    onChange={(e) => updateLocal('default_language', e.target.value)}
                    className="h-10 px-3.5 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-white focus:outline-none focus:border-[#00D9FF] transition-colors"
                  >
                    <option value="zh-CN">Chinese (Simplified)</option>
                    <option value="en">English</option>
                    <option value="zh-TW">Chinese (Traditional)</option>
                  </select>
                </SettingCard>
              </div>
            )}

            {/* AI Config tab */}
            {activeTab === 'ai' && (
              <div className="bg-[#0A0A0A] border border-[#2f2f2f] rounded-[10px] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#2f2f2f]">
                  <h3 className="text-[18px] font-semibold text-white font-['Space_Grotesk']">AI Configuration</h3>
                </div>
                <SettingCard
                  label="Turnstile Enabled"
                  description="Require Turnstile verification for new users"
                >
                  <Toggle
                    value={!!getLocal('turnstile_enabled', false)}
                    onChange={(v) => updateLocal('turnstile_enabled', v)}
                  />
                </SettingCard>
                <SettingCard
                  label="Turnstile Site Key"
                  description="Public site key for the Turnstile widget"
                >
                  <input
                    type="text"
                    value={String(getLocal('turnstile_site_key', ''))}
                    onChange={(e) => updateLocal('turnstile_site_key', e.target.value)}
                    placeholder="0x..."
                    className="w-64 h-10 px-3.5 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-white placeholder:text-[#4a4a4a] font-['JetBrains_Mono'] focus:outline-none focus:border-[#00D9FF] transition-colors"
                  />
                </SettingCard>
              </div>
            )}

            {/* Market tab */}
            {activeTab === 'market' && <MarketTab localSettings={localSettings} setLocalSettings={setLocalSettings} saveMutation={saveMutation} />}

            {/* Permissions tab */}
            {activeTab === 'permissions' && (
              <div className="bg-[#0A0A0A] border border-[#2f2f2f] rounded-[10px] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#2f2f2f]">
                  <h3 className="text-[18px] font-semibold text-white font-['Space_Grotesk']">Permissions</h3>
                </div>
                <SettingCard
                  label="Media Cache TTL (days)"
                  description="How long media files are cached before automatic cleanup"
                >
                  <input
                    type="number"
                    value={String(getLocal('media_cache_days', 7))}
                    onChange={(e) => updateLocal('media_cache_days', Number(e.target.value))}
                    min={1}
                    max={90}
                    className="w-24 h-10 px-3.5 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-white text-right font-['JetBrains_Mono'] focus:outline-none focus:border-[#00D9FF] transition-colors"
                  />
                </SettingCard>
                <SettingCard
                  label="Missed Knowledge Update Hour"
                  description="Hour of day (0-23 UTC) to run the missed knowledge analysis"
                >
                  <input
                    type="number"
                    value={String(getLocal('missed_knowledge_update_hour', 3))}
                    onChange={(e) => updateLocal('missed_knowledge_update_hour', Number(e.target.value))}
                    min={0}
                    max={23}
                    className="w-24 h-10 px-3.5 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-white text-right font-['JetBrains_Mono'] focus:outline-none focus:border-[#00D9FF] transition-colors"
                  />
                </SettingCard>
              </div>
            )}

            {/* Dynamic plugin settings tabs */}
            {pluginSettingsTabs
              .filter(t => t.key === activeTab)
              .map(t => (
                <PluginLoader
                  key={t.key}
                  pluginId={t.pluginId}
                  moduleName={t.module}
                />
              ))
            }

            {/* Save button */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSave}
                disabled={!hasChanges || saveMutation.isPending}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#00D9FF] text-black text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-30"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
              </button>
            </div>

            {saveMutation.isSuccess && (
              <p className="mt-3 text-xs text-[#059669] text-right">Settings saved successfully.</p>
            )}
            {saveMutation.isError && (
              <p className="mt-3 text-xs text-[#FF4444] text-right">
                Failed to save: {(saveMutation.error as Error)?.message || 'Unknown error'}
              </p>
            )}

            {/* Version Info */}
            <VersionInfoCard />
          </>
        )}
      </div>
    </div>
  );
}
