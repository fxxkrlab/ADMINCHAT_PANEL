import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, MessageSquare, CheckCircle, AlertCircle, ShieldBan } from 'lucide-react';
import Header from '../components/layout/Header';
import { StatCardSkeleton, DashboardPanelSkeleton } from '../components/ui/Skeleton';
import { getDashboardStats } from '../services/usersApi';
import type { DashboardStatsData } from '../services/usersApi';

function TrendBadge({ value }: { value: number }) {
  if (value === 0) return null;
  const isUp = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold font-['JetBrains_Mono'] ${isUp ? 'text-green' : 'text-red'}`}>
      {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {isUp ? '+' : ''}{value}%
    </span>
  );
}

function StatCard({ label, value, icon: Icon, color, trend }: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  trend?: number;
}) {
  return (
    <div className="bg-[#0A0A0A] border border-[#2f2f2f] rounded-[10px] p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={18} className={color} />
        <span className="text-[13px] text-[#8a8a8a] font-['Inter'] font-medium">{label}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className={`text-[32px] font-bold font-['Space_Grotesk'] leading-none ${color}`}>
          {value.toLocaleString()}
        </span>
        {trend !== undefined && <TrendBadge value={trend} />}
      </div>
    </div>
  );
}

function BotStatusDot({ status }: { status: string }) {
  const color = status === 'online' ? 'bg-green' : status === 'limited' ? 'bg-orange' : 'bg-red';
  return <div className={`w-2 h-2 rounded-full ${color} shrink-0`} />;
}

function BotStatusBadge({ status, remaining }: { status: string; remaining?: number | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    online: { label: 'ONLINE', cls: 'text-green bg-green/10' },
    limited: { label: 'LIMITED', cls: 'text-orange bg-orange/10' },
    offline: { label: 'OFFLINE', cls: 'text-red bg-red/10' },
  };
  const s = map[status] ?? map.offline;
  return (
    <span className={`text-[10px] font-semibold font-['JetBrains_Mono'] px-2 py-0.5 rounded ${s.cls}`}>
      {s.label}{status === 'limited' && remaining != null && remaining > 0 ? ` (${remaining}s)` : ''}
    </span>
  );
}

function FaqBar({ name, hits, maxHits }: { name: string; hits: number; maxHits: number }) {
  const pct = maxHits > 0 ? (hits / maxHits) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-text-primary font-['Inter'] truncate" title={name}>{name}</span>
        <span className="text-[11px] text-[#8a8a8a] font-['JetBrains_Mono'] ml-3 shrink-0">{hits}</span>
      </div>
      <div className="w-full h-1.5 bg-[#141414] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${pct}%`, minWidth: pct > 0 ? '4px' : '0' }}
        />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStatsData>({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
    refetchInterval: 30000,
    staleTime: 15_000,
  });

  return (
    <div className="flex flex-col h-full">
      <Header title="Dashboard" subtitle="ADMINCHAT Panel Overview" />
      <div className="flex-1 px-8 py-6 overflow-y-auto">
        {/* Stat cards */}
        {isLoading ? (
          <>
            <div className="grid grid-cols-4 gap-4 mb-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <StatCardSkeleton key={i} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <DashboardPanelSkeleton />
              <DashboardPanelSkeleton />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <DashboardPanelSkeleton />
              <DashboardPanelSkeleton />
            </div>
          </>
        ) : (
        <>
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Total Received"
            value={stats?.total_conversations ?? 0}
            icon={MessageSquare}
            color="text-accent"
            trend={stats?.trends?.conversations}
          />
          <StatCard
            label="Resolved"
            value={stats?.resolved_conversations ?? 0}
            icon={CheckCircle}
            color="text-green"
          />
          <StatCard
            label="Open / Unresolved"
            value={stats?.open_conversations ?? 0}
            icon={AlertCircle}
            color="text-orange"
          />
          <StatCard
            label="Blocked"
            value={stats?.blocked_users ?? 0}
            icon={ShieldBan}
            color="text-red"
          />
        </div>

        {/* Two-column panels */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Bot Pool Status */}
          <div className="bg-[#0A0A0A] border border-[#2f2f2f] rounded-[10px] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[18px] font-semibold text-text-primary font-['Space_Grotesk']">Bot Pool Status</h3>
              <span className="text-[10px] font-semibold font-['JetBrains_Mono'] px-2 py-0.5 rounded bg-green/10 text-green">
                {stats?.active_bots ?? 0} Active
              </span>
            </div>
            <div className="space-y-2">
              {stats?.bot_pool && stats.bot_pool.length > 0 ? (
                stats.bot_pool.map((bot) => (
                  <div key={bot.id} className="flex items-center gap-3 bg-[#141414] rounded-lg px-4 py-3">
                    <BotStatusDot status={bot.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary truncate">{bot.name}</p>
                    </div>
                    {bot.username && (
                      <span className="text-[11px] text-[#8a8a8a] font-['JetBrains_Mono']">{bot.rate_limit_remaining ?? 0} msgs</span>
                    )}
                    <BotStatusBadge status={bot.status} remaining={bot.rate_limit_remaining} />
                  </div>
                ))
              ) : (
                <div className="text-text-muted text-sm py-4 text-center">No bots configured</div>
              )}
            </div>
          </div>

          {/* FAQ Performance */}
          <div className="bg-[#0A0A0A] border border-[#2f2f2f] rounded-[10px] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[18px] font-semibold text-text-primary font-['Space_Grotesk']">FAQ Performance</h3>
              <span className="text-[10px] font-semibold font-['JetBrains_Mono'] px-2 py-0.5 rounded bg-accent/10 text-accent">
                {((stats?.faq_hit_rate ?? 0) * 100).toFixed(0)}% hit rate
              </span>
            </div>
            <div className="space-y-4">
              {stats?.faq_top && stats.faq_top.length > 0 ? (
                (() => {
                  const maxHits = Math.max(...stats.faq_top.map((f) => f.hits), 1);
                  return stats.faq_top.map((faq) => (
                    <FaqBar key={faq.rule_id} name={faq.name} hits={faq.hits} maxHits={maxHits} />
                  ));
                })()
              ) : (
                <div className="text-text-muted text-sm py-4 text-center">No FAQ data yet</div>
              )}
            </div>
          </div>
        </div>

        {/* Missed Knowledge + Today Messages */}
        <div className="grid grid-cols-2 gap-4">
          {/* Missed Knowledge */}
          <div className="bg-[#0A0A0A] border border-[#2f2f2f] rounded-[10px] p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle size={16} className="text-orange" />
              <h3 className="text-[18px] font-semibold text-text-primary font-['Space_Grotesk']">Missed Knowledge</h3>
            </div>
            <div className="space-y-2">
              {stats?.missed_keywords && stats.missed_keywords.length > 0 ? (
                stats.missed_keywords.map((kw) => (
                  <div key={kw.id} className="flex items-center justify-between bg-[#141414] rounded-lg px-4 py-3">
                    <span className="text-sm text-text-primary font-['JetBrains_Mono']">{kw.keyword}</span>
                    <span className="text-[11px] text-[#8a8a8a] font-['JetBrains_Mono'] bg-[#0A0A0A] px-2 py-0.5 rounded">
                      {kw.count}x
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-text-muted text-sm py-4 text-center">No missed keywords</div>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-[#0A0A0A] border border-[#2f2f2f] rounded-[10px] p-5">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare size={16} className="text-accent" />
              <h3 className="text-[18px] font-semibold text-text-primary font-['Space_Grotesk']">Today's Activity</h3>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-[#141414] rounded-lg px-4 py-3">
                <span className="text-sm text-[#8a8a8a]">Messages Today</span>
                <span className="text-lg font-semibold text-accent font-['Space_Grotesk']">
                  {stats?.total_messages_today?.toLocaleString() ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between bg-[#141414] rounded-lg px-4 py-3">
                <span className="text-sm text-[#8a8a8a]">Messages Trend</span>
                {stats?.trends ? (
                  <TrendBadge value={stats.trends.messages} />
                ) : (
                  <span className="text-xs text-text-muted">--</span>
                )}
              </div>
              <div className="flex items-center justify-between bg-[#141414] rounded-lg px-4 py-3">
                <span className="text-sm text-[#8a8a8a]">FAQ Hit Rate</span>
                <span className="text-lg font-semibold text-green font-['Space_Grotesk']">
                  {((stats?.faq_hit_rate ?? 0) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
