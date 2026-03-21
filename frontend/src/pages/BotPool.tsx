import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Play, Square, Pencil, Trash2, Plus, Zap, AlertTriangle, Wifi, WifiOff, X } from 'lucide-react';
import Header from '../components/layout/Header';
import { getBots, createBot, updateBot, deleteBot, restartBot, type BotCreateData, type BotUpdateData } from '../services/botApi';
import type { Bot } from '../types';

// ---- Status badge component ----
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; dotColor: string; textColor: string; bgColor: string }> = {
    online: { label: 'ONLINE', dotColor: 'bg-green', textColor: 'text-green', bgColor: 'bg-green/10' },
    rate_limited: { label: 'LIMITED', dotColor: 'bg-orange', textColor: 'text-orange', bgColor: 'bg-orange/10' },
    offline: { label: 'OFFLINE', dotColor: 'bg-red', textColor: 'text-red', bgColor: 'bg-red/10' },
    error: { label: 'ERROR', dotColor: 'bg-red', textColor: 'text-red', bgColor: 'bg-red/10' },
  };
  const s = map[status] || map.offline;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold font-['JetBrains_Mono'] ${s.textColor} ${s.bgColor}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dotColor}`} />
      {s.label}
    </span>
  );
}

// ---- Priority bar ----
function PriorityBar({ value, max = 10 }: { value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct > 60 ? 'bg-green' : pct > 30 ? 'bg-orange' : 'bg-red';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-[#141414] overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-[#8a8a8a] font-['JetBrains_Mono']">{value}</span>
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
    refetchInterval: 15000,
    staleTime: 10_000,
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
      <div className="flex-1 px-8 py-6 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <p className="text-[#8a8a8a] text-sm">
            Manage your Telegram bots &middot; {bots.length} bot{bots.length !== 1 ? 's' : ''}
          </p>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-black text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" /> Add Bot
          </button>
        </div>

        {/* Add Bot form */}
        {showAddForm && (
          <div className="mb-6 bg-[#0A0A0A] border border-[#00D9FF30] rounded-[10px] p-5">
            <form onSubmit={handleAddSubmit} className="flex items-end gap-4">
              <div className="flex-1">
                <label className="block text-[13px] font-medium text-[#8a8a8a] mb-2 font-['Inter']">Bot Token *</label>
                <input
                  type="text"
                  value={formToken}
                  onChange={(e) => setFormToken(e.target.value)}
                  placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                  className="w-full h-10 px-3.5 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-white placeholder:text-[#4a4a4a] focus:outline-none focus:border-accent transition-colors font-['JetBrains_Mono']"
                  required
                />
              </div>
              <div className="w-48">
                <label className="block text-[13px] font-medium text-[#8a8a8a] mb-2 font-['Inter']">Display Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="My Support Bot"
                  className="w-full h-10 px-3.5 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-white placeholder:text-[#4a4a4a] focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              <div className="w-28">
                <label className="block text-[13px] font-medium text-[#8a8a8a] mb-2 font-['Inter']">Priority</label>
                <input
                  type="number"
                  value={formPriority}
                  onChange={(e) => setFormPriority(Number(e.target.value))}
                  min={0}
                  max={10}
                  className="w-full h-10 px-3.5 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-white focus:outline-none focus:border-accent transition-colors font-['JetBrains_Mono']"
                />
              </div>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="inline-flex items-center gap-2 h-10 px-4 bg-accent text-black text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
              >
                <Plus className="w-4 h-4" />
                {createMutation.isPending ? 'Adding...' : 'Add Bot'}
              </button>
            </form>
            {createMutation.isError && (
              <p className="text-xs text-red mt-3">
                Failed to add bot: {(createMutation.error as Error)?.message || 'Unknown error'}
              </p>
            )}
          </div>
        )}

        {/* Bot table */}
        <div className="bg-[#0A0A0A] border border-[#2f2f2f] rounded-[10px] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2f2f2f]">
                <th className="text-left text-[11px] font-semibold text-[#6a6a6a] uppercase tracking-[0.5px] font-['JetBrains_Mono'] px-5 py-3">Status</th>
                <th className="text-left text-[11px] font-semibold text-[#6a6a6a] uppercase tracking-[0.5px] font-['JetBrains_Mono'] px-5 py-3">Bot Name</th>
                <th className="text-left text-[11px] font-semibold text-[#6a6a6a] uppercase tracking-[0.5px] font-['JetBrains_Mono'] px-5 py-3">Username</th>
                <th className="text-left text-[11px] font-semibold text-[#6a6a6a] uppercase tracking-[0.5px] font-['JetBrains_Mono'] px-5 py-3">Priority</th>
                <th className="text-left text-[11px] font-semibold text-[#6a6a6a] uppercase tracking-[0.5px] font-['JetBrains_Mono'] px-5 py-3">Msgs Today</th>
                <th className="text-right text-[11px] font-semibold text-[#6a6a6a] uppercase tracking-[0.5px] font-['JetBrains_Mono'] px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center text-[#6a6a6a] text-sm py-12">
                    Loading bots...
                  </td>
                </tr>
              ) : bots.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-[#6a6a6a] text-sm py-12">
                    No bots configured. Add one to get started.
                  </td>
                </tr>
              ) : (
                bots.map((bot) => (
                  <tr key={bot.id} className="border-b border-[#1A1A1A] hover:bg-[#141414]/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <StatusBadge status={bot.status} />
                      {bot.status === 'rate_limited' && bot.rate_limit_until && (
                        <div className="text-[10px] text-orange mt-1 font-['JetBrains_Mono']">
                          until {new Date(bot.rate_limit_until).toLocaleTimeString()}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[14px] text-white font-medium">{bot.name}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[13px] text-accent font-['JetBrains_Mono']">@{bot.username}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <PriorityBar value={bot.priority} />
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-[#8a8a8a] font-['JetBrains_Mono']">{bot.message_count}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => startEdit(bot)}
                          className="px-3 py-1 rounded-md text-xs font-medium text-[#8a8a8a] border border-[#2f2f2f] hover:bg-[#141414] hover:text-white transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => restartMutation.mutate(bot.id)}
                          disabled={!bot.is_active || restartMutation.isPending}
                          className="px-3 py-1 rounded-md text-xs font-medium text-[#8a8a8a] border border-[#2f2f2f] hover:bg-[#141414] hover:text-white transition-colors disabled:opacity-30"
                        >
                          Restart
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Edit modal */}
        {editingBot && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-[#0C0C0C] border border-[#2f2f2f] rounded-[10px] p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-semibold text-white">Edit Bot</h3>
                <button onClick={() => setEditingBot(null)} className="text-[#6a6a6a] hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-[13px] font-medium text-[#8a8a8a] mb-2">Display Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full h-10 px-3.5 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-white focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#8a8a8a] mb-2">Priority (0-10)</label>
                  <input
                    type="number"
                    value={editPriority}
                    onChange={(e) => setEditPriority(Number(e.target.value))}
                    min={0}
                    max={10}
                    className="w-full h-10 px-3.5 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-white focus:outline-none focus:border-accent transition-colors font-['JetBrains_Mono']"
                  />
                </div>
                <div className="flex justify-end gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setEditingBot(null)}
                    className="px-4 py-2 text-sm text-[#8a8a8a] hover:text-white"
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
            <div className="bg-[#0C0C0C] border border-[#2f2f2f] rounded-[10px] p-6 w-full max-w-sm shadow-2xl">
              <h3 className="text-sm font-semibold text-white mb-3">Delete Bot</h3>
              <p className="text-sm text-[#8a8a8a] mb-5">
                Are you sure you want to permanently delete this bot? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-sm text-[#8a8a8a] hover:text-white"
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
