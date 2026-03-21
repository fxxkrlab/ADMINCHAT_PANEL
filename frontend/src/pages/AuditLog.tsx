import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Filter, X } from 'lucide-react';
import Header from '../components/layout/Header';
import { getAuditLogs, type AuditLogFilters, type AuditLogEntry } from '../services/auditApi';
import { getAdmins } from '../services/adminApi';

// Action color mapping
const ACTION_COLORS: Record<string, { label: string; color: string; bg: string }> = {
  block_user: { label: 'Block User', color: 'text-red', bg: 'bg-[#FF4444]/10' },
  unblock_user: { label: 'Unblock User', color: 'text-green', bg: 'bg-[#059669]/10' },
  create_admin: { label: 'Create Admin', color: 'text-accent', bg: 'bg-accent/10' },
  deactivate_admin: { label: 'Deactivate Admin', color: 'text-orange', bg: 'bg-[#FF8800]/10' },
  create_bot: { label: 'Add Bot', color: 'text-accent', bg: 'bg-accent/10' },
  delete_bot: { label: 'Remove Bot', color: 'text-red', bg: 'bg-[#FF4444]/10' },
  create_faq_rule: { label: 'Create FAQ Rule', color: 'text-purple', bg: 'bg-[#8B5CF6]/10' },
  update_faq_rule: { label: 'Update FAQ Rule', color: 'text-orange', bg: 'bg-[#FF8800]/10' },
  delete_faq_rule: { label: 'Delete FAQ Rule', color: 'text-red', bg: 'bg-[#FF4444]/10' },
};

function ActionBadge({ action }: { action: string }) {
  const config = ACTION_COLORS[action] || {
    label: action.replace(/_/g, ' '),
    color: 'text-text-secondary',
    bg: 'bg-bg-elevated',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${config.color} ${config.bg}`}>
      {config.label}
    </span>
  );
}

function DetailsCell({ details }: { details: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const entries = Object.entries(details);

  if (entries.length === 0) {
    return <span className="text-text-placeholder text-xs">--</span>;
  }

  // Show short summary
  const summary = entries
    .slice(0, 2)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(', ');
  const hasMore = entries.length > 2;

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="text-left text-xs text-text-secondary hover:text-white transition-colors flex items-center gap-1 max-w-[200px]"
        title="Click to expand"
      >
        <span className="truncate">{summary}{hasMore ? '...' : ''}</span>
        <ChevronDown size={12} className="shrink-0 text-text-muted" />
      </button>
    );
  }

  return (
    <div className="text-xs">
      <button
        onClick={() => setExpanded(false)}
        className="flex items-center gap-1 text-accent mb-1 hover:underline"
      >
        <span>Collapse</span>
        <ChevronUp size={12} />
      </button>
      <pre className="bg-bg-elevated border border-border rounded p-2 text-text-secondary whitespace-pre-wrap max-w-[300px] overflow-auto font-mono text-[11px]">
        {JSON.stringify(details, null, 2)}
      </pre>
    </div>
  );
}

const ACTION_OPTIONS = [
  'block_user',
  'unblock_user',
  'create_admin',
  'deactivate_admin',
  'create_bot',
  'delete_bot',
  'create_faq_rule',
  'update_faq_rule',
  'delete_faq_rule',
];

const TARGET_TYPE_OPTIONS = ['user', 'admin', 'bot', 'faq_rule'];

export default function AuditLog() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [adminFilter, setAdminFilter] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const filters: AuditLogFilters = {
    page,
    page_size: pageSize,
    ...(adminFilter ? { admin_id: Number(adminFilter) } : {}),
    ...(actionFilter ? { action: actionFilter } : {}),
    ...(targetTypeFilter ? { target_type: targetTypeFilter } : {}),
    ...(dateFrom ? { date_from: new Date(dateFrom).toISOString() } : {}),
    ...(dateTo ? { date_to: new Date(dateTo + 'T23:59:59').toISOString() } : {}),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => getAuditLogs(filters),
  });

  const { data: adminsData } = useQuery({
    queryKey: ['admins-list'],
    queryFn: getAdmins,
  });

  const logs = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.total_pages ?? 0;

  const hasActiveFilters = adminFilter || actionFilter || targetTypeFilter || dateFrom || dateTo;

  const clearFilters = () => {
    setAdminFilter('');
    setActionFilter('');
    setTargetTypeFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  return (
    <div className="h-full flex flex-col">
      <Header title="Audit Log" />

      <div className="flex-1 overflow-auto p-8">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <FileText size={20} className="text-accent" />
            <span className="text-sm text-text-secondary">
              {total} {total === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-red bg-[#FF4444]/10 rounded-lg hover:bg-[#FF4444]/20 transition-colors"
              >
                <X size={12} />
                Clear Filters
              </button>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg transition-colors border ${
                showFilters
                  ? 'text-accent bg-accent/10 border-accent/20'
                  : 'text-text-secondary bg-bg-elevated border-border hover:text-white'
              }`}
            >
              <Filter size={14} />
              Filters
            </button>
          </div>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="mb-8 p-4 bg-bg-card border border-border rounded-xl grid grid-cols-2 md:grid-cols-5 gap-3">
            {/* Admin filter */}
            <div>
              <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Admin</label>
              <select
                value={adminFilter}
                onChange={(e) => { setAdminFilter(e.target.value); setPage(1); }}
                className="w-full h-9 bg-bg-elevated border border-border rounded-lg px-3 text-xs text-white focus:outline-none focus:border-accent transition-colors"
              >
                <option value="">All</option>
                {adminsData?.items?.map((a) => (
                  <option key={a.id} value={a.id}>{a.username}</option>
                ))}
              </select>
            </div>

            {/* Action filter */}
            <div>
              <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Action</label>
              <select
                value={actionFilter}
                onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                className="w-full h-9 bg-bg-elevated border border-border rounded-lg px-3 text-xs text-white focus:outline-none focus:border-accent transition-colors"
              >
                <option value="">All</option>
                {ACTION_OPTIONS.map((a) => (
                  <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            {/* Target type filter */}
            <div>
              <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Target Type</label>
              <select
                value={targetTypeFilter}
                onChange={(e) => { setTargetTypeFilter(e.target.value); setPage(1); }}
                className="w-full h-9 bg-bg-elevated border border-border rounded-lg px-3 text-xs text-white focus:outline-none focus:border-accent transition-colors"
              >
                <option value="">All</option>
                {TARGET_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            {/* Date from */}
            <div>
              <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="w-full h-9 bg-bg-elevated border border-border rounded-lg px-3 text-xs text-white focus:outline-none focus:border-accent transition-colors"
              />
            </div>

            {/* Date to */}
            <div>
              <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="w-full h-9 bg-bg-elevated border border-border rounded-lg px-3 text-xs text-white focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono'] px-6 py-4">Timestamp</th>
                  <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono'] px-6 py-4">Admin</th>
                  <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono'] px-6 py-4">Action</th>
                  <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono'] px-6 py-4">Target</th>
                  <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono'] px-6 py-4">Details</th>
                  <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono'] px-6 py-4">IP Address</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-text-muted text-sm">Loading...</td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-text-muted text-sm">No audit logs found.</td>
                  </tr>
                ) : (
                  logs.map((log: AuditLogEntry) => (
                    <tr key={log.id} className="border-b border-border-subtle hover:bg-bg-elevated/50 transition-colors">
                      <td className="px-6 py-4.5 text-xs text-text-secondary whitespace-nowrap font-mono">
                        {(() => { const d = new Date(log.created_at + (log.created_at.endsWith('Z') ? '' : 'Z')); return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }); })()}
                      </td>
                      <td className="px-6 py-4.5 text-xs text-white">
                        {log.admin_username || <span className="text-text-placeholder">System</span>}
                      </td>
                      <td className="px-6 py-4.5">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="px-6 py-4.5 text-xs text-text-secondary">
                        {log.target_type && (
                          <span>
                            <span className="text-text-muted">{log.target_type}</span>
                            {log.target_id != null && (
                              <span className="text-white ml-1 font-mono">#{log.target_id}</span>
                            )}
                          </span>
                        )}
                        {!log.target_type && <span className="text-text-placeholder">--</span>}
                      </td>
                      <td className="px-6 py-4.5">
                        <DetailsCell details={log.details} />
                      </td>
                      <td className="px-6 py-4.5 text-xs text-text-muted font-mono">
                        {log.ip_address || '--'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border-subtle">
              <span className="text-xs text-text-muted">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex items-center justify-center w-8 h-8 rounded-md text-text-secondary hover:text-white hover:bg-bg-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`flex items-center justify-center w-8 h-8 rounded-md text-xs transition-colors ${
                        pageNum === page
                          ? 'bg-accent text-black font-semibold'
                          : 'border border-border text-text-secondary hover:bg-bg-elevated'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="flex items-center justify-center w-8 h-8 rounded-md text-text-secondary hover:text-white hover:bg-bg-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
