import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, Power, PowerOff } from 'lucide-react';
import Header from '../components/layout/Header';
import { TableRowSkeleton } from '../components/ui/Skeleton';
import { getRules, updateRule, deleteRule } from '../services/faqApi';
import type { FAQRule } from '../types';

const REPLY_MODE_LABELS: Record<string, string> = {
  direct: 'Direct',
  ai_only: 'AI Only',
  ai_polish: 'AI Polish',
  ai_fallback: 'AI Fallback',
  ai_intent: 'AI Intent',
  ai_template: 'AI Template',
  rag: 'RAG',
  ai_classify_and_answer: 'AI Classify',
};

const RESPONSE_MODE_LABELS: Record<string, string> = {
  single: 'Single',
  random: 'Random',
  all: 'All',
};

export default function FAQList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [filterReplyMode, setFilterReplyMode] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['faq-rules', filterReplyMode, filterStatus],
    queryFn: () =>
      getRules({
        reply_mode: filterReplyMode || undefined,
        is_active: filterStatus === '' ? undefined : filterStatus === 'active',
      }),
    staleTime: 60_000,
  });

  const toggleMutation = useMutation({
    mutationFn: (rule: FAQRule) =>
      updateRule(rule.id, { is_active: !rule.is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['faq-rules'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteRule(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['faq-rules'] }),
  });

  const handleDelete = useCallback((rule: FAQRule) => {
    if (window.confirm(`Delete rule "${rule.name || `#${rule.id}`}"?`)) {
      deleteMutation.mutate(rule.id);
    }
  }, [deleteMutation]);

  return (
    <div className="flex flex-col h-full">
      <Header title="FAQ Rules" />
      <div className="flex-1 p-6 overflow-auto">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <p className="text-text-secondary text-sm">
              Manage FAQ rules and auto-replies
            </p>
            {/* Filters */}
            <select
              value={filterReplyMode}
              onChange={(e) => setFilterReplyMode(e.target.value)}
              className="h-10 px-3.5 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer"
            >
              <option value="">All Modes</option>
              {Object.entries(REPLY_MODE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-10 px-3.5 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <button
            onClick={() => navigate('/faq/new')}
            className="px-4 py-2 bg-accent text-black text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            + New Rule
          </button>
        </div>

        {/* Table */}
        <div className="bg-bg-card border border-border-subtle rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono']">Rule Name</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono']">Questions</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono']">Answers</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono']">Response</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono']">Reply Mode</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono']">Priority</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono']">Hits</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono']">Status</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono']">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRowSkeleton key={i} cols={9} />
                  ))}
                </>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-text-muted">
                    No FAQ rules found. Create your first rule to get started.
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr
                    key={rule.id}
                    className="border-b border-border-subtle/50 last:border-0 hover:bg-bg-elevated/50 transition-colors"
                  >
                    <td className="px-5 py-3.5 text-text-primary font-medium">
                      {rule.name || `Rule #${rule.id}`}
                    </td>
                    <td className="px-5 py-3.5 text-center text-text-secondary">
                      <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-[#2563EB]/15 text-[#2563EB] text-xs font-medium">
                        {rule.questions.length}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center text-text-secondary">
                      <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-green/15 text-green text-xs font-medium">
                        {rule.answers.length}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center text-text-secondary text-xs">
                      {RESPONSE_MODE_LABELS[rule.response_mode] || rule.response_mode}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple/15 text-purple font-mono">
                        {REPLY_MODE_LABELS[rule.reply_mode] || rule.reply_mode}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center text-text-secondary font-mono text-xs">
                      {rule.priority}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="font-mono text-accent text-xs">
                        {rule.hit_count}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          rule.is_active ? 'bg-green' : 'bg-text-muted'
                        }`}
                      />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/faq/${rule.id}/edit`)}
                          className="p-1.5 rounded hover:bg-bg-elevated text-text-secondary hover:text-accent transition-colors"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => toggleMutation.mutate(rule)}
                          className={`p-1.5 rounded hover:bg-bg-elevated transition-colors ${
                            rule.is_active
                              ? 'text-green hover:text-orange'
                              : 'text-text-muted hover:text-green'
                          }`}
                          title={rule.is_active ? 'Disable' : 'Enable'}
                        >
                          {rule.is_active ? <Power size={14} /> : <PowerOff size={14} />}
                        </button>
                        <button
                          onClick={() => handleDelete(rule)}
                          className="p-1.5 rounded hover:bg-bg-elevated text-text-secondary hover:text-red transition-colors"
                          title="Delete"
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
