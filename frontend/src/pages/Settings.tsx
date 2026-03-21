import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Clock, Shield, Database, Settings as SettingsIcon, Loader2 } from 'lucide-react';
import Header from '../components/layout/Header';
import { getSettings, updateSettings } from '../services/settingsApi';
import type { SettingItem } from '../types';

// ---- Tab definitions ----
const TABS = [
  { key: 'system', label: 'System', icon: SettingsIcon },
  { key: 'turnstile', label: 'Turnstile', icon: Shield },
  { key: 'media', label: 'Media Cache', icon: Database },
  { key: 'schedule', label: 'Schedules', icon: Clock },
] as const;

type TabKey = typeof TABS[number]['key'];

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
    <div className="flex items-start justify-between gap-8 px-5 py-4 border-b border-border-subtle/50 last:border-0">
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-text-primary">{label}</h4>
        {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
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
        value ? 'bg-accent' : 'bg-bg-elevated border border-border'
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

export default function Settings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('system');
  const [localSettings, setLocalSettings] = useState<Record<string, unknown>>({});
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
      <div className="flex-1 p-6 overflow-auto">
        {/* Tab navigation */}
        <div className="flex items-center gap-1 mb-6 border-b border-border-subtle w-fit">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative ${
                activeTab === key
                  ? 'text-accent'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {activeTab === key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
          </div>
        ) : (
          <>
            {/* System tab */}
            {activeTab === 'system' && (
              <div className="bg-bg-card border border-border-subtle rounded-lg overflow-hidden">
                <div className="px-5 py-3 border-b border-border-subtle">
                  <h3 className="text-sm font-semibold text-text-primary">General System Settings</h3>
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
                    className="w-24 h-9 px-3.5 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary text-right font-mono focus:outline-none focus:border-accent transition-colors"
                  />
                </SettingCard>
                <SettingCard
                  label="Default Language"
                  description="Default language for AI and system responses"
                >
                  <select
                    value={String(getLocal('default_language', 'zh-CN'))}
                    onChange={(e) => updateLocal('default_language', e.target.value)}
                    className="h-9 px-3.5 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
                  >
                    <option value="zh-CN">Chinese (Simplified)</option>
                    <option value="en">English</option>
                    <option value="zh-TW">Chinese (Traditional)</option>
                  </select>
                </SettingCard>
              </div>
            )}

            {/* Turnstile tab */}
            {activeTab === 'turnstile' && (
              <div className="bg-bg-card border border-border-subtle rounded-lg overflow-hidden">
                <div className="px-5 py-3 border-b border-border-subtle">
                  <h3 className="text-sm font-semibold text-text-primary">Cloudflare Turnstile Configuration</h3>
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
                    className="w-64 h-9 px-3.5 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary placeholder:text-text-placeholder font-mono focus:outline-none focus:border-accent transition-colors"
                  />
                </SettingCard>
                <SettingCard
                  label="Turnstile Secret Key"
                  description="Server-side secret key (will be encrypted)"
                >
                  <input
                    type="password"
                    value={String(getLocal('turnstile_secret_key', ''))}
                    onChange={(e) => updateLocal('turnstile_secret_key', e.target.value)}
                    placeholder="0x..."
                    className="w-64 h-9 px-3.5 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary placeholder:text-text-placeholder font-mono focus:outline-none focus:border-accent transition-colors"
                  />
                </SettingCard>
                <SettingCard
                  label="Verification Valid Days"
                  description="How many days a Turnstile verification remains valid"
                >
                  <input
                    type="number"
                    value={String(getLocal('turnstile_valid_days', 30))}
                    onChange={(e) => updateLocal('turnstile_valid_days', Number(e.target.value))}
                    min={1}
                    max={365}
                    className="w-24 h-9 px-3.5 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary text-right font-mono focus:outline-none focus:border-accent transition-colors"
                  />
                </SettingCard>
              </div>
            )}

            {/* Media Cache tab */}
            {activeTab === 'media' && (
              <div className="bg-bg-card border border-border-subtle rounded-lg overflow-hidden">
                <div className="px-5 py-3 border-b border-border-subtle">
                  <h3 className="text-sm font-semibold text-text-primary">Media Cache Settings</h3>
                </div>
                <SettingCard
                  label="Cache TTL (days)"
                  description="How long media files are cached before automatic cleanup"
                >
                  <input
                    type="number"
                    value={String(getLocal('media_cache_days', 7))}
                    onChange={(e) => updateLocal('media_cache_days', Number(e.target.value))}
                    min={1}
                    max={90}
                    className="w-24 h-9 px-3.5 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary text-right font-mono focus:outline-none focus:border-accent transition-colors"
                  />
                </SettingCard>
                <SettingCard
                  label="Max Cache Size (MB)"
                  description="Maximum total cache directory size. 0 = unlimited."
                >
                  <input
                    type="number"
                    value={String(getLocal('media_cache_max_mb', 0))}
                    onChange={(e) => updateLocal('media_cache_max_mb', Number(e.target.value))}
                    min={0}
                    className="w-24 h-9 px-3.5 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary text-right font-mono focus:outline-none focus:border-accent transition-colors"
                  />
                </SettingCard>
              </div>
            )}

            {/* Schedules tab */}
            {activeTab === 'schedule' && (
              <div className="bg-bg-card border border-border-subtle rounded-lg overflow-hidden">
                <div className="px-5 py-3 border-b border-border-subtle">
                  <h3 className="text-sm font-semibold text-text-primary">Scheduled Tasks</h3>
                </div>
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
                    className="w-24 h-9 px-3.5 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary text-right font-mono focus:outline-none focus:border-accent transition-colors"
                  />
                </SettingCard>
                <SettingCard
                  label="Media Cache Cleanup Hour"
                  description="Hour of day (0-23 UTC) to run expired media cleanup"
                >
                  <input
                    type="number"
                    value={String(getLocal('media_cleanup_hour', 4))}
                    onChange={(e) => updateLocal('media_cleanup_hour', Number(e.target.value))}
                    min={0}
                    max={23}
                    className="w-24 h-9 px-3.5 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary text-right font-mono focus:outline-none focus:border-accent transition-colors"
                  />
                </SettingCard>
              </div>
            )}

            {/* Save button */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSave}
                disabled={!hasChanges || saveMutation.isPending}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-black text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-30"
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
              <p className="mt-3 text-xs text-green text-right">Settings saved successfully.</p>
            )}
            {saveMutation.isError && (
              <p className="mt-3 text-xs text-red text-right">
                Failed to save: {(saveMutation.error as Error)?.message || 'Unknown error'}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
