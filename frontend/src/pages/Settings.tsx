import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Clock, Shield, Database, Settings as SettingsIcon, Loader2 } from 'lucide-react';
import Header from '../components/layout/Header';
import { getSettings, updateSettings } from '../services/settingsApi';
import type { SettingItem } from '../types';

// ---- Tab definitions ----
const TABS = [
  { key: 'admins', label: 'Admins' },
  { key: 'system', label: 'System' },
  { key: 'ai', label: 'AI Config' },
  { key: 'permissions', label: 'Permissions' },
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

export default function Settings() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('admins');
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
      <div className="flex-1 px-8 py-6 overflow-auto">
        {/* Tab navigation */}
        <div className="flex items-center gap-6 mb-8 border-b border-[#1A1A1A]">
          {TABS.map(({ key, label }) => (
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
          </>
        )}
      </div>
    </div>
  );
}
