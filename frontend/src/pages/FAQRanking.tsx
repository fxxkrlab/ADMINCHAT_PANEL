import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import Header from '../components/layout/Header';
import { getRanking } from '../services/faqApi';

type Period = 'today' | 'week' | 'month' | 'all';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
];

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FAQRanking() {
  const [period, setPeriod] = useState<Period>('all');

  const { data: rankings = [], isLoading } = useQuery({
    queryKey: ['faq-ranking', period],
    queryFn: () => getRanking(period),
  });

  const maxHits = Math.max(...rankings.map((r) => r.hit_count), 1);

  return (
    <div className="flex flex-col h-full">
      <Header title="FAQ Ranking" />
      <div className="flex-1 p-8 overflow-auto">
        {/* Period filter */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-accent" />
            <p className="text-text-secondary text-sm">
              FAQ hit statistics ranked by popularity
            </p>
          </div>
          <div className="flex items-center gap-1 bg-bg-card border border-border-subtle rounded-lg p-0.5">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  period === opt.value
                    ? 'bg-accent text-black'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="bg-bg-card border border-border-subtle rounded-xl p-8 text-center text-text-muted text-sm">
            Loading...
          </div>
        ) : rankings.length === 0 ? (
          <div className="bg-bg-card border border-border-subtle rounded-xl p-8 text-center text-text-muted text-sm">
            No FAQ hits recorded for this period.
          </div>
        ) : (
          <>
            {/* Visual bar chart */}
            <div className="bg-bg-card border border-border-subtle rounded-xl p-6 mb-8">
              <h3 className="text-sm font-medium text-text-secondary mb-4">
                Top FAQ Topics
              </h3>
              <div className="space-y-3">
                {rankings.slice(0, 10).map((item, index) => (
                  <div key={item.rule_id} className="flex items-center gap-3">
                    <span className="w-6 text-right text-xs font-mono text-text-muted">
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-text-primary truncate max-w-[60%]">
                          {item.rule_name || `Rule #${item.rule_id}`}
                        </span>
                        <span className="text-xs font-mono text-accent">
                          {item.hit_count}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-bg-elevated rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(item.hit_count / maxHits) * 100}%`,
                            background:
                              index === 0
                                ? '#00D9FF'
                                : index === 1
                                ? '#059669'
                                : index === 2
                                ? '#FF8800'
                                : '#2f2f2f',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Full table */}
            <div className="bg-bg-card border border-border-subtle rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-subtle">
                    <th className="text-center px-6 py-4 w-16 text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono']">
                      Rank
                    </th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono']">
                      Rule / Topic
                    </th>
                    <th className="text-center px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono']">
                      Hit Count
                    </th>
                    <th className="text-center px-6 py-4 text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono']">
                      Last Hit
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((item, index) => (
                    <tr
                      key={item.rule_id}
                      className="border-b border-border-subtle/50 last:border-0 hover:bg-bg-elevated/50 transition-colors"
                    >
                      <td className="px-6 py-4.5 text-center">
                        {index < 3 ? (
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              index === 0
                                ? 'bg-accent/20 text-accent'
                                : index === 1
                                ? 'bg-green/20 text-green'
                                : 'bg-orange/20 text-orange'
                            }`}
                          >
                            {index + 1}
                          </span>
                        ) : (
                          <span className="text-text-muted font-mono text-xs">
                            {index + 1}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4.5 text-text-primary">
                        {item.rule_name || `Rule #${item.rule_id}`}
                      </td>
                      <td className="px-6 py-4.5 text-center">
                        <span className="font-mono text-accent font-medium">
                          {item.hit_count.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4.5 text-center text-text-secondary text-xs">
                        {formatDate(item.last_hit_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
