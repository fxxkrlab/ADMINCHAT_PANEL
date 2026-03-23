import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, AlertTriangle, Clock, Filter, ChevronDown, ChevronRight } from 'lucide-react';
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

export default function MissedKnowledge() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [newPattern, setNewPattern] = useState('');
  const [newMatchMode, setNewMatchMode] = useState<FilterMatchMode>('exact');
  const [newDescription, setNewDescription] = useState('');

  const { data: keywords = [], isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['missed-keywords'],
    queryFn: getMissedKeywords,
  });

  const { data: filters = [] } = useQuery({
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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['missed-keyword-filters'] }),
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
        {/* Header info */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-[#FF8800]" />
            <p className="text-[#8a8a8a] text-sm">
              Keywords from unmatched user messages. Create FAQ rules to cover
              these topics.
            </p>
          </div>
          {dataUpdatedAt > 0 && (
            <div className="flex items-center gap-1 text-[#6a6a6a] text-xs">
              <Clock size={12} />
              <span>Updated {timeAgo(new Date(dataUpdatedAt).toISOString())}</span>
            </div>
          )}
        </div>

        {/* Keyword Filters Panel */}
        <div className="mb-6">
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#141414] transition-colors text-sm"
          >
            <Filter size={14} className="text-[#8a8a8a]" />
            <span className="text-[#FFFFFF] font-medium">Keyword Filters</span>
            {filters.length > 0 && (
              <span className="px-1.5 py-0.5 rounded text-xs font-mono bg-[#00D9FF]/10 text-[#00D9FF]">
                {filters.length}
              </span>
            )}
            {filtersOpen ? (
              <ChevronDown size={14} className="text-[#6a6a6a]" />
            ) : (
              <ChevronRight size={14} className="text-[#6a6a6a]" />
            )}
          </button>

          {filtersOpen && (
            <div className="mt-2 bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-4 space-y-4">
              {/* Add filter row */}
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
                  className="w-48 px-3 py-2 rounded-md bg-[#141414] border border-[#2f2f2f] text-sm text-white placeholder-[#4a4a4a] focus:outline-none focus:border-[#00D9FF]"
                />
                <button
                  onClick={handleAddFilter}
                  disabled={!newPattern.trim() || createFilterMutation.isPending}
                  className="flex items-center gap-1 px-3 py-2 rounded-md text-xs font-medium bg-[#00D9FF]/10 text-[#00D9FF] hover:bg-[#00D9FF]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus size={14} />
                  Add
                </button>
              </div>

              {createFilterMutation.isError && (
                <p className="text-xs text-[#FF4444]">
                  {(createFilterMutation.error as Error)?.message || 'Failed to create filter'}
                </p>
              )}

              {/* Existing filters */}
              {filters.length > 0 ? (
                <div className="space-y-1.5">
                  {filters.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[#141414]/50 transition-colors group"
                    >
                      <span className="font-['JetBrains_Mono'] text-sm text-white">
                        {f.pattern}
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
                        style={{
                          color: MATCH_MODE_COLORS[f.match_mode] || '#8a8a8a',
                          backgroundColor: `${MATCH_MODE_COLORS[f.match_mode] || '#8a8a8a'}1a`,
                        }}
                      >
                        {f.match_mode}
                      </span>
                      {f.description && (
                        <span className="text-xs text-[#6a6a6a] truncate">
                          {f.description}
                        </span>
                      )}
                      <div className="flex-1" />
                      <button
                        onClick={() => handleDeleteFilter(f.id, f.pattern)}
                        className="p-1 rounded hover:bg-[#141414] text-[#6a6a6a] hover:text-[#FF4444] transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete filter"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#4a4a4a] text-center py-2">
                  No filters configured. Add patterns to auto-skip irrelevant keywords.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1A1A1A]">
                <th className="text-left px-6 py-4 text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono']">Keyword</th>
                <th className="text-center px-6 py-4 text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono']">
                  Occurrences
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono']">
                  Sample Messages
                </th>
                <th className="text-center px-6 py-4 text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono']">
                  Last Seen
                </th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono']">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-[#6a6a6a]"
                  >
                    Loading...
                  </td>
                </tr>
              ) : keywords.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-[#6a6a6a]"
                  >
                    No missed keywords found. Your FAQ coverage looks good!
                  </td>
                </tr>
              ) : (
                keywords.map((kw) => (
                  <tr
                    key={kw.id}
                    className="border-b border-[#1A1A1A]/50 last:border-0 hover:bg-[#141414]/50 transition-colors"
                  >
                    <td className="px-6 py-4.5">
                      <span className="inline-block px-2 py-1 rounded-md bg-[#FF8800]/10 text-[#FF8800] text-sm font-medium">
                        {kw.keyword}
                      </span>
                    </td>
                    <td className="px-6 py-4.5 text-center">
                      <span className="font-mono text-[#00D9FF] font-medium">
                        {kw.occurrence_count}
                      </span>
                    </td>
                    <td className="px-6 py-4.5 text-[#8a8a8a] text-xs max-w-[300px]">
                      {kw.sample_messages && kw.sample_messages.length > 0 ? (
                        <div className="space-y-1">
                          {kw.sample_messages.slice(0, 3).map((msg, idx) => (
                            <div
                              key={idx}
                              className="truncate text-[#6a6a6a]"
                              title={msg}
                            >
                              "{msg}"
                            </div>
                          ))}
                          {kw.sample_messages.length > 3 && (
                            <span className="text-[#4a4a4a]">
                              +{kw.sample_messages.length - 3} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[#4a4a4a]">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4.5 text-center text-[#8a8a8a] text-xs">
                      {formatDate(kw.last_seen_at)}
                    </td>
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
      </div>
    </div>
  );
}
