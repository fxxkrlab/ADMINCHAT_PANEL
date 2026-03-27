import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Download,
  Check,
  Loader2,
  RefreshCw,
  ChevronDown,
  Power,
  PowerOff,
  Trash2,
  ArrowUpCircle,
  X,
  Settings,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import Header from '../components/layout/Header';
import {
  searchMarketPlugins,
  getMarketPluginDetail,
  installFromMarket,
  checkPluginUpdates,
  type MarketPlugin,
  type MarketPluginDetail,
} from '../services/marketApi';
import { useInstalledPlugins, useInvalidatePlugins } from '../plugins/useInstalledPlugins';
import type { InstalledPlugin } from '../plugins/types';
import api from '../services/api';

// ---- Constants ----
const CATEGORIES = ['All', 'Media', 'Automation', 'Analytics', 'Communication', 'Security', 'Utilities'] as const;
const PRICING_OPTIONS = ['all', 'free', 'paid'] as const;
const SORT_OPTIONS = [
  { value: 'popular' as const, label: 'Popular' },
  { value: 'newest' as const, label: 'Newest' },
  { value: 'updated' as const, label: 'Recently Updated' },
];

// ---- Helpers ----
function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatPrice(cents: number, currency: string, model: string): string {
  if (model === 'free') return 'FREE';
  const amount = (cents / 100).toFixed(2);
  const suffix = model.includes('monthly') ? '/mo' : model.includes('yearly') ? '/yr' : '';
  return `${currency === 'USD' ? '$' : currency}${amount}${suffix}`;
}

function statusBadgeClasses(status: InstalledPlugin['status']): string {
  switch (status) {
    case 'active': return 'bg-[#059669]/10 text-[#059669]';
    case 'disabled': return 'bg-[#FF8800]/10 text-[#FF8800]';
    case 'error': return 'bg-[#FF4444]/10 text-[#FF4444]';
    default: return 'bg-[#8a8a8a]/10 text-[#8a8a8a]';
  }
}

// ---- Plugin Icon ----
function PluginIcon({ icon, color, name, size = 40 }: { icon?: string; color?: string; name: string; size?: number }) {
  const bgColor = color || '#00D9FF';
  const initials = name.slice(0, 2).toUpperCase();

  if (icon) {
    return (
      <div
        className="rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
        style={{ width: size, height: size, backgroundColor: bgColor + '20' }}
      >
        <img src={icon} alt={name} className="w-full h-full object-cover rounded-lg" />
      </div>
    );
  }

  return (
    <div
      className="rounded-lg flex items-center justify-center shrink-0"
      style={{ width: size, height: size, backgroundColor: bgColor + '15' }}
    >
      <span className="font-semibold font-['Space_Grotesk']" style={{ color: bgColor, fontSize: size * 0.35 }}>
        {initials}
      </span>
    </div>
  );
}

// ---- Plugin Card ----
function PluginCard({
  plugin,
  isInstalled,
  installedVersion,
  installedStatus,
  onInstall,
  onToggleActive,
  onClick,
  installing,
  toggling,
}: {
  plugin: MarketPlugin;
  isInstalled: boolean;
  installedVersion?: string;
  installedStatus?: InstalledPlugin['status'];
  onInstall: () => void;
  onToggleActive?: () => void;
  onClick: () => void;
  installing: boolean;
  toggling?: boolean;
}) {
  const isFree = plugin.pricing_model === 'free';
  const latestVersion = plugin.latest_version;
  const hasUpdate = isInstalled && installedVersion && latestVersion && installedVersion !== latestVersion;

  return (
    <div
      className="bg-[#0A0A0A] border border-[#2f2f2f] rounded-[10px] p-5 hover:border-[#4a4a4a] transition-colors cursor-pointer flex flex-col"
      onClick={onClick}
    >
      <div className="flex items-start gap-3 mb-3">
        <PluginIcon icon={plugin.icon} color={plugin.color} name={plugin.name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white truncate">{plugin.name}</h3>
            {plugin.author?.verified && (
              <Check size={12} className="text-[#00D9FF] shrink-0" />
            )}
          </div>
          <span
            className={`text-[10px] font-semibold font-['JetBrains_Mono'] px-2 py-0.5 rounded mt-1 inline-block ${
              isFree ? 'bg-[#059669]/10 text-[#059669]' : 'bg-[#FF8800]/10 text-[#FF8800]'
            }`}
          >
            {formatPrice(plugin.price_cents, plugin.currency, plugin.pricing_model)}
          </span>
        </div>
      </div>

      <p className="text-xs text-[#8a8a8a] mb-3 line-clamp-2 flex-1">{plugin.description}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-[11px] text-[#6a6a6a]">
          <span className="flex items-center gap-1">
            <Download size={11} />
            {formatDownloads(plugin.download_count)}
          </span>
          <span>by {plugin.author_name || plugin.author?.display_name || plugin.author?.username || 'Unknown'}</span>
        </div>
        {latestVersion && <span className="text-[10px] text-[#6a6a6a] font-['JetBrains_Mono']">v{latestVersion}</span>}
      </div>

      <div className="mt-3 pt-3 border-t border-[#1A1A1A]">
        {isInstalled && !hasUpdate ? (
          <div className="flex items-center gap-2">
            <div className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium ${
              installedStatus === 'active'
                ? 'bg-[#059669]/10 text-[#059669]'
                : installedStatus === 'error'
                  ? 'bg-[#FF4444]/10 text-[#FF4444]'
                  : 'bg-[#FF8800]/10 text-[#FF8800]'
            }`}>
              {installedStatus === 'active' ? <Power size={14} /> : installedStatus === 'error' ? <XCircle size={14} /> : <PowerOff size={14} />}
              {installedStatus === 'active' ? 'Active' : installedStatus === 'error' ? 'Error' : 'Inactive'}
            </div>
            {onToggleActive && installedStatus !== 'error' && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleActive(); }}
                disabled={toggling}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-40 ${
                  installedStatus === 'active'
                    ? 'text-[#FF8800] hover:bg-[#FF8800]/10'
                    : 'text-[#059669] hover:bg-[#059669]/10'
                }`}
                title={installedStatus === 'active' ? 'Deactivate' : 'Activate'}
              >
                {toggling ? <Loader2 size={14} className="animate-spin" /> : installedStatus === 'active' ? <PowerOff size={14} /> : <Power size={14} />}
              </button>
            )}
          </div>
        ) : hasUpdate ? (
          <button
            onClick={(e) => { e.stopPropagation(); onInstall(); }}
            disabled={installing}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-[#FF8800] text-black text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {installing ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpCircle size={14} />}
            Update Available
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onInstall(); }}
            disabled={installing}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-[#00D9FF] text-black text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {installing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Install
          </button>
        )}
      </div>
    </div>
  );
}

// ---- Plugin Detail Modal ----
function PluginDetailModal({
  plugin,
  isInstalled,
  installedVersion,
  installedStatus,
  onClose,
  onInstall,
  onUninstall,
  onToggleActive,
  installing,
  toggling,
}: {
  plugin: MarketPluginDetail | null;
  isInstalled: boolean;
  installedVersion?: string;
  installedStatus?: InstalledPlugin['status'];
  onClose: () => void;
  onInstall: () => void;
  onUninstall?: () => void;
  onToggleActive?: () => void;
  installing: boolean;
  toggling?: boolean;
}) {
  if (!plugin) return null;

  const isFree = plugin.pricing_model === 'free';
  const latestVersion = plugin.latest_version || plugin.versions?.[0]?.version;
  const hasUpdate = isInstalled && installedVersion && latestVersion && installedVersion !== latestVersion;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#0A0A0A] border border-[#2f2f2f] rounded-[10px] w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-4 px-6 py-5 border-b border-[#2f2f2f]">
          <PluginIcon icon={plugin.icon} color={plugin.color} name={plugin.name} size={48} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white font-['Space_Grotesk']">{plugin.name}</h2>
              {plugin.author?.verified && <Check size={14} className="text-[#00D9FF]" />}
              <span
                className={`text-[10px] font-semibold font-['JetBrains_Mono'] px-2 py-0.5 rounded ${
                  isFree ? 'bg-[#059669]/10 text-[#059669]' : 'bg-[#FF8800]/10 text-[#FF8800]'
                }`}
              >
                {formatPrice(plugin.price_cents, plugin.currency, plugin.pricing_model)}
              </span>
            </div>
            <p className="text-xs text-[#8a8a8a] mt-1">{plugin.description}</p>
            <div className="flex items-center gap-4 mt-2 text-[11px] text-[#6a6a6a]">
              <span className="flex items-center gap-1"><Download size={11} /> {formatDownloads(plugin.download_count)}</span>
              <span>by {plugin.author_name || plugin.author?.display_name || plugin.author?.username || 'Unknown'}</span>
              {latestVersion && <span className="font-['JetBrains_Mono']">v{latestVersion}</span>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-[#141414] text-[#6a6a6a] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Tags */}
          {plugin.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {plugin.tags.map((tag) => (
                <span key={tag} className="text-[10px] font-['JetBrains_Mono'] px-2 py-0.5 rounded bg-[#141414] text-[#8a8a8a] border border-[#2f2f2f]">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Long description */}
          {plugin.long_description && (
            <div className="text-sm text-[#8a8a8a] whitespace-pre-wrap leading-relaxed">
              {plugin.long_description}
            </div>
          )}

          {/* Screenshots */}
          {plugin.screenshots && plugin.screenshots.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono']">Screenshots</h4>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {plugin.screenshots.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Screenshot ${i + 1}`}
                    className="h-40 rounded-lg border border-[#2f2f2f] object-cover shrink-0"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Version History */}
          {plugin.versions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono']">Version History</h4>
              <div className="space-y-2">
                {plugin.versions.slice(0, 5).map((v) => (
                  <div key={v.version} className="flex items-start gap-3 px-4 py-3 bg-[#141414] rounded-lg">
                    <span className="text-xs font-['JetBrains_Mono'] text-white shrink-0">v{v.version}</span>
                    <div className="flex-1 min-w-0">
                      {v.changelog && <p className="text-xs text-[#8a8a8a]">{v.changelog}</p>}
                      <p className="text-[10px] text-[#4a4a4a] mt-1">{new Date(v.published_at).toLocaleDateString()}</p>
                    </div>
                    {v.min_panel_version && (
                      <span className="text-[10px] font-['JetBrains_Mono'] text-[#6a6a6a]">Panel {'>'}= v{v.min_panel_version}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2f2f2f] flex items-center justify-end gap-3">
          {isInstalled && onUninstall && (
            <button
              onClick={onUninstall}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md text-[#FF4444] hover:bg-[#FF4444]/10 text-sm font-medium transition-colors mr-auto"
            >
              <Trash2 size={16} />
              Uninstall
            </button>
          )}
          {isInstalled && onToggleActive && installedStatus !== 'error' && (
            <button
              onClick={onToggleActive}
              disabled={toggling}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-40 ${
                installedStatus === 'active'
                  ? 'bg-[#FF8800]/10 text-[#FF8800] hover:bg-[#FF8800]/20'
                  : 'bg-[#059669]/10 text-[#059669] hover:bg-[#059669]/20'
              }`}
            >
              {toggling ? <Loader2 size={16} className="animate-spin" /> : installedStatus === 'active' ? <PowerOff size={16} /> : <Power size={16} />}
              {installedStatus === 'active' ? 'Deactivate' : 'Activate'}
            </button>
          )}
          {isInstalled && !hasUpdate ? (
            <div className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium ${
              installedStatus === 'active'
                ? 'bg-[#059669]/10 text-[#059669]'
                : installedStatus === 'error'
                  ? 'bg-[#FF4444]/10 text-[#FF4444]'
                  : 'bg-[#FF8800]/10 text-[#FF8800]'
            }`}>
              {installedStatus === 'active' ? <Power size={16} /> : installedStatus === 'error' ? <XCircle size={16} /> : <PowerOff size={16} />}
              {installedStatus === 'active' ? 'Active' : installedStatus === 'error' ? 'Error' : 'Inactive'}
            </div>
          ) : hasUpdate ? (
            <button
              onClick={onInstall}
              disabled={installing}
              className="flex items-center gap-1.5 px-5 py-2 rounded-md bg-[#FF8800] text-black text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {installing ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpCircle size={16} />}
              Update to v{latestVersion}
            </button>
          ) : (
            <button
              onClick={onInstall}
              disabled={installing}
              className="flex items-center gap-1.5 px-5 py-2 rounded-md bg-[#00D9FF] text-black text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {installing ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Install Plugin
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Uninstall Confirmation Dialog ----
function UninstallDialog({
  pluginName,
  onConfirm,
  onCancel,
}: {
  pluginName: string;
  onConfirm: (dropTables: boolean) => void;
  onCancel: () => void;
}) {
  const [dropTables, setDropTables] = useState(false);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="bg-[#0A0A0A] border border-[#2f2f2f] rounded-[10px] w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-[#FF4444]/10">
            <AlertTriangle size={20} className="text-[#FF4444]" />
          </div>
          <h3 className="text-base font-semibold text-white font-['Space_Grotesk']">Uninstall Plugin</h3>
        </div>
        <p className="text-sm text-[#8a8a8a] mb-4">
          Are you sure you want to uninstall <span className="text-white font-medium">{pluginName}</span>? This action cannot be undone.
        </p>
        <label className="flex items-center gap-2.5 mb-5 cursor-pointer group">
          <input
            type="checkbox"
            checked={dropTables}
            onChange={(e) => setDropTables(e.target.checked)}
            className="w-4 h-4 rounded border-[#2f2f2f] bg-[#141414] text-[#FF4444] focus:ring-[#FF4444]/30 cursor-pointer"
          />
          <span className="text-sm text-[#8a8a8a] group-hover:text-white transition-colors">
            Delete all plugin data (database tables)
          </span>
        </label>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md text-sm text-[#8a8a8a] hover:text-white hover:bg-[#141414] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(dropTables)}
            className="px-4 py-2 rounded-md bg-[#FF4444] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Uninstall
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Installed Plugins Table ----
function InstalledTab({
  plugins,
  updates,
  onAction,
  onUninstall,
  onOpenSettings,
  actionLoading,
}: {
  plugins: InstalledPlugin[];
  updates: Array<{ plugin_id: string; current: string; latest: string; changelog?: string; compatible: boolean }>;
  onAction: (pluginId: string, action: string) => void;
  onUninstall: (plugin: InstalledPlugin) => void;
  onOpenSettings: (pluginId: string) => void;
  actionLoading: string | null;
}) {
  const updatesMap = useMemo(() => new Map(updates.map((u) => [u.plugin_id, u])), [updates]);

  if (plugins.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[#6a6a6a]">
        <Download size={40} className="mb-3 opacity-40" />
        <p className="text-sm">No plugins installed yet.</p>
        <p className="text-xs text-[#4a4a4a] mt-1">Browse the Market tab to find and install plugins.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0A0A0A] border border-[#2f2f2f] rounded-[10px] overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#2f2f2f]">
            <th className="text-left text-[11px] font-semibold text-[#6a6a6a] uppercase tracking-[0.5px] font-['JetBrains_Mono'] px-5 py-3">Plugin</th>
            <th className="text-left text-[11px] font-semibold text-[#6a6a6a] uppercase tracking-[0.5px] font-['JetBrains_Mono'] px-5 py-3">Version</th>
            <th className="text-left text-[11px] font-semibold text-[#6a6a6a] uppercase tracking-[0.5px] font-['JetBrains_Mono'] px-5 py-3">Status</th>
            <th className="text-right text-[11px] font-semibold text-[#6a6a6a] uppercase tracking-[0.5px] font-['JetBrains_Mono'] px-5 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {plugins.map((plugin) => {
            const update = updatesMap.get(plugin.plugin_id);
            const isLoading = actionLoading === plugin.plugin_id;
            const hasSettings = (plugin.manifest.frontend?.settings_tabs?.length ?? 0) > 0;
            return (
              <tr key={plugin.plugin_id} className="border-b border-[#1A1A1A] last:border-0">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <PluginIcon icon={plugin.manifest.icon} color={plugin.manifest.color} name={plugin.name} size={32} />
                    <div>
                      <p className="text-sm text-white font-medium">{plugin.name}</p>
                      <p className="text-[11px] text-[#6a6a6a]">{plugin.manifest.description || ''}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className="text-sm text-white font-['JetBrains_Mono']">v{plugin.version}</span>
                  {update && update.compatible && (
                    <span className="ml-2 text-[10px] font-semibold font-['JetBrains_Mono'] px-2 py-0.5 rounded bg-[#FF8800]/10 text-[#FF8800]">
                      v{update.latest} available
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <span className={`text-[10px] font-semibold font-['JetBrains_Mono'] px-2 py-0.5 rounded uppercase ${statusBadgeClasses(plugin.status)}`}>
                    {plugin.status}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {update && update.compatible && (
                      <button
                        onClick={() => onAction(plugin.plugin_id, 'update')}
                        disabled={isLoading}
                        className="p-1.5 rounded-md text-[#FF8800] hover:bg-[#FF8800]/10 transition-colors disabled:opacity-40"
                        title="Update"
                      >
                        <ArrowUpCircle size={16} />
                      </button>
                    )}
                    {hasSettings && (
                      <button
                        onClick={() => onOpenSettings(plugin.plugin_id)}
                        className="p-1.5 rounded-md text-[#8a8a8a] hover:text-[#00D9FF] hover:bg-[#00D9FF]/10 transition-colors"
                        title="Settings"
                      >
                        <Settings size={16} />
                      </button>
                    )}
                    {plugin.status === 'active' ? (
                      <button
                        onClick={() => onAction(plugin.plugin_id, 'deactivate')}
                        disabled={isLoading}
                        className="p-1.5 rounded-md text-[#FF8800] hover:bg-[#FF8800]/10 transition-colors disabled:opacity-40"
                        title="Deactivate"
                      >
                        <PowerOff size={16} />
                      </button>
                    ) : plugin.status !== 'error' ? (
                      <button
                        onClick={() => onAction(plugin.plugin_id, 'activate')}
                        disabled={isLoading}
                        className="p-1.5 rounded-md text-[#059669] hover:bg-[#059669]/10 transition-colors disabled:opacity-40"
                        title="Activate"
                      >
                        <Power size={16} />
                      </button>
                    ) : null}
                    <button
                      onClick={() => onUninstall(plugin)}
                      disabled={isLoading}
                      className="p-1.5 rounded-md text-[#FF4444] hover:bg-[#FF4444]/10 transition-colors disabled:opacity-40"
                      title="Uninstall"
                    >
                      <Trash2 size={16} />
                    </button>
                    {isLoading && <Loader2 size={14} className="animate-spin text-[#6a6a6a]" />}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---- Inline Notification ----
function Notification({
  type,
  message,
  onDismiss,
}: {
  type: 'success' | 'error';
  message: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={`fixed top-6 right-6 z-[200] flex items-center gap-2.5 px-4 py-3 rounded-lg border shadow-lg animate-in slide-in-from-top-2 ${
        type === 'success'
          ? 'bg-[#059669]/10 border-[#059669]/30 text-[#059669]'
          : 'bg-[#FF4444]/10 border-[#FF4444]/30 text-[#FF4444]'
      }`}
    >
      {type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onDismiss} className="ml-2 p-0.5 rounded hover:bg-white/10 transition-colors">
        <X size={14} />
      </button>
    </div>
  );
}

// ---- Main Market Page ----
export default function Market() {
  const queryClient = useQueryClient();
  const invalidatePlugins = useInvalidatePlugins();
  const navigate = useNavigate();

  // State
  const [activeTab, setActiveTab] = useState<'browse' | 'installed'>('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [pricing, setPricing] = useState<'all' | 'free' | 'paid'>('all');
  const [sort, setSort] = useState<'popular' | 'newest' | 'updated'>('popular');
  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [uninstallTarget, setUninstallTarget] = useState<InstalledPlugin | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Queries
  const { data: browseData, isLoading: browseLoading } = useQuery({
    queryKey: ['market-plugins', searchQuery, category, pricing, sort],
    queryFn: () =>
      searchMarketPlugins({
        q: searchQuery || undefined,
        category: category === 'All' ? undefined : category.toLowerCase(),
        pricing: pricing === 'all' ? undefined : pricing,
        sort,
        page_size: 30,
      }),
    enabled: activeTab === 'browse',
    staleTime: 60_000,
  });

  const { data: installedPlugins = [] } = useInstalledPlugins();

  const { data: pluginDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['market-plugin-detail', selectedPluginId],
    queryFn: () => getMarketPluginDetail(selectedPluginId!),
    enabled: !!selectedPluginId,
    staleTime: 120_000,
  });

  const { data: updates = [] } = useQuery({
    queryKey: ['market-updates'],
    queryFn: checkPluginUpdates,
    enabled: activeTab === 'installed',
    staleTime: 300_000,
  });

  const dismissNotification = useCallback(() => setNotification(null), []);

  // Install mutation
  const installMutation = useMutation({
    mutationFn: ({ pluginId, version }: { pluginId: string; version: string }) =>
      installFromMarket(pluginId, version),
    onSuccess: () => {
      invalidatePlugins();
      queryClient.invalidateQueries({ queryKey: ['market-updates'] });
      setNotification({ type: 'success', message: 'Plugin installed and activated successfully' });
    },
    onError: (error: unknown) => {
      const axiosDetail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setNotification({
        type: 'error',
        message: axiosDetail || (error instanceof Error ? error.message : 'Failed to install plugin'),
      });
    },
  });

  // Installed lookup
  const installedMap = useMemo(
    () => new Map(installedPlugins.map((p) => [p.plugin_id, p])),
    [installedPlugins]
  );

  // Handlers
  const handleInstall = (pluginId: string, version: string) => {
    installMutation.mutate({ pluginId, version });
  };

  const handlePluginAction = async (pluginId: string, action: string) => {
    setActionLoading(pluginId);
    try {
      if (action === 'activate') {
        await api.post(`/plugins/${pluginId}/action`, { action: 'activate' });
      } else if (action === 'deactivate') {
        await api.post(`/plugins/${pluginId}/action`, { action: 'deactivate' });
      } else if (action === 'update') {
        const update = updates.find((u) => u.plugin_id === pluginId);
        if (update) {
          await api.post(`/plugins/${pluginId}/update`, { version: update.latest });
        }
      }
      invalidatePlugins();
      queryClient.invalidateQueries({ queryKey: ['market-updates'] });
    } finally {
      setActionLoading(null);
    }
  };

  const handleUninstallConfirm = async (dropTables: boolean) => {
    if (!uninstallTarget) return;
    const pluginId = uninstallTarget.plugin_id;
    setUninstallTarget(null);
    setActionLoading(pluginId);
    try {
      await api.post(`/plugins/${pluginId}/action`, { action: 'uninstall', drop_tables: dropTables });
      invalidatePlugins();
      queryClient.invalidateQueries({ queryKey: ['market-updates'] });
      setNotification({ type: 'success', message: `${uninstallTarget.name} uninstalled successfully` });
    } catch {
      setNotification({ type: 'error', message: `Failed to uninstall ${uninstallTarget.name}` });
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenSettings = (pluginId: string) => {
    navigate('/settings', { state: { pluginTab: pluginId } });
  };

  const handleToggleActive = async (pluginId: string) => {
    const plugin = installedMap.get(pluginId);
    if (!plugin) return;
    const action = plugin.status === 'active' ? 'deactivate' : 'activate';
    setActionLoading(pluginId);
    try {
      await api.post(`/plugins/${pluginId}/action`, { action });
      invalidatePlugins();
      setNotification({ type: 'success', message: `Plugin ${action}d successfully` });
    } catch {
      setNotification({ type: 'error', message: `Failed to ${action} plugin` });
    } finally {
      setActionLoading(null);
    }
  };

  const marketPlugins = browseData?.items || [];

  return (
    <div className="flex flex-col h-full">
      <Header title="Plugin Market" />
      <div className="flex-1 px-8 py-6 overflow-auto">
        {/* Tab navigation */}
        <div className="flex items-center gap-6 mb-6 border-b border-[#1A1A1A]">
          {(['browse', 'installed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium transition-colors relative capitalize ${
                activeTab === tab
                  ? 'text-[#00D9FF]'
                  : 'text-[#6a6a6a] hover:text-white'
              }`}
            >
              {tab === 'browse' ? 'Browse' : `Installed (${installedPlugins.length})`}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00D9FF]" />
              )}
            </button>
          ))}
          {activeTab === 'installed' && (
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['market-updates'] })}
              className="ml-auto pb-3 flex items-center gap-1.5 text-xs text-[#6a6a6a] hover:text-white transition-colors"
            >
              <RefreshCw size={12} />
              Check for Updates
            </button>
          )}
        </div>

        {/* Browse Tab */}
        {activeTab === 'browse' && (
          <>
            {/* Search + Filters */}
            <div className="flex items-center gap-3 mb-5">
              <div className="relative flex-1 max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a4a4a]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search plugins..."
                  className="w-full h-10 pl-10 pr-4 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-white placeholder:text-[#4a4a4a] focus:outline-none focus:border-[#00D9FF] transition-colors"
                />
              </div>
              <div className="relative">
                <select
                  value={pricing}
                  onChange={(e) => setPricing(e.target.value as typeof pricing)}
                  className="appearance-none h-10 pl-3 pr-8 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-white focus:outline-none focus:border-[#00D9FF] transition-colors cursor-pointer"
                >
                  {PRICING_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === 'all' ? 'All Pricing' : opt === 'free' ? 'Free' : 'Paid'}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6a6a6a] pointer-events-none" />
              </div>
              <div className="relative">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as typeof sort)}
                  className="appearance-none h-10 pl-3 pr-8 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-white focus:outline-none focus:border-[#00D9FF] transition-colors cursor-pointer"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6a6a6a] pointer-events-none" />
              </div>
            </div>

            {/* Category chips */}
            <div className="flex items-center gap-2 mb-6">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    category === cat
                      ? 'bg-[#00D9FF]/10 text-[#00D9FF] border border-[#00D9FF]/30'
                      : 'bg-[#141414] text-[#8a8a8a] border border-[#2f2f2f] hover:text-white hover:border-[#4a4a4a]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Plugin grid */}
            {browseLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 text-[#6a6a6a] animate-spin" />
              </div>
            ) : marketPlugins.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-[#6a6a6a]">
                <Search size={40} className="mb-3 opacity-40" />
                <p className="text-sm">No plugins found.</p>
                <p className="text-xs text-[#4a4a4a] mt-1">Try adjusting your search or filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                {marketPlugins.map((plugin) => {
                  const installed = installedMap.get(plugin.plugin_id);
                  return (
                    <PluginCard
                      key={plugin.plugin_id}
                      plugin={plugin}
                      isInstalled={!!installed}
                      installedVersion={installed?.version}
                      installedStatus={installed?.status}
                      onInstall={() => handleInstall(plugin.plugin_id, plugin.latest_version)}
                      onToggleActive={installed ? () => handleToggleActive(plugin.plugin_id) : undefined}
                      onClick={() => setSelectedPluginId(plugin.plugin_id)}
                      installing={installMutation.isPending && installMutation.variables?.pluginId === plugin.plugin_id}
                      toggling={actionLoading === plugin.plugin_id}
                    />
                  );
                })}
              </div>
            )}

            {/* Pagination info */}
            {browseData && browseData.total > 0 && (
              <div className="mt-4 text-center text-[11px] text-[#4a4a4a] font-['JetBrains_Mono']">
                Showing {marketPlugins.length} of {browseData.total} plugins
              </div>
            )}
          </>
        )}

        {/* Installed Tab */}
        {activeTab === 'installed' && (
          <InstalledTab
            plugins={installedPlugins}
            updates={updates}
            onAction={handlePluginAction}
            onUninstall={setUninstallTarget}
            onOpenSettings={handleOpenSettings}
            actionLoading={actionLoading}
          />
        )}

        {/* Plugin Detail Modal */}
        {selectedPluginId && (
          <PluginDetailModal
            plugin={detailLoading ? null : (pluginDetail || null)}
            isInstalled={installedMap.has(selectedPluginId)}
            installedVersion={installedMap.get(selectedPluginId)?.version}
            installedStatus={installedMap.get(selectedPluginId)?.status}
            onClose={() => setSelectedPluginId(null)}
            onInstall={() => {
              const latestVersion = pluginDetail?.latest_version || pluginDetail?.versions?.[0]?.version || '';
              handleInstall(selectedPluginId, latestVersion);
            }}
            onUninstall={installedMap.has(selectedPluginId) ? () => {
              const installed = installedMap.get(selectedPluginId);
              if (installed) {
                setSelectedPluginId(null);
                setUninstallTarget(installed);
              }
            } : undefined}
            onToggleActive={installedMap.has(selectedPluginId) ? () => handleToggleActive(selectedPluginId) : undefined}
            installing={installMutation.isPending}
            toggling={actionLoading === selectedPluginId}
          />
        )}

        {/* Uninstall Confirmation Dialog */}
        {uninstallTarget && (
          <UninstallDialog
            pluginName={uninstallTarget.name}
            onConfirm={handleUninstallConfirm}
            onCancel={() => setUninstallTarget(null)}
          />
        )}
      </div>

      {/* Notification Toast */}
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onDismiss={dismissNotification}
        />
      )}
    </div>
  );
}
