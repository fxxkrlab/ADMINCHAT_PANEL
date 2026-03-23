import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, AlertTriangle, Clock, Filter, Search } from 'lucide-react';
import Header from '../components/layout/Header';
import {
  getMissedKeywords,
  deleteMissedKeyword,
  getMissedKeywordFilters,
  createMissedKeywordFilter,
  deleteMissedKeywordFilter,
} from '../services/faqApi';
type FilterMatchMode = 'exact' | 'prefix' | 'contains' | 'regex';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

const MATCH_MODE_COLORS: Record<string, string> = {
  exact: '#059669',
  prefix: '#8B5CF6',
  contains: '#00D9FF',
  regex: '#FF8800',
};

const TABS = [
  { key: 'keywords', label: 'Missed Keywords', icon: Search },
  { key: 'filters', label: 'Keyword Filters', icon: Filter },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function MissedKnowledge() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabKey>('keywords');
  const [newPattern, setNewPattern] = useState('');
  const [newMatchMode, setNewMatchMode] = useState<FilterMatchMode>('exact');
  const [newDescription, setNewDescription] = useState('');

  const { data: keywords = [], isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['missed-keywords'],
    queryFn: getMissedKeywords,
  });

  const { data: filters = [], isLoading: filtersLoading } = useQuery({
    queryKey: ['missed-keyword-filters'],
    queryFn: getMissedKeywordFilters,
  });

  const resolveMutation = useMutation({
    mutationFn: (id: number) => deleteMissedKeyword(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['missed-keywords'] }),
  });

  const createFilterMutation = useMutation({
    mutationFn: createMissedKeywordFilter,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missed-keyword-filters'] });
      queryClient.invalidateQueries({ queryKey: ['missed-keywords'] });
      setNewPattern('');
      setNewMatchMode('exact');
      setNewDescription('');
    },
  });

  const deleteFilterMutation = useMutation({
    mutationFn: deleteMissedKeywordFilter,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['missed-keyword-filters'] });
      queryClient.invalidateQueries({ queryKey: ['missed-keywords'] });
    },
  });

  const handleCreateFAQ = (keyword: string) => {
    navigate(`/faq/new?keyword=${encodeURIComponent(keyword)}`);
  };

  const handleDelete = (id: number, keyword: string) => {
    if (window.confirm(`Mark "${keyword}" as resolved?`)) {
      resolveMutation.mutate(id);
    }
  };

  const handleAddFilter = () => {
    if (!newPattern.trim()) return;
    createFilterMutation.mutate({
      pattern: newPattern.trim(),
      match_mode: newMatchMode,
      description: newDescription.trim() || undefined,
    });
  };

  const handleDeleteFilter = (id: number, pattern: string) => {
    if (window.confirm(`Delete filter "${pattern}"?`)) {
      deleteFilterMutation.mutate(id);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Missed Knowledge" />
      <div className="flex-1 p-8 overflow-auto">
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-[#1A1A1A]">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            const count = tab.key === 'filters' ? filters.length : keywords.length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-[#00D9FF] text-[#00D9FF]'
                    : 'border-transparent text-[#6a6a6a] hover:text-[#8a8a8a]'
                }`}
              >
                <Icon size={14} />
                {tab.label}
                {count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                    isActive ? 'bg-[#00D9FF]/10 text-[#00D9FF]' : 'bg-[#141414] text-[#6a6a6a]'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}

          {activeTab === 'keywords' && dataUpdatedAt > 0 && (
            <div className="ml-auto flex items-center gap-1 text-[#6a6a6a] text-xs">
              <Clock size={12} />
              <span>Updated {timeAgo(new Date(dataUpdatedAt).toISOString())}</span>
            </div>
          )}
        </div>

        {/* ---- Tab: Missed Keywords ---- */}
        {activeTab === 'keywords' && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={16} className="text-[#FF8800]" />
              <p className="text-[#8a8a8a] text-xs">
                Keywords from unmatched user messages. Create FAQ rules to cover these topics.
              </p>
            </div>

            <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1A1A1A]">
                    <th className="text-left px-6 py-4 text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono']">Keyword</th>
                    <th className="text-center px-6 py-4 text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono']">Occurrences</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono']">Sample Messages</th>
                    <th className="text-center px-6 py-4 text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono']">Last Seen</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono']">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-[#6a6a6a]">Loading...</td></tr>
                  ) : keywords.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-[#6a6a6a]">No missed keywords found. Your FAQ coverage looks good!</td></tr>
                  ) : (
                    keywords.map((kw) => (
                      <tr key={kw.id} className="border-b border-[#1A1A1A]/50 last:border-0 hover:bg-[#141414]/50 transition-colors">
                        <td className="px-6 py-4.5">
                          <span className="inline-block px-2 py-1 rounded-md bg-[#FF8800]/10 text-[#FF8800] text-sm font-medium">{kw.keyword}</span>
                        </td>
                        <td className="px-6 py-4.5 text-center">
                          <span className="font-mono text-[#00D9FF] font-medium">{kw.occurrence_count}</span>
                        </td>
                        <td className="px-6 py-4.5 text-[#8a8a8a] text-xs max-w-[300px]">
                          {kw.sample_messages && kw.sample_messages.length > 0 ? (
                            <div className="space-y-1">
                              {kw.sample_messages.slice(0, 3).map((msg, idx) => (
                                <div key={idx} className="truncate text-[#6a6a6a]" title={msg}>"{msg}"</div>
                              ))}
                              {kw.sample_messages.length > 3 && (
                                <span className="text-[#4a4a4a]">+{kw.sample_messages.length - 3} more</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[#4a4a4a]">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4.5 text-center text-[#8a8a8a] text-xs">{formatDate(kw.last_seen_at)}</td>
                        <td className="px-6 py-4.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleCreateFAQ(kw.keyword)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-[#00D9FF]/10 text-[#00D9FF] hover:bg-[#00D9FF]/20 transition-colors"
                            >
                              <Plus size={12} />
                              Create FAQ
                            </button>
                            <button
                              onClick={() => handleDelete(kw.id, kw.keyword)}
                              className="p-1.5 rounded hover:bg-[#141414] text-[#8a8a8a] hover:text-[#FF4444] transition-colors"
                              title="Mark as resolved"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ---- Tab: Keyword Filters ---- */}
        {activeTab === 'filters' && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <Filter size={16} className="text-[#8B5CF6]" />
              <p className="text-[#8a8a8a] text-xs">
                Filter patterns to automatically skip irrelevant keywords (e.g. bot commands like /start, /help).
              </p>
            </div>

            {/* Add filter form */}
            <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-5 mb-6">
              <h3 className="text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider mb-3">Add New Filter</h3>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Pattern (e.g. /start)"
                  value={newPattern}
                  onChange={(e) => setNewPattern(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFilter()}
                  className="flex-1 min-w-0 px-3 py-2 rounded-md bg-[#141414] border border-[#2f2f2f] text-sm text-white placeholder-[#4a4a4a] focus:outline-none focus:border-[#00D9FF] font-['JetBrains_Mono']"
                />
                <select
                  value={newMatchMode}
                  onChange={(e) => setNewMatchMode(e.target.value as FilterMatchMode)}
                  className="px-3 py-2 rounded-md bg-[#141414] border border-[#2f2f2f] text-sm text-white focus:outline-none focus:border-[#00D9FF]"
                >
                  <option value="exact">Exact</option>
                  <option value="prefix">Prefix</option>
                  <option value="contains">Contains</option>
                  <option value="regex">Regex</option>
                </select>
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFilter()}
                  className="w-56 px-3 py-2 rounded-md bg-[#141414] border border-[#2f2f2f] text-sm text-white placeholder-[#4a4a4a] focus:outline-none focus:border-[#00D9FF]"
                />
                <button
                  onClick={handleAddFilter}
                  disabled={!newPattern.trim() || createFilterMutation.isPending}
                  className="flex items-center gap-1 px-4 py-2 rounded-md text-xs font-medium bg-[#00D9FF]/10 text-[#00D9FF] hover:bg-[#00D9FF]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus size={14} />
                  Add Filter
                </button>
              </div>
              {createFilterMutation.isError && (
                <p className="text-xs text-[#FF4444] mt-2">
                  {(createFilterMutation.error as Error)?.message || 'Failed to create filter'}
                </p>
              )}
            </div>

            {/* Filter list */}
            <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1A1A1A]">
                    <th className="text-left px-6 py-4 text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono']">Pattern</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono']">Match Mode</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono']">Description</th>
                    <th className="text-center px-6 py-4 text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono']">Created</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono']">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtersLoading ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-[#6a6a6a]">Loading...</td></tr>
                  ) : filters.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center">
                        <Filter size={24} className="text-[#4a4a4a] mx-auto mb-2" />
                        <p className="text-[#6a6a6a] text-sm">No filters configured.</p>
                        <p className="text-[#4a4a4a] text-xs mt-1">Add patterns above to auto-skip irrelevant keywords like /start, /help.</p>
                      </td>
                    </tr>
                  ) : (
                    filters.map((f) => (
                      <tr key={f.id} className="border-b border-[#1A1A1A]/50 last:border-0 hover:bg-[#141414]/50 transition-colors">
                        <td className="px-6 py-4.5">
                          <span className="font-['JetBrains_Mono'] text-sm text-white bg-[#141414] px-2 py-1 rounded-md">
                            {f.pattern}
                          </span>
                        </td>
                        <td className="px-6 py-4.5">
                          <span
                            className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide"
                            style={{
                              color: MATCH_MODE_COLORS[f.match_mode] || '#8a8a8a',
                              backgroundColor: `${MATCH_MODE_COLORS[f.match_mode] || '#8a8a8a'}1a`,
                            }}
                          >
                            {f.match_mode}
                          </span>
                        </td>
                        <td className="px-6 py-4.5 text-[#6a6a6a] text-xs">{f.description || '—'}</td>
                        <td className="px-6 py-4.5 text-center text-[#8a8a8a] text-xs">{formatDate(f.created_at)}</td>
                        <td className="px-6 py-4.5 text-right">
                          <button
                            onClick={() => handleDeleteFilter(f.id, f.pattern)}
                            className="p-1.5 rounded hover:bg-[#141414] text-[#8a8a8a] hover:text-[#FF4444] transition-colors"
                            title="Delete filter"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
