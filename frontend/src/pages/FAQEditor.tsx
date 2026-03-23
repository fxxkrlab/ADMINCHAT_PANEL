import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Save, ArrowLeft, Trash2, Pencil, Check } from 'lucide-react';
import Header from '../components/layout/Header';
import {
  getQuestions,
  getAnswers,
  getRule,
  createQuestion,
  createAnswer,
  createRule,
  updateRule,
  updateQuestion,
  deleteQuestion,
  deleteAnswer,
  getFAQGroups,
} from '../services/faqApi';
import type { MatchMode, ResponseMode, ReplyMode } from '../types';

const MATCH_MODES: { value: MatchMode; label: string; desc: string }[] = [
  { value: 'exact', label: 'Exact Match', desc: 'Full text must match keyword exactly' },
  { value: 'prefix', label: 'Prefix Match', desc: 'Text must start with keyword' },
  { value: 'contains', label: 'Contains', desc: 'Keyword found anywhere in text' },
  { value: 'regex', label: 'Regex', desc: 'Regular expression pattern matching' },
  { value: 'catch_all', label: 'Catch All', desc: 'Match any message — use as low-priority fallback for RAG' },
];

const RESPONSE_MODES: { value: ResponseMode; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'random', label: 'Random' },
  { value: 'all', label: 'All' },
];

// AI modes: "direct" means disabled (no AI), rest are AI processing modes
const AI_MODES: { value: ReplyMode; label: string; desc: string }[] = [
  { value: 'direct', label: 'Disabled', desc: 'No AI — return preset answer directly' },
  { value: 'ai_polish', label: 'AI Polish', desc: 'Match answer → AI rewrites for natural tone' },
  { value: 'ai_fallback', label: 'AI Fallback', desc: 'Try FAQ first, AI if no match' },
  { value: 'ai_only', label: 'AI Only', desc: 'Send question directly to AI (rate limited)' },
  { value: 'ai_intent', label: 'AI Intent', desc: 'AI classifies intent → routes to FAQ category' },
  { value: 'ai_template', label: 'AI Template', desc: 'Preset template + AI fills dynamic content' },
  { value: 'ai_classify_and_answer', label: 'AI Comprehensive', desc: 'AI answers using FAQ knowledge base' },
  { value: 'rag', label: 'RAG Knowledge Base', desc: 'Vector retrieval + AI synthesized answer' },
];

export default function FAQEditor() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !id;

  // Form state
  const [name, setName] = useState('');
  const [responseMode, setResponseMode] = useState<ResponseMode>('single');
  const [replyMode, setReplyMode] = useState<ReplyMode>('direct');
  const [priority, setPriority] = useState(0);
  const [dailyAiLimit, setDailyAiLimit] = useState<number | ''>('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<number>>(new Set());
  const [selectedAnswerIds, setSelectedAnswerIds] = useState<Set<number>>(new Set());

  // Inline creation state
  const [newQuestionKeyword, setNewQuestionKeyword] = useState('');
  const [newQuestionMode, setNewQuestionMode] = useState<MatchMode>('contains');
  const [showNewQuestion, setShowNewQuestion] = useState(false);
  const [newAnswerContent, setNewAnswerContent] = useState('');
  const [showNewAnswer, setShowNewAnswer] = useState(false);

  // Edit state for questions
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [editingQuestionKeyword, setEditingQuestionKeyword] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const aiEnabled = replyMode !== 'direct';

  // Fetch all questions and answers
  const { data: allQuestions = [], refetch: refetchQuestions } = useQuery({
    queryKey: ['faq-questions'],
    queryFn: getQuestions,
    staleTime: 60_000,
  });

  const { data: allAnswers = [], refetch: refetchAnswers } = useQuery({
    queryKey: ['faq-answers'],
    queryFn: getAnswers,
    staleTime: 60_000,
  });

  const { data: faqGroups = [] } = useQuery({
    queryKey: ['faq-groups'],
    queryFn: getFAQGroups,
    staleTime: 30_000,
  });

  const selectedQuestionArray = useMemo(() => Array.from(selectedQuestionIds), [selectedQuestionIds]);
  const selectedAnswerArray = useMemo(() => Array.from(selectedAnswerIds), [selectedAnswerIds]);

  // Fetch existing rule for edit mode
  const { data: existingRule } = useQuery({
    queryKey: ['faq-rule', id],
    queryFn: () => getRule(Number(id)),
    enabled: !isNew && !!id,
  });

  useEffect(() => {
    const prefillKeyword = searchParams.get('keyword');
    if (prefillKeyword && isNew) {
      setNewQuestionKeyword(prefillKeyword);
      setShowNewQuestion(true);
    }
  }, [searchParams, isNew]);

  useEffect(() => {
    if (existingRule) {
      setName(existingRule.name || '');
      setResponseMode(existingRule.response_mode);
      setReplyMode(existingRule.reply_mode);
      setPriority(existingRule.priority);
      setDailyAiLimit(existingRule.daily_ai_limit ?? '');
      setCategoryId(existingRule.category_id ?? null);
      setSelectedQuestionIds(new Set(existingRule.questions.map((q) => q.id)));
      setSelectedAnswerIds(new Set(existingRule.answers.map((a) => a.id)));
    }
  }, [existingRule]);

  const toggleQuestion = useCallback((qId: number) => {
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId); else next.add(qId);
      return next;
    });
  }, []);

  const toggleAnswer = useCallback((aId: number) => {
    setSelectedAnswerIds((prev) => {
      const next = new Set(prev);
      if (next.has(aId)) next.delete(aId); else next.add(aId);
      return next;
    });
  }, []);

  const createQuestionMutation = useMutation({
    mutationFn: () => createQuestion({
      keyword: newQuestionMode === 'catch_all' ? '*' : newQuestionKeyword,
      match_mode: newQuestionMode,
    }),
    onSuccess: (newQ) => {
      refetchQuestions();
      setSelectedQuestionIds((prev) => new Set([...prev, newQ.id]));
      setNewQuestionKeyword('');
      setShowNewQuestion(false);
    },
  });

  const createAnswerMutation = useMutation({
    mutationFn: () => createAnswer({ content: newAnswerContent, content_type: 'text' }),
    onSuccess: (newA) => {
      refetchAnswers();
      setSelectedAnswerIds((prev) => new Set([...prev, newA.id]));
      setNewAnswerContent('');
      setShowNewAnswer(false);
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: (id: number) => deleteQuestion(id),
    onSuccess: (_, deletedId) => {
      refetchQuestions();
      setSelectedQuestionIds((prev) => {
        const next = new Set(prev);
        next.delete(deletedId);
        return next;
      });
    },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: ({ id, keyword }: { id: number; keyword: string }) =>
      updateQuestion(id, { keyword }),
    onSuccess: () => {
      refetchQuestions();
      setEditingQuestionId(null);
    },
  });

  const deleteAnswerMutation = useMutation({
    mutationFn: (id: number) => deleteAnswer(id),
    onSuccess: (_, deletedId) => {
      refetchAnswers();
      setSelectedAnswerIds((prev) => {
        const next = new Set(prev);
        next.delete(deletedId);
        return next;
      });
    },
  });

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const payload = {
        name: name || undefined,
        question_ids: selectedQuestionArray,
        answer_ids: selectedAnswerArray,
        response_mode: responseMode,
        reply_mode: replyMode,
        priority,
        daily_ai_limit: dailyAiLimit === '' ? undefined : dailyAiLimit,
        category_id: categoryId,
      };

      if (isNew) {
        await createRule(payload as Parameters<typeof createRule>[0]);
      } else {
        await updateRule(Number(id), payload);
      }

      queryClient.invalidateQueries({ queryKey: ['faq-rules'] });
      navigate('/faq');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to save rule';
      setSaveError(msg);
      console.error('Failed to save rule:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Header title={isNew ? 'New FAQ Rule' : `Edit FAQ Rule #${id}`} />
      <div className="flex-1 px-8 py-6 overflow-auto">
        {/* Header row */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/faq')} className="p-2 rounded-md hover:bg-[#141414] text-[#8a8a8a] hover:text-white transition-colors" title="Back">
              <ArrowLeft size={18} />
            </button>
            <h2 className="text-[18px] font-semibold text-white font-['Space_Grotesk']">
              {isNew ? 'New FAQ Rule' : `Edit Rule #${id}`}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/faq')} className="px-4 py-2 rounded-lg text-sm text-[#8a8a8a] border border-[#2f2f2f] hover:text-white hover:bg-[#141414] transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium bg-[#00D9FF] text-black hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center gap-2">
              <Save size={14} />
              {saving ? 'Saving...' : 'Save Rule'}
            </button>
          </div>
        </div>

        {/* Error message */}
        {saveError && (
          <div className="mb-4 px-4 py-3 bg-[#FF4444]/10 border border-[#FF4444]/30 rounded-lg text-sm text-[#FF4444]">
            {saveError}
          </div>
        )}

        {/* Form row 1: Rule Name */}
        <div className="mb-5">
          <label className="block text-[13px] font-medium text-[#8a8a8a] mb-2">Rule Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Pricing Related"
            className="w-full h-10 px-3.5 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-white placeholder:text-[#4a4a4a] focus:outline-none focus:border-[#00D9FF] transition-colors"
          />
        </div>

        {/* Form row 2: Match Mode + AI Mode + Response Mode */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* Match Mode - how keywords are matched */}
          <div className="bg-[#0A0A0A] border border-[#2f2f2f] rounded-[10px] p-4">
            <label className="block text-[13px] font-semibold text-[#00D9FF] mb-1">Match Mode</label>
            <p className="text-[11px] text-[#6a6a6a] mb-3">How keywords are matched against user messages</p>
            <div className="space-y-1.5">
              {MATCH_MODES.map((m) => (
                <label key={m.value} className={`flex items-center gap-2.5 px-3 py-2 rounded-md cursor-pointer transition-colors ${newQuestionMode === m.value ? 'bg-[#00D9FF]/10 border border-[#00D9FF]/30' : 'hover:bg-[#141414] border border-transparent'}`}>
                  <input
                    type="radio"
                    name="matchMode"
                    value={m.value}
                    checked={newQuestionMode === m.value}
                    onChange={() => setNewQuestionMode(m.value)}
                    className="accent-[#00D9FF]"
                  />
                  <div>
                    <span className="text-sm text-white font-medium">{m.label}</span>
                    <p className="text-[10px] text-[#6a6a6a]">{m.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* AI Mode - how AI processes the answer */}
          <div className={`bg-[#0A0A0A] border rounded-[10px] p-4 ${aiEnabled ? 'border-[#8B5CF6]/40' : 'border-[#2f2f2f]'}`}>
            <label className="block text-[13px] font-semibold text-[#8B5CF6] mb-1">AI Mode</label>
            <p className="text-[11px] text-[#6a6a6a] mb-3">Whether AI processes or enhances the reply</p>
            <div className="space-y-1.5">
              {AI_MODES.map((m) => (
                <label key={m.value} className={`flex items-center gap-2.5 px-3 py-2 rounded-md cursor-pointer transition-colors ${replyMode === m.value ? (m.value === 'direct' ? 'bg-[#2f2f2f]/50 border border-[#2f2f2f]' : 'bg-[#8B5CF6]/10 border border-[#8B5CF6]/30') : 'hover:bg-[#141414] border border-transparent'}`}>
                  <input
                    type="radio"
                    name="aiMode"
                    value={m.value}
                    checked={replyMode === m.value}
                    onChange={() => setReplyMode(m.value as ReplyMode)}
                    className="accent-[#8B5CF6]"
                  />
                  <div className="min-w-0">
                    <span className={`text-sm font-medium ${m.value === 'direct' ? 'text-[#8a8a8a]' : 'text-white'}`}>{m.label}</span>
                    <p className="text-[10px] text-[#6a6a6a] truncate">{m.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Response Mode + Priority + AI Limit */}
          <div className="bg-[#0A0A0A] border border-[#2f2f2f] rounded-[10px] p-4">
            <label className="block text-[13px] font-semibold text-[#059669] mb-1">Settings</label>
            <p className="text-[11px] text-[#6a6a6a] mb-3">Response behavior and limits</p>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] text-[#8a8a8a] mb-1.5">Response Mode</label>
                <select
                  value={responseMode}
                  onChange={(e) => setResponseMode(e.target.value as ResponseMode)}
                  className="w-full h-9 px-3 bg-[#141414] border border-[#2f2f2f] rounded-md text-sm text-white focus:outline-none focus:border-[#059669] transition-colors"
                >
                  {RESPONSE_MODES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <p className="text-[10px] text-[#6a6a6a] mt-1">
                  {responseMode === 'single' ? 'Return first matched answer' : responseMode === 'random' ? 'Pick random from matched answers' : 'Return all matched answers'}
                </p>
              </div>

              <div>
                <label className="block text-[11px] text-[#8a8a8a] mb-1.5">Priority</label>
                <input
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  min={0}
                  className="w-full h-9 px-3 bg-[#141414] border border-[#2f2f2f] rounded-md text-sm text-white font-['JetBrains_Mono'] focus:outline-none focus:border-[#059669] transition-colors"
                />
                <p className="text-[10px] text-[#6a6a6a] mt-1">Higher = matched first</p>
              </div>

              <div>
                <label className="block text-[11px] text-[#8a8a8a] mb-1.5">Category</label>
                <select
                  value={categoryId ?? ''}
                  onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full h-9 px-3 bg-[#141414] border border-[#2f2f2f] rounded-md text-sm text-white focus:outline-none focus:border-[#059669] transition-colors appearance-none"
                >
                  <option value="">No category</option>
                  {faqGroups.map((g) => (
                    <optgroup key={g.id} label={g.name}>
                      {g.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.bot_group_name ? ` [${c.bot_group_name}]` : g.bot_group_name ? ` [${g.bot_group_name}]` : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <p className="text-[10px] text-[#6a6a6a] mt-1">Route replies via category's bot group</p>
              </div>

              {aiEnabled && (
                <div>
                  <label className="block text-[11px] text-[#8a8a8a] mb-1.5">AI Daily Limit (per user)</label>
                  <input
                    type="number"
                    value={dailyAiLimit}
                    onChange={(e) => setDailyAiLimit(e.target.value === '' ? '' : Number(e.target.value))}
                    min={0}
                    placeholder="unlimited"
                    className="w-full h-9 px-3 bg-[#141414] border border-[#8B5CF6]/30 rounded-md text-sm text-[#8B5CF6] font-['JetBrains_Mono'] placeholder:text-[#4a4a4a] focus:outline-none focus:border-[#8B5CF6] transition-colors"
                  />
                  <p className="text-[10px] text-[#6a6a6a] mt-1">Max AI replies per user per day</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Flow preview */}
        <div className="mb-6 px-4 py-3 bg-[#141414] border border-[#2f2f2f] rounded-lg">
          <span className="text-[11px] text-[#6a6a6a]">Flow: </span>
          <span className="text-[11px] text-[#00D9FF] font-['JetBrains_Mono']">
            User message → {MATCH_MODES.find(m => m.value === newQuestionMode)?.label || 'Contains'} match
          </span>
          <span className="text-[11px] text-[#6a6a6a]"> → </span>
          <span className="text-[11px] text-[#059669] font-['JetBrains_Mono']">
            {RESPONSE_MODES.find(m => m.value === responseMode)?.label || 'Single'} answer
          </span>
          {aiEnabled && (
            <>
              <span className="text-[11px] text-[#6a6a6a]"> → </span>
              <span className="text-[11px] text-[#8B5CF6] font-['JetBrains_Mono']">
                {AI_MODES.find(m => m.value === replyMode)?.label || 'AI'}
              </span>
            </>
          )}
          <span className="text-[11px] text-[#6a6a6a]"> → Reply to user</span>
        </div>

        {/* Split panel: Questions + Answers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* LEFT - Questions (blue) */}
          <div className="bg-[#0A0A0A] border-2 border-[#2563EB40] rounded-[10px] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2563EB20] flex items-center justify-between">
              <h3 className="text-sm font-medium text-[#2563EB]">Questions / Keywords</h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold font-['JetBrains_Mono'] px-2 py-0.5 rounded bg-[#2563EB]/10 text-[#2563EB]">
                  {selectedQuestionIds.size} items
                </span>
                <button onClick={() => setShowNewQuestion(true)} className="text-[11px] font-medium text-[#2563EB] hover:text-[#2563EB]/80 flex items-center gap-0.5">
                  <Plus size={12} /> Add
                </button>
              </div>
            </div>
            <div className="max-h-[300px] overflow-auto">
              {allQuestions.map((q) => (
                <div key={q.id} className={`flex items-center gap-3 px-4 py-2.5 border-b border-[#1A1A1A] transition-colors hover:bg-[#141414] ${selectedQuestionIds.has(q.id) ? 'bg-[#2563EB]/5' : ''}`}>
                  <input type="checkbox" checked={selectedQuestionIds.has(q.id)} onChange={() => toggleQuestion(q.id)} className="w-4 h-4 rounded accent-[#2563EB] cursor-pointer" />
                  {editingQuestionId === q.id ? (
                    <input
                      type="text"
                      value={editingQuestionKeyword}
                      onChange={(e) => setEditingQuestionKeyword(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && editingQuestionKeyword.trim()) updateQuestionMutation.mutate({ id: q.id, keyword: editingQuestionKeyword }); if (e.key === 'Escape') setEditingQuestionId(null); }}
                      autoFocus
                      className="flex-1 h-7 px-2 bg-[#141414] border border-[#2563EB] rounded text-sm text-white focus:outline-none"
                    />
                  ) : (
                    <span className="flex-1 text-sm text-white truncate cursor-pointer" onClick={() => toggleQuestion(q.id)}>{q.keyword}</span>
                  )}
                  <span className={`text-[10px] font-['JetBrains_Mono'] px-1.5 py-0.5 rounded ${q.match_mode === 'catch_all' ? 'bg-[#FF8800]/10 text-[#FF8800]' : 'bg-[#141414] text-[#6a6a6a]'}`}>{q.match_mode === 'catch_all' ? 'catch all' : q.match_mode}</span>
                  {editingQuestionId === q.id ? (
                    <button onClick={() => updateQuestionMutation.mutate({ id: q.id, keyword: editingQuestionKeyword })} disabled={!editingQuestionKeyword.trim() || updateQuestionMutation.isPending} className="p-1 rounded hover:bg-[#2563EB]/20 text-[#2563EB] disabled:opacity-40" title="Save">
                      <Check size={13} />
                    </button>
                  ) : (
                    <button onClick={() => { setEditingQuestionId(q.id); setEditingQuestionKeyword(q.keyword); }} className="p-1 rounded hover:bg-[#141414] text-[#6a6a6a] hover:text-[#2563EB]" title="Edit keyword">
                      <Pencil size={13} />
                    </button>
                  )}
                  <button onClick={() => { if (confirm(`Delete keyword "${q.keyword}"?`)) deleteQuestionMutation.mutate(q.id); }} disabled={deleteQuestionMutation.isPending} className="p-1 rounded hover:bg-[#FF4444]/10 text-[#6a6a6a] hover:text-[#FF4444] disabled:opacity-40" title="Delete keyword">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {allQuestions.length === 0 && !showNewQuestion && (
                <p className="text-[#6a6a6a] text-xs text-center py-4">No questions yet.</p>
              )}
              {showNewQuestion && (
                <div className="flex items-center gap-2 px-4 py-3 border-t border-[#1A1A1A]">
                  <input
                    type="text"
                    value={newQuestionMode === 'catch_all' ? '*' : newQuestionKeyword}
                    onChange={(e) => setNewQuestionKeyword(e.target.value)}
                    placeholder={newQuestionMode === 'catch_all' ? 'Matches all messages' : 'Keyword...'}
                    disabled={newQuestionMode === 'catch_all'}
                    autoFocus={newQuestionMode !== 'catch_all'}
                    className="flex-1 h-8 px-3 bg-[#141414] border border-[#2f2f2f] rounded text-sm text-white placeholder:text-[#4a4a4a] focus:outline-none focus:border-[#2563EB] disabled:opacity-50 disabled:cursor-not-allowed"
                    onKeyDown={(e) => { if (e.key === 'Enter' && newQuestionKeyword.trim()) createQuestionMutation.mutate(); }}
                  />
                  <select value={newQuestionMode} onChange={(e) => setNewQuestionMode(e.target.value as MatchMode)} className="h-8 px-2 bg-[#141414] border border-[#2f2f2f] rounded text-xs text-white focus:outline-none">
                    {MATCH_MODES.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
                  </select>
                  <button onClick={() => createQuestionMutation.mutate()} disabled={!newQuestionKeyword.trim() || createQuestionMutation.isPending} className="p-1.5 rounded bg-[#2563EB] text-white hover:opacity-90 disabled:opacity-40"><Save size={14} /></button>
                  <button onClick={() => { setShowNewQuestion(false); setNewQuestionKeyword(''); }} className="p-1.5 rounded hover:bg-[#141414] text-[#6a6a6a]"><X size={14} /></button>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT - Answers (green) */}
          <div className="bg-[#0A0A0A] border-2 border-[#05966940] rounded-[10px] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#05966920] flex items-center justify-between">
              <h3 className="text-sm font-medium text-[#059669]">Answers</h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold font-['JetBrains_Mono'] px-2 py-0.5 rounded bg-[#059669]/10 text-[#059669]">
                  {selectedAnswerIds.size} items
                </span>
                <button onClick={() => setShowNewAnswer(true)} className="text-[11px] font-medium text-[#059669] hover:text-[#059669]/80 flex items-center gap-0.5">
                  <Plus size={12} /> Add
                </button>
              </div>
            </div>
            <div className="max-h-[300px] overflow-auto">
              {allAnswers.map((a) => (
                <div key={a.id} className={`flex items-start gap-3 px-4 py-2.5 border-b border-[#1A1A1A] transition-colors hover:bg-[#141414] ${selectedAnswerIds.has(a.id) ? 'bg-[#059669]/5' : ''}`}>
                  <input type="checkbox" checked={selectedAnswerIds.has(a.id)} onChange={() => toggleAnswer(a.id)} className="w-4 h-4 mt-0.5 rounded accent-[#059669] cursor-pointer" />
                  <span className="flex-1 text-sm text-white line-clamp-2 cursor-pointer" onClick={() => toggleAnswer(a.id)}>{a.content}</span>
                  <span className="text-[10px] text-[#6a6a6a] font-['JetBrains_Mono'] px-1.5 py-0.5 rounded bg-[#141414] shrink-0">{a.content_type}</span>
                  <button onClick={() => { if (confirm(`Delete this answer?`)) deleteAnswerMutation.mutate(a.id); }} disabled={deleteAnswerMutation.isPending} className="p-1 rounded hover:bg-[#FF4444]/10 text-[#6a6a6a] hover:text-[#FF4444] disabled:opacity-40 shrink-0 mt-0.5" title="Delete answer">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {allAnswers.length === 0 && !showNewAnswer && (
                <p className="text-[#6a6a6a] text-xs text-center py-4">No answers yet.</p>
              )}
              {showNewAnswer && (
                <div className="flex items-start gap-2 px-4 py-3 border-t border-[#1A1A1A]">
                  <textarea value={newAnswerContent} onChange={(e) => setNewAnswerContent(e.target.value)} placeholder="Answer content..." rows={3} autoFocus
                    className="flex-1 px-3 py-1.5 bg-[#141414] border border-[#2f2f2f] rounded text-sm text-white placeholder:text-[#4a4a4a] focus:outline-none focus:border-[#059669] resize-none" />
                  <div className="flex flex-col gap-1">
                    <button onClick={() => createAnswerMutation.mutate()} disabled={!newAnswerContent.trim() || createAnswerMutation.isPending} className="p-1.5 rounded bg-[#059669] text-white hover:opacity-90 disabled:opacity-40"><Save size={14} /></button>
                    <button onClick={() => { setShowNewAnswer(false); setNewAnswerContent(''); }} className="p-1.5 rounded hover:bg-[#141414] text-[#6a6a6a]"><X size={14} /></button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
