import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, Power, PowerOff, Plus, FolderTree, ChevronRight, ChevronDown } from 'lucide-react';
import Header from '../components/layout/Header';
import { TableRowSkeleton } from '../components/ui/Skeleton';
import { getRules, updateRule, deleteRule, getFAQGroups, createFAQGroup, deleteFAQGroup, createFAQCategory, deleteFAQCategory } from '../services/faqApi';
import { getBotGroups } from '../services/botApi';
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

type TreeSelection = { type: 'all' } | { type: 'group'; id: number } | { type: 'category'; id: number; groupId: number } | { type: 'uncategorized' };

export default function FAQList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [filterReplyMode, setFilterReplyMode] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [treeSelection, setTreeSelection] = useState<TreeSelection>({ type: 'all' });
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState<number | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupBotGroupId, setNewGroupBotGroupId] = useState<number | undefined>();
  const [newCatName, setNewCatName] = useState('');
  const [newCatBotGroupId, setNewCatBotGroupId] = useState<number | undefined>();

  // Build query params based on tree selection
  const ruleParams: Record<string, unknown> = {
    reply_mode: filterReplyMode || undefined,
    is_active: filterStatus === '' ? undefined : filterStatus === 'active',
  };
  if (treeSelection.type === 'category') ruleParams.category_id = treeSelection.id;
  else if (treeSelection.type === 'group') ruleParams.group_id = treeSelection.id;

  const { data: rawRules = [], isLoading } = useQuery({
    queryKey: ['faq-rules', filterReplyMode, filterStatus, treeSelection],
    queryFn: () => getRules(ruleParams as Parameters<typeof getRules>[0]),
    staleTime: 60_000,
  });

  // Client-side filter for "uncategorized"
  const rules = treeSelection.type === 'uncategorized'
    ? rawRules.filter(r => !r.category_id)
    : rawRules;

  const { data: faqGroups = [] } = useQuery({
    queryKey: ['faq-groups'],
    queryFn: getFAQGroups,
    staleTime: 30_000,
  });

  const { data: botGroups = [] } = useQuery({
    queryKey: ['bot-groups'],
    queryFn: getBotGroups,
    staleTime: 30_000,
  });

  const toggleMutation = useMutation({
    mutationFn: (rule: FAQRule) => updateRule(rule.id, { is_active: !rule.is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['faq-rules'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteRule(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['faq-rules'] }),
  });

  const createGroupMutation = useMutation({
    mutationFn: createFAQGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faq-groups'] });
      setShowAddGroup(false);
      setNewGroupName('');
      setNewGroupBotGroupId(undefined);
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: deleteFAQGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faq-groups'] });
      queryClient.invalidateQueries({ queryKey: ['faq-rules'] });
      setTreeSelection({ type: 'all' });
    },
  });

  const createCatMutation = useMutation({
    mutationFn: createFAQCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faq-groups'] });
      setShowAddCategory(null);
      setNewCatName('');
      setNewCatBotGroupId(undefined);
    },
  });

  const deleteCatMutation = useMutation({
    mutationFn: deleteFAQCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faq-groups'] });
      queryClient.invalidateQueries({ queryKey: ['faq-rules'] });
      setTreeSelection({ type: 'all' });
    },
  });

  const handleDelete = useCallback((rule: FAQRule) => {
    if (window.confirm(`Delete rule "${rule.name || `#${rule.id}`}"?`)) {
      deleteMutation.mutate(rule.id);
    }
  }, [deleteMutation]);

  const toggleGroupExpand = (id: number) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectionLabel = (() => {
    if (treeSelection.type === 'all') return 'All Rules';
    if (treeSelection.type === 'uncategorized') return 'Uncategorized';
    if (treeSelection.type === 'group') {
      const g = faqGroups.find(g => g.id === treeSelection.id);
      return g?.name || 'Group';
    }
    if (treeSelection.type === 'category') {
      const g = faqGroups.find(g => g.id === treeSelection.groupId);
      const c = g?.categories.find(c => c.id === treeSelection.id);
      return c ? `${g?.name} / ${c.name}` : 'Category';
    }
    return 'All Rules';
  })();

  return (
    <div className="flex flex-col h-full">
      <Header title="FAQ Rules" />
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Tree navigation */}
        <div className="w-64 border-r border-[#2f2f2f] bg-[#080808] flex flex-col overflow-y-auto shrink-0">
          <div className="p-4 border-b border-[#2f2f2f]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono']">
                FAQ Groups
              </span>
              <button
                onClick={() => setShowAddGroup(true)}
                className="p-1 rounded hover:bg-[#141414] text-[#6a6a6a] hover:text-[#00D9FF] transition-colors"
                title="New Group"
              >
                <Plus size={14} />
              </button>
            </div>

            {/* All rules */}
            <button
              onClick={() => setTreeSelection({ type: 'all' })}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors mb-1 ${
                treeSelection.type === 'all' ? 'bg-[#00D9FF]/10 text-[#00D9FF]' : 'text-[#8a8a8a] hover:bg-[#141414] hover:text-white'
              }`}
            >
              All Rules
            </button>

            {/* Uncategorized */}
            <button
              onClick={() => setTreeSelection({ type: 'uncategorized' })}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors mb-1 ${
                treeSelection.type === 'uncategorized' ? 'bg-[#00D9FF]/10 text-[#00D9FF]' : 'text-[#6a6a6a] hover:bg-[#141414] hover:text-white'
              }`}
            >
              Uncategorized
            </button>
          </div>

          {/* Add group form */}
          {showAddGroup && (
            <div className="p-3 border-b border-[#2f2f2f]">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Group name"
                className="w-full h-8 px-2.5 mb-2 bg-[#141414] border border-[#2f2f2f] rounded text-xs text-white placeholder:text-[#4a4a4a] focus:outline-none focus:border-[#00D9FF]"
                autoFocus
              />
              <select
                value={newGroupBotGroupId ?? ''}
                onChange={(e) => setNewGroupBotGroupId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full h-8 px-2 mb-2 bg-[#141414] border border-[#2f2f2f] rounded text-xs text-white focus:outline-none focus:border-[#00D9FF] appearance-none"
              >
                <option value="">No bot group</option>
                {botGroups.map(bg => <option key={bg.id} value={bg.id}>{bg.name}</option>)}
              </select>
              <div className="flex gap-1.5">
                <button
                  onClick={() => { setShowAddGroup(false); setNewGroupName(''); }}
                  className="flex-1 h-7 text-[10px] text-[#8a8a8a] hover:text-white rounded border border-[#2f2f2f]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => newGroupName.trim() && createGroupMutation.mutate({ name: newGroupName.trim(), bot_group_id: newGroupBotGroupId ?? null })}
                  className="flex-1 h-7 text-[10px] text-black bg-[#00D9FF] rounded font-medium"
                >
                  Create
                </button>
              </div>
            </div>
          )}

          {/* Group tree */}
          <div className="flex-1 p-3 space-y-1">
            {faqGroups.map((group) => {
              const isExpanded = expandedGroups.has(group.id);
              const isGroupSelected = treeSelection.type === 'group' && treeSelection.id === group.id;
              return (
                <div key={group.id}>
                  <div className="flex items-center group">
                    <button
                      onClick={() => toggleGroupExpand(group.id)}
                      className="p-0.5 text-[#6a6a6a]"
                    >
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                    <button
                      onClick={() => setTreeSelection({ type: 'group', id: group.id })}
                      className={`flex-1 text-left px-2 py-1.5 rounded text-sm truncate transition-colors ${
                        isGroupSelected ? 'bg-[#8B5CF6]/10 text-[#8B5CF6]' : 'text-white hover:bg-[#141414]'
                      }`}
                    >
                      <FolderTree size={12} className="inline mr-1.5 opacity-50" />
                      {group.name}
                      {group.bot_group_name && (
                        <span className="ml-1 text-[9px] text-[#8B5CF6] opacity-60">{group.bot_group_name}</span>
                      )}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowAddCategory(group.id); setNewCatName(''); }}
                      className="p-0.5 opacity-0 group-hover:opacity-100 text-[#6a6a6a] hover:text-[#00D9FF] transition-all"
                      title="Add category"
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Delete FAQ group "${group.name}" and unlink all its categories?`))
                          deleteGroupMutation.mutate(group.id);
                      }}
                      className="p-0.5 opacity-0 group-hover:opacity-100 text-[#6a6a6a] hover:text-[#FF4444] transition-all"
                      title="Delete group"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>

                  {/* Add category form */}
                  {showAddCategory === group.id && (
                    <div className="ml-5 mt-1 mb-2 p-2 bg-[#0A0A0A] rounded border border-[#2f2f2f]">
                      <input
                        type="text"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        placeholder="Category name"
                        className="w-full h-7 px-2 mb-1.5 bg-[#141414] border border-[#2f2f2f] rounded text-xs text-white placeholder:text-[#4a4a4a] focus:outline-none focus:border-[#00D9FF]"
                        autoFocus
                      />
                      <select
                        value={newCatBotGroupId ?? ''}
                        onChange={(e) => setNewCatBotGroupId(e.target.value ? Number(e.target.value) : undefined)}
                        className="w-full h-7 px-2 mb-1.5 bg-[#141414] border border-[#2f2f2f] rounded text-xs text-white focus:outline-none focus:border-[#00D9FF] appearance-none"
                      >
                        <option value="">Inherit bot group</option>
                        {botGroups.map(bg => <option key={bg.id} value={bg.id}>{bg.name}</option>)}
                      </select>
                      <div className="flex gap-1">
                        <button onClick={() => setShowAddCategory(null)} className="flex-1 h-6 text-[10px] text-[#8a8a8a] rounded border border-[#2f2f2f]">Cancel</button>
                        <button
                          onClick={() => newCatName.trim() && createCatMutation.mutate({ name: newCatName.trim(), faq_group_id: group.id, bot_group_id: newCatBotGroupId ?? null })}
                          className="flex-1 h-6 text-[10px] text-black bg-[#00D9FF] rounded font-medium"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Categories */}
                  {isExpanded && (
                    <div className="ml-5 space-y-0.5">
                      {group.categories.map(cat => {
                        const isCatSelected = treeSelection.type === 'category' && treeSelection.id === cat.id;
                        return (
                          <div key={cat.id} className="flex items-center group/cat">
                            <button
                              onClick={() => setTreeSelection({ type: 'category', id: cat.id, groupId: group.id })}
                              className={`flex-1 text-left px-2 py-1.5 rounded text-xs truncate transition-colors ${
                                isCatSelected ? 'bg-[#059669]/10 text-[#059669]' : 'text-[#8a8a8a] hover:bg-[#141414] hover:text-white'
                              }`}
                            >
                              {cat.name}
                              {cat.bot_group_name && (
                                <span className="ml-1 text-[9px] text-[#8B5CF6] opacity-60">{cat.bot_group_name}</span>
                              )}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Delete category "${cat.name}"?`))
                                  deleteCatMutation.mutate(cat.id);
                              }}
                              className="p-0.5 opacity-0 group-hover/cat:opacity-100 text-[#6a6a6a] hover:text-[#FF4444] transition-all"
                              title="Delete category"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        );
                      })}
                      {group.categories.length === 0 && (
                        <p className="text-[10px] text-[#4a4a4a] px-2 py-1">No categories</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Rules table */}
        <div className="flex-1 p-8 overflow-auto">
          <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-white">{selectionLabel}</h2>
              <span className="text-xs text-[#6a6a6a]">{rules.length} rule{rules.length !== 1 ? 's' : ''}</span>
              <select
                value={filterReplyMode}
                onChange={(e) => setFilterReplyMode(e.target.value)}
                className="h-9 px-3 bg-[#141414] border border-[#2f2f2f] rounded-lg text-xs text-[#FFFFFF] focus:outline-none focus:border-[#00D9FF] appearance-none cursor-pointer"
              >
                <option value="">All Modes</option>
                {Object.entries(REPLY_MODE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-9 px-3 bg-[#141414] border border-[#2f2f2f] rounded-lg text-xs text-[#FFFFFF] focus:outline-none focus:border-[#00D9FF] appearance-none cursor-pointer"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <button
              onClick={() => navigate('/faq/new')}
              className="px-4 py-2 bg-[#00D9FF] text-black text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
            >
              + New Rule
            </button>
          </div>

          <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1A1A1A]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono']">Rule Name</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono']">Category</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono']">Q</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono']">A</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono']">Reply Mode</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono']">Hits</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono']">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-[#6a6a6a] uppercase tracking-wider font-['JetBrains_Mono']">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={8} />)
                ) : rules.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-[#6a6a6a]">
                      No FAQ rules found.
                    </td>
                  </tr>
                ) : (
                  rules.map((rule) => (
                    <tr key={rule.id} className="border-b border-[#1A1A1A]/50 last:border-0 hover:bg-[#141414]/50 transition-colors">
                      <td className="px-5 py-3.5 text-[#FFFFFF] font-medium text-sm">
                        {rule.name || `Rule #${rule.id}`}
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        {rule.category_name ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[#059669]/10 text-[#059669] font-['JetBrains_Mono']">
                            {rule.faq_group_name && <span className="opacity-60 mr-1">{rule.faq_group_name}/</span>}
                            {rule.category_name}
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#4a4a4a]">&mdash;</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#2563EB]/15 text-[#2563EB] text-[10px] font-medium">
                          {rule.questions.length}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#059669]/15 text-[#059669] text-[10px] font-medium">
                          {rule.answers.length}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#8B5CF6]/15 text-[#8B5CF6] font-mono">
                          {REPLY_MODE_LABELS[rule.reply_mode] || rule.reply_mode}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <span className="font-mono text-[#00D9FF] text-xs">{rule.hit_count}</span>
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <span className={`inline-block w-2 h-2 rounded-full ${rule.is_active ? 'bg-[#059669]' : 'bg-[#4a4a4a]'}`} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => navigate(`/faq/${rule.id}/edit`)}
                            className="p-1.5 rounded hover:bg-[#141414] text-[#8a8a8a] hover:text-[#00D9FF] transition-colors"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => toggleMutation.mutate(rule)}
                            className={`p-1.5 rounded hover:bg-[#141414] transition-colors ${
                              rule.is_active ? 'text-[#059669] hover:text-[#FF8800]' : 'text-[#6a6a6a] hover:text-[#059669]'
                            }`}
                            title={rule.is_active ? 'Disable' : 'Enable'}
                          >
                            {rule.is_active ? <Power size={14} /> : <PowerOff size={14} />}
                          </button>
                          <button
                            onClick={() => handleDelete(rule)}
                            className="p-1.5 rounded hover:bg-[#141414] text-[#8a8a8a] hover:text-[#FF4444] transition-colors"
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
    </div>
  );
}
