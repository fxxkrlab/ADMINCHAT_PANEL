import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, AlertTriangle, Clock } from 'lucide-react';
import Header from '../components/layout/Header';
import { getMissedKeywords, deleteMissedKeyword } from '../services/faqApi';

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

export default function MissedKnowledge() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: keywords = [], isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['missed-keywords'],
    queryFn: getMissedKeywords,
  });

  const resolveMutation = useMutation({
    mutationFn: (id: number) => deleteMissedKeyword(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['missed-keywords'] }),
  });

  const handleCreateFAQ = (keyword: string) => {
    navigate(`/faq/new?keyword=${encodeURIComponent(keyword)}`);
  };

  const handleDelete = (id: number, keyword: string) => {
    if (window.confirm(`Mark "${keyword}" as resolved?`)) {
      resolveMutation.mutate(id);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Missed Knowledge" />
      <div className="flex-1 p-8 overflow-auto">
        {/* Header info */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-orange" />
            <p className="text-text-secondary text-sm">
              Keywords from unmatched user messages. Create FAQ rules to cover
              these topics.
            </p>
          </div>
          {dataUpdatedAt > 0 && (
            <div className="flex items-center gap-1 text-text-muted text-xs">
              <Clock size={12} />
              <span>Updated {timeAgo(new Date(dataUpdatedAt).toISOString())}</span>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-bg-card border border-border-subtle rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono']">Keyword</th>
                <th className="text-center px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono']">
                  Occurrences
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono']">
                  Sample Messages
                </th>
                <th className="text-center px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono']">
                  Last Seen
                </th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono']">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-text-muted"
                  >
                    Loading...
                  </td>
                </tr>
              ) : keywords.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-text-muted"
                  >
                    No missed keywords found. Your FAQ coverage looks good!
                  </td>
                </tr>
              ) : (
                keywords.map((kw) => (
                  <tr
                    key={kw.id}
                    className="border-b border-border-subtle/50 last:border-0 hover:bg-bg-elevated/50 transition-colors"
                  >
                    <td className="px-6 py-4.5">
                      <span className="inline-block px-2 py-1 rounded-md bg-orange/10 text-orange text-sm font-medium">
                        {kw.keyword}
                      </span>
                    </td>
                    <td className="px-6 py-4.5 text-center">
                      <span className="font-mono text-accent font-medium">
                        {kw.occurrence_count}
                      </span>
                    </td>
                    <td className="px-6 py-4.5 text-text-secondary text-xs max-w-[300px]">
                      {kw.sample_messages && kw.sample_messages.length > 0 ? (
                        <div className="space-y-1">
                          {kw.sample_messages.slice(0, 3).map((msg, idx) => (
                            <div
                              key={idx}
                              className="truncate text-text-muted"
                              title={msg}
                            >
                              "{msg}"
                            </div>
                          ))}
                          {kw.sample_messages.length > 3 && (
                            <span className="text-text-placeholder">
                              +{kw.sample_messages.length - 3} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-text-placeholder">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4.5 text-center text-text-secondary text-xs">
                      {formatDate(kw.last_seen_at)}
                    </td>
                    <td className="px-6 py-4.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleCreateFAQ(kw.keyword)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                        >
                          <Plus size={12} />
                          Create FAQ
                        </button>
                        <button
                          onClick={() => handleDelete(kw.id, kw.keyword)}
                          className="p-1.5 rounded hover:bg-bg-elevated text-text-secondary hover:text-red transition-colors"
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
