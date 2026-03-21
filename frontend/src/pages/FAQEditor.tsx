import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Save, ArrowLeft } from 'lucide-react';
import Header from '../components/layout/Header';
import {
  getQuestions,
  getAnswers,
  getRule,
  createQuestion,
  createAnswer,
  createRule,
  updateRule,
} from '../services/faqApi';
import type { MatchMode, ResponseMode, ReplyMode } from '../types';

const MATCH_MODES: { value: MatchMode; label: string }[] = [
  { value: 'exact', label: 'Exact' },
  { value: 'prefix', label: 'Prefix' },
  { value: 'contains', label: 'Contains' },
  { value: 'regex', label: 'Regex' },
];

const RESPONSE_MODES: { value: ResponseMode; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'random', label: 'Random' },
  { value: 'all', label: 'All' },
];

const REPLY_MODES: { value: ReplyMode; label: string }[] = [
  { value: 'direct', label: 'Direct (keyword match)' },
  { value: 'ai_only', label: 'AI Only' },
  { value: 'ai_polish', label: 'AI Polish' },
  { value: 'ai_fallback', label: 'AI Fallback' },
  { value: 'ai_intent', label: 'AI Intent' },
  { value: 'ai_template', label: 'AI Template' },
  { value: 'rag', label: 'RAG (reserved)' },
  { value: 'ai_classify_and_answer', label: 'AI Classify & Answer' },
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
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<number>>(new Set());
  const [selectedAnswerIds, setSelectedAnswerIds] = useState<Set<number>>(new Set());

  // Inline creation state
  const [newQuestionKeyword, setNewQuestionKeyword] = useState('');
  const [newQuestionMode, setNewQuestionMode] = useState<MatchMode>('contains');
  const [showNewQuestion, setShowNewQuestion] = useState(false);
  const [newAnswerContent, setNewAnswerContent] = useState('');
  const [showNewAnswer, setShowNewAnswer] = useState(false);

  const [saving, setSaving] = useState(false);

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

  // Memoize selected question/answer ID arrays for stable references
  const selectedQuestionArray = useMemo(() => Array.from(selectedQuestionIds), [selectedQuestionIds]);
  const selectedAnswerArray = useMemo(() => Array.from(selectedAnswerIds), [selectedAnswerIds]);

  // Fetch existing rule for edit mode
  const { data: existingRule } = useQuery({
    queryKey: ['faq-rule', id],
    queryFn: () => getRule(Number(id)),
    enabled: !isNew && !!id,
  });

  // Pre-fill from search params (e.g. from MissedKnowledge page)
  useEffect(() => {
    const prefillKeyword = searchParams.get('keyword');
    if (prefillKeyword && isNew) {
      setNewQuestionKeyword(prefillKeyword);
      setShowNewQuestion(true);
    }
  }, [searchParams, isNew]);

  // Populate form when editing
  useEffect(() => {
    if (existingRule) {
      setName(existingRule.name || '');
      setResponseMode(existingRule.response_mode);
      setReplyMode(existingRule.reply_mode);
      setPriority(existingRule.priority);
      setDailyAiLimit(existingRule.daily_ai_limit ?? '');
      setSelectedQuestionIds(new Set(existingRule.questions.map((q) => q.id)));
      setSelectedAnswerIds(new Set(existingRule.answers.map((a) => a.id)));
    }
  }, [existingRule]);

  // Toggle helpers
  const toggleQuestion = useCallback((qId: number) => {
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      return next;
    });
  }, []);

  const toggleAnswer = useCallback((aId: number) => {
    setSelectedAnswerIds((prev) => {
      const next = new Set(prev);
      if (next.has(aId)) next.delete(aId);
      else next.add(aId);
      return next;
    });
  }, []);

  // Create new question inline
  const createQuestionMutation = useMutation({
    mutationFn: () =>
      createQuestion({
        keyword: newQuestionKeyword,
        match_mode: newQuestionMode,
      }),
    onSuccess: (newQ) => {
      refetchQuestions();
      setSelectedQuestionIds((prev) => new Set([...prev, newQ.id]));
      setNewQuestionKeyword('');
      setShowNewQuestion(false);
    },
  });

  // Create new answer inline
  const createAnswerMutation = useMutation({
    mutationFn: () =>
      createAnswer({
        content: newAnswerContent,
        content_type: 'text',
      }),
    onSuccess: (newA) => {
      refetchAnswers();
      setSelectedAnswerIds((prev) => new Set([...prev, newA.id]));
      setNewAnswerContent('');
      setShowNewAnswer(false);
    },
  });

  // Save rule
  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: name || undefined,
        question_ids: selectedQuestionArray,
        answer_ids: selectedAnswerArray,
        response_mode: responseMode,
        reply_mode: replyMode,
        priority,
        daily_ai_limit: dailyAiLimit === '' ? undefined : dailyAiLimit,
      };

      if (isNew) {
        await createRule(payload as Parameters<typeof createRule>[0]);
      } else {
        await updateRule(Number(id), payload);
      }

      queryClient.invalidateQueries({ queryKey: ['faq-rules'] });
      navigate('/faq');
    } catch (err) {
      console.error('Failed to save rule:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Header title={isNew ? 'New FAQ Rule' : `Edit FAQ Rule #${id}`} />
      <div className="flex-1 px-8 py-6 overflow-auto">
        {/* Header row: back + title + Cancel + Save */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/faq')}
              className="p-2 rounded-md hover:bg-[#141414] text-[#8a8a8a] hover:text-white transition-colors"
              title="Back"
            >
              <ArrowLeft size={18} />
            </button>
            <h2 className="text-[18px] font-semibold text-white font-['Space_Grotesk']">
              {isNew ? 'New FAQ Rule' : `Edit Rule #${id}`}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/faq')}
              className="px-4 py-2 rounded-lg text-sm text-[#8a8a8a] border border-[#2f2f2f] hover:text-white hover:bg-[#141414] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#00D9FF] text-black hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {saving ? 'Saving...' : 'Save Rule'}
            </button>
          </div>
        </div>

        {/* Form row: Rule Name + Match Mode + Reply Mode */}
        <div className="flex items-end gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-[13px] font-medium text-[#8a8a8a] mb-2 font-['Inter']">Rule Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Rule name..."
              className="w-full h-10 px-3.5 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-white placeholder:text-[#4a4a4a] focus:outline-none focus:border-[#00D9FF] transition-colors"
            />
          </div>
          <div className="w-44">
            <label className="block text-[13px] font-medium text-[#8a8a8a] mb-2 font-['Inter']">Match Mode</label>
            <select
              value={replyMode}
              onChange={(e) => setReplyMode(e.target.value as ReplyMode)}
              className="w-full h-10 px-3.5 bg-[#141414] border border-[#2f2f2f] rounded-lg text-sm text-white focus:outline-none focus:border-[#00D9FF] transition-colors"
            >
              {REPLY_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="w-44">
            <label className="block text-[13px] font-medium text-[#8a8a8a] mb-2 font-['Inter']">Reply Mode</label>
            <select
              value={responseMode}
              onChange={(e) => setResponseMode(e.target.value as ResponseMode)}
              className="w-full h-10 px-3.5 bg-[#141414] border border-[#00D9FF]/30 rounded-lg text-sm text-[#00D9FF] focus:outline-none focus:border-[#00D9FF] transition-colors"
            >
              {RESPONSE_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Split panel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* LEFT - Questions (blue border) */}
          <div className="bg-[#0A0A0A] border-2 border-[#2563EB40] rounded-[10px] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2563EB20] flex items-center justify-between">
              <h3 className="text-sm font-medium text-[#2563EB]">
                Questions / Keywords
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold font-['JetBrains_Mono'] px-2 py-0.5 rounded bg-[#2563EB]/10 text-[#2563EB]">
                  {selectedQuestionIds.size} items
                </span>
                <button
                  onClick={() => setShowNewQuestion(true)}
                  className="text-[11px] font-medium text-[#2563EB] hover:text-[#2563EB]/80 flex items-center gap-0.5"
                >
                  <Plus size={12} /> Add
                </button>
              </div>
            </div>
            <div className="max-h-[400px] overflow-auto">
              {allQuestions.map((q) => (
                <label
                  key={q.id}
                  className={`flex items-center gap-3 px-4 py-2.5 border-b border-[#1A1A1A] cursor-pointer transition-colors hover:bg-[#141414] ${
                    selectedQuestionIds.has(q.id) ? 'bg-[#2563EB]/5' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedQuestionIds.has(q.id)}
                    onChange={() => toggleQuestion(q.id)}
                    className="w-4 h-4 rounded accent-[#2563EB]"
                  />
                  <span className="flex-1 text-sm text-white truncate">
                    {q.keyword}
                  </span>
                  <span className="text-[10px] text-[#6a6a6a] font-['JetBrains_Mono'] px-1.5 py-0.5 rounded bg-[#141414]">
                    {q.match_mode}
                  </span>
                </label>
              ))}

              {allQuestions.length === 0 && !showNewQuestion && (
                <p className="text-[#6a6a6a] text-xs text-center py-4">
                  No questions yet. Add one below.
                </p>
              )}

              {/* Inline new question form */}
              {showNewQuestion && (
                <div className="flex items-center gap-2 px-4 py-3 border-t border-[#1A1A1A]">
                  <input
                    type="text"
                    value={newQuestionKeyword}
                    onChange={(e) => setNewQuestionKeyword(e.target.value)}
                    placeholder="Keyword..."
                    className="flex-1 h-8 px-3 bg-[#141414] border border-[#2f2f2f] rounded text-sm text-white placeholder:text-[#4a4a4a] focus:outline-none focus:border-[#2563EB]"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newQuestionKeyword.trim()) {
                        createQuestionMutation.mutate();
                      }
                    }}
                  />
                  <select
                    value={newQuestionMode}
                    onChange={(e) => setNewQuestionMode(e.target.value as MatchMode)}
                    className="h-8 px-2 bg-[#141414] border border-[#2f2f2f] rounded text-xs text-white focus:outline-none"
                  >
                    {MATCH_MODES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => createQuestionMutation.mutate()}
                    disabled={
                      !newQuestionKeyword.trim() ||
                      createQuestionMutation.isPending
                    }
                    className="p-1.5 rounded bg-[#2563EB] text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
                  >
                    <Save size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setShowNewQuestion(false);
                      setNewQuestionKeyword('');
                    }}
                    className="p-1.5 rounded hover:bg-[#141414] text-[#6a6a6a]"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT - Answers (green border) */}
          <div className="bg-[#0A0A0A] border-2 border-[#05966940] rounded-[10px] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#05966920] flex items-center justify-between">
              <h3 className="text-sm font-medium text-[#059669]">Answers</h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold font-['JetBrains_Mono'] px-2 py-0.5 rounded bg-[#059669]/10 text-[#059669]">
                  {selectedAnswerIds.size} items
                </span>
                <button
                  onClick={() => setShowNewAnswer(true)}
                  className="text-[11px] font-medium text-[#059669] hover:text-[#059669]/80 flex items-center gap-0.5"
                >
                  <Plus size={12} /> Add
                </button>
              </div>
            </div>
            <div className="max-h-[400px] overflow-auto">
              {allAnswers.map((a) => (
                <label
                  key={a.id}
                  className={`flex items-start gap-3 px-4 py-2.5 border-b border-[#1A1A1A] cursor-pointer transition-colors hover:bg-[#141414] ${
                    selectedAnswerIds.has(a.id) ? 'bg-green/5' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedAnswerIds.has(a.id)}
                    onChange={() => toggleAnswer(a.id)}
                    className="w-4 h-4 mt-0.5 rounded accent-green"
                  />
                  <span className="flex-1 text-sm text-white line-clamp-2">
                    {a.content}
                  </span>
                  <span className="text-[10px] text-[#6a6a6a] font-['JetBrains_Mono'] px-1.5 py-0.5 rounded bg-[#141414] shrink-0">
                    {a.content_type}
                  </span>
                </label>
              ))}

              {allAnswers.length === 0 && !showNewAnswer && (
                <p className="text-[#6a6a6a] text-xs text-center py-4">
                  No answers yet. Add one below.
                </p>
              )}

              {/* Inline new answer form */}
              {showNewAnswer && (
                <div className="flex items-start gap-2 px-4 py-3 border-t border-[#1A1A1A]">
                  <textarea
                    value={newAnswerContent}
                    onChange={(e) => setNewAnswerContent(e.target.value)}
                    placeholder="Answer content..."
                    rows={3}
                    className="flex-1 px-3 py-1.5 bg-[#141414] border border-[#2f2f2f] rounded text-sm text-white placeholder:text-[#4a4a4a] focus:outline-none focus:border-green resize-none"
                    autoFocus
                  />
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => createAnswerMutation.mutate()}
                      disabled={
                        !newAnswerContent.trim() ||
                        createAnswerMutation.isPending
                      }
                      className="p-1.5 rounded bg-[#059669] text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
                    >
                      <Save size={14} />
                    </button>
                    <button
                      onClick={() => {
                        setShowNewAnswer(false);
                        setNewAnswerContent('');
                      }}
                      className="p-1.5 rounded hover:bg-[#141414] text-[#6a6a6a]"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom settings */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-[#6a6a6a]">Response:</span>
            <select
              value={responseMode}
              onChange={(e) => setResponseMode(e.target.value as ResponseMode)}
              className="h-8 px-3 bg-[#141414] border border-[#2f2f2f] rounded-md text-sm text-white focus:outline-none focus:border-[#00D9FF] transition-colors"
            >
              {RESPONSE_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#6a6a6a]">Priority:</span>
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              min={0}
              className="w-16 h-8 px-3 bg-[#141414] border border-[#2f2f2f] rounded-md text-sm text-white font-['JetBrains_Mono'] focus:outline-none focus:border-[#00D9FF] transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#6a6a6a]">AI Limit:</span>
            <span className="text-[#00D9FF] font-['JetBrains_Mono'] text-sm">
              {dailyAiLimit === '' ? 'unlimited' : `${dailyAiLimit}/day`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
