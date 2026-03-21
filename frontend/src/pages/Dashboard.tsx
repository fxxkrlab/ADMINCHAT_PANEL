import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, MessageSquare, CheckCircle, AlertCircle, ShieldBan, Bot, Wifi, WifiOff, Clock, HelpCircle } from 'lucide-react';
import Header from '../components/layout/Header';
import { StatCardSkeleton, DashboardPanelSkeleton } from '../components/ui/Skeleton';
import { getDashboardStats } from '../services/usersApi';
import type { DashboardStatsData } from '../services/usersApi';

function TrendBadge({ value }: { value: number }) {
  if (value === 0) return null;
  const isUp = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-mono ${isUp ? 'text-green' : 'text-red'}`}>
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
    <div className="bg-bg-card border border-border-subtle rounded-lg p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-secondary font-['Inter'] flex items-center gap-2">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color} bg-opacity-10`}
          style={{ backgroundColor: `${color === 'text-accent' ? 'rgba(0,217,255,0.1)' : color === 'text-green' ? 'rgba(5,150,105,0.1)' : color === 'text-orange' ? 'rgba(255,136,0,0.1)' : 'rgba(255,68,68,0.1)'}` }}>
          <Icon size={16} className={color} />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <span className={`text-3xl font-bold font-['Space_Grotesk'] ${color}`}>
          {value.toLocaleString()}
        </span>
        {trend !== undefined && <TrendBadge value={trend} />}
      </div>
    </div>
  );
}

function BotStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'online':
      return <Wifi size={14} className="text-green" />;
    case 'limited':
      return <Clock size={14} className="text-orange" />;
    default:
      return <WifiOff size={14} className="text-red" />;
  }
}

function BotStatusLabel({ status, remaining }: { status: string; remaining?: number | null }) {
  switch (status) {
    case 'online':
      return <span className="text-xs text-green font-mono">ONLINE</span>;
    case 'limited':
      return (
        <span className="text-xs text-orange font-mono">
          LIMITED {remaining != null && remaining > 0 ? `(${remaining}s)` : ''}
        </span>
      );
    default:
      return <span className="text-xs text-red font-mono">OFFLINE</span>;
  }
}

function FaqBar({ name, hits, maxHits }: { name: string; hits: number; maxHits: number }) {
  const pct = maxHits > 0 ? (hits / maxHits) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-text-secondary w-32 truncate font-['Inter']" title={name}>{name}</span>
      <div className="flex-1 h-4 bg-bg-elevated rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${pct}%`, minWidth: pct > 0 ? '4px' : '0' }}
        />
      </div>
      <span className="text-xs text-text-muted font-['JetBrains_Mono'] w-12 text-right">{hits}</span>
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStatsData>({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
    refetchInterval: 30000,
    staleTime: 15_000, // Data considered fresh for 15s
  });

  return (
    <div className="flex flex-col h-full">
      <Header title="Dashboard" />
      <div className="flex-1 p-6 overflow-y-auto">
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
          <div className="bg-bg-card border border-border-subtle rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <Bot size={16} className="text-accent" />
              <h3 className="text-sm font-semibold text-text-primary font-['Space_Grotesk']">Bot Pool Status</h3>
              <span className="ml-auto text-xs text-text-muted font-mono">
                {stats?.active_bots ?? 0}/{stats?.total_bots ?? 0} active
              </span>
            </div>
            <div className="space-y-2.5">
              {isLoading ? (
                <div className="text-text-muted text-sm py-4 text-center">Loading...</div>
              ) : stats?.bot_pool && stats.bot_pool.length > 0 ? (
                stats.bot_pool.map((bot) => (
                  <div key={bot.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-bg-elevated">
                    <BotStatusIcon status={bot.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary truncate">{bot.name}</p>
                      {bot.username && (
                        <p className="text-xs text-text-muted font-mono">@{bot.username}</p>
                      )}
                    </div>
                    <BotStatusLabel status={bot.status} remaining={bot.rate_limit_remaining} />
                  </div>
                ))
              ) : (
                <div className="text-text-muted text-sm py-4 text-center">No bots configured</div>
              )}
            </div>
          </div>

          {/* FAQ Performance */}
          <div className="bg-bg-card border border-border-subtle rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <HelpCircle size={16} className="text-accent" />
              <h3 className="text-sm font-semibold text-text-primary font-['Space_Grotesk']">FAQ Performance</h3>
              <span className="ml-auto text-xs text-text-muted font-mono">
                Hit rate: {((stats?.faq_hit_rate ?? 0) * 100).toFixed(0)}%
              </span>
            </div>
            <div className="space-y-3">
              {isLoading ? (
                <div className="text-text-muted text-sm py-4 text-center">Loading...</div>
              ) : stats?.faq_top && stats.faq_top.length > 0 ? (
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
          <div className="bg-bg-card border border-border-subtle rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle size={16} className="text-orange" />
              <h3 className="text-sm font-semibold text-text-primary font-['Space_Grotesk']">Missed Knowledge</h3>
            </div>
            <div className="space-y-2">
              {isLoading ? (
                <div className="text-text-muted text-sm py-4 text-center">Loading...</div>
              ) : stats?.missed_keywords && stats.missed_keywords.length > 0 ? (
                stats.missed_keywords.map((kw) => (
                  <div key={kw.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-bg-elevated">
                    <span className="text-sm text-text-primary font-mono">{kw.keyword}</span>
                    <span className="text-xs text-text-muted font-mono bg-bg-card px-2 py-0.5 rounded">
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
          <div className="bg-bg-card border border-border-subtle rounded-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare size={16} className="text-accent" />
              <h3 className="text-sm font-semibold text-text-primary font-['Space_Grotesk']">Today's Activity</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between px-3 py-3 rounded-lg bg-bg-elevated">
                <span className="text-sm text-text-secondary">Messages Today</span>
                <span className="text-lg font-semibold text-accent font-['Space_Grotesk']">
                  {stats?.total_messages_today?.toLocaleString() ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-3 rounded-lg bg-bg-elevated">
                <span className="text-sm text-text-secondary">Messages Trend</span>
                {stats?.trends ? (
                  <TrendBadge value={stats.trends.messages} />
                ) : (
                  <span className="text-xs text-text-muted">--</span>
                )}
              </div>
              <div className="flex items-center justify-between px-3 py-3 rounded-lg bg-bg-elevated">
                <span className="text-sm text-text-secondary">FAQ Hit Rate</span>
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
