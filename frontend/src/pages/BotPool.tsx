import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Play, Square, Pencil, Trash2, Plus, Zap, AlertTriangle, Wifi, WifiOff, X } from 'lucide-react';
import Header from '../components/layout/Header';
import { getBots, createBot, updateBot, deleteBot, restartBot, type BotCreateData, type BotUpdateData } from '../services/botApi';
import type { Bot } from '../types';

// ---- Status badge component ----
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    online: { label: 'ONLINE', color: 'text-green', bg: 'bg-green/10', icon: <Wifi className="w-3 h-3" /> },
    rate_limited: { label: 'LIMITED', color: 'text-orange', bg: 'bg-orange/10', icon: <AlertTriangle className="w-3 h-3" /> },
    offline: { label: 'OFFLINE', color: 'text-red', bg: 'bg-red/10', icon: <WifiOff className="w-3 h-3" /> },
    error: { label: 'ERROR', color: 'text-red', bg: 'bg-red/10', icon: <AlertTriangle className="w-3 h-3" /> },
  };
  const s = map[status] || map.offline;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium ${s.color} ${s.bg}`}>
      {s.icon} {s.label}
    </span>
  );
}

// ---- Priority bar ----
function PriorityBar({ value, max = 10 }: { value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-bg-elevated overflow-hidden">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-text-secondary font-mono">{value}</span>
    </div>
  );
}

export default function BotPool() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBot, setEditingBot] = useState<Bot | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Form state
  const [formToken, setFormToken] = useState('');
  const [formName, setFormName] = useState('');
  const [formPriority, setFormPriority] = useState(0);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editPriority, setEditPriority] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['bots'],
    queryFn: getBots,
    refetchInterval: 15000, // Poll every 15s for status updates
    staleTime: 10_000, // Data fresh for 10s to avoid redundant fetches
  });

  const createMutation = useMutation({
    mutationFn: (body: BotCreateData) => createBot(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] });
      setShowAddForm(false);
      setFormToken('');
      setFormName('');
      setFormPriority(0);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: BotUpdateData }) => updateBot(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] });
      setEditingBot(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteBot(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bots'] });
      setDeleteConfirm(null);
    },
  });

  const restartMutation = useMutation({
    mutationFn: (id: number) => restartBot(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bots'] }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      updateBot(id, { is_active: active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bots'] }),
  });

  const bots = data?.items || [];

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formToken.trim()) return;
    createMutation.mutate({
      token: formToken.trim(),
      display_name: formName.trim() || undefined,
      priority: formPriority,
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBot) return;
    updateMutation.mutate({
      id: editingBot.id,
      body: {
        display_name: editName.trim() || undefined,
        priority: editPriority,
      },
    });
  };

  const startEdit = (bot: Bot) => {
    setEditingBot(bot);
    setEditName(bot.name || '');
    setEditPriority(bot.priority);
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Bot Pool" />
      <div className="flex-1 p-6 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <p className="text-text-secondary text-sm">
            Manage your Telegram bots &middot; {bots.length} bot{bots.length !== 1 ? 's' : ''}
          </p>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-black text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" /> Add Bot
          </button>
        </div>

        {/* Bot table */}
        <div className="bg-bg-card border border-border-subtle rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left text-xs text-text-muted font-medium px-5 py-3">Status</th>
                <th className="text-left text-xs text-text-muted font-medium px-5 py-3">Bot Name</th>
                <th className="text-left text-xs text-text-muted font-medium px-5 py-3">Username</th>
                <th className="text-left text-xs text-text-muted font-medium px-5 py-3">Priority</th>
                <th className="text-left text-xs text-text-muted font-medium px-5 py-3">Messages Today</th>
                <th className="text-right text-xs text-text-muted font-medium px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center text-text-muted text-sm py-12">
                    Loading bots...
                  </td>
                </tr>
              ) : bots.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-text-muted text-sm py-12">
                    No bots configured. Add one to get started.
                  </td>
                </tr>
              ) : (
                bots.map((bot) => (
                  <tr key={bot.id} className="border-b border-border-subtle/50 hover:bg-bg-elevated/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <StatusBadge status={bot.status} />
                      {bot.status === 'rate_limited' && bot.rate_limit_until && (
                        <div className="text-[10px] text-orange mt-1 font-mono">
                          until {new Date(bot.rate_limit_until).toLocaleTimeString()}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-text-primary font-medium">{bot.name}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-accent font-mono">{bot.username}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <PriorityBar value={bot.priority} />
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-text-secondary font-mono">{bot.message_count}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => startEdit(bot)}
                          className="p-1.5 rounded hover:bg-bg-elevated transition-colors text-text-secondary hover:text-text-primary"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => restartMutation.mutate(bot.id)}
                          disabled={!bot.is_active || restartMutation.isPending}
                          className="p-1.5 rounded hover:bg-bg-elevated transition-colors text-text-secondary hover:text-accent disabled:opacity-30"
                          title="Restart"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${restartMutation.isPending ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                          onClick={() => toggleMutation.mutate({ id: bot.id, active: !bot.is_active })}
                          className={`p-1.5 rounded hover:bg-bg-elevated transition-colors ${bot.is_active ? 'text-green hover:text-orange' : 'text-text-muted hover:text-green'}`}
                          title={bot.is_active ? 'Stop' : 'Start'}
                        >
                          {bot.is_active ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(bot.id)}
                          className="p-1.5 rounded hover:bg-red/10 transition-colors text-text-secondary hover:text-red"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Add Bot form */}
        {showAddForm && (
          <div className="mt-6 bg-bg-card border border-border-subtle rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-text-primary">Add New Bot</h3>
              <button onClick={() => setShowAddForm(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs text-text-secondary mb-1.5">Bot Token *</label>
                <input
                  type="text"
                  value={formToken}
                  onChange={(e) => setFormToken(e.target.value)}
                  placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                  className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary placeholder:text-text-placeholder focus:outline-none focus:border-accent font-mono"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-text-secondary mb-1.5">Display Name</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="My Support Bot"
                    className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary placeholder:text-text-placeholder focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1.5">Priority (0-10)</label>
                  <input
                    type="number"
                    value={formPriority}
                    onChange={(e) => setFormPriority(Number(e.target.value))}
                    min={0}
                    max={10}
                    className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-black text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <Zap className="w-4 h-4" />
                  {createMutation.isPending ? 'Adding...' : 'Add Bot'}
                </button>
              </div>
              {createMutation.isError && (
                <p className="text-xs text-red">
                  Failed to add bot: {(createMutation.error as Error)?.message || 'Unknown error'}
                </p>
              )}
            </form>
          </div>
        )}

        {/* Edit modal */}
        {editingBot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-semibold text-text-primary">Edit Bot</h3>
                <button onClick={() => setEditingBot(null)} className="text-text-muted hover:text-text-primary">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs text-text-secondary mb-1.5">Display Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-1.5">Priority (0-10)</label>
                  <input
                    type="number"
                    value={editPriority}
                    onChange={(e) => setEditPriority(Number(e.target.value))}
                    min={0}
                    max={10}
                    className="w-full px-3 py-2 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent font-mono"
                  />
                </div>
                <div className="flex justify-end gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setEditingBot(null)}
                    className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="px-4 py-2 bg-accent text-black text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete confirmation */}
        {deleteConfirm !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Delete Bot</h3>
              <p className="text-sm text-text-secondary mb-5">
                Are you sure you want to permanently delete this bot? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
                >
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
