import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Filter, X } from 'lucide-react';
import Header from '../components/layout/Header';
import { getAuditLogs, type AuditLogFilters, type AuditLogEntry } from '../services/auditApi';
import { getAdmins } from '../services/adminApi';

// Action color mapping
const ACTION_COLORS: Record<string, { label: string; color: string; bg: string }> = {
  block_user: { label: 'Block User', color: 'text-[#FF4444]', bg: 'bg-[#FF4444]/10' },
  unblock_user: { label: 'Unblock User', color: 'text-[#059669]', bg: 'bg-[#059669]/10' },
  create_admin: { label: 'Create Admin', color: 'text-[#00D9FF]', bg: 'bg-[#00D9FF]/10' },
  deactivate_admin: { label: 'Deactivate Admin', color: 'text-[#FF8800]', bg: 'bg-[#FF8800]/10' },
  create_bot: { label: 'Add Bot', color: 'text-[#00D9FF]', bg: 'bg-[#00D9FF]/10' },
  delete_bot: { label: 'Remove Bot', color: 'text-[#FF4444]', bg: 'bg-[#FF4444]/10' },
  create_faq_rule: { label: 'Create FAQ Rule', color: 'text-[#8B5CF6]', bg: 'bg-[#8B5CF6]/10' },
  update_faq_rule: { label: 'Update FAQ Rule', color: 'text-[#FF8800]', bg: 'bg-[#FF8800]/10' },
  delete_faq_rule: { label: 'Delete FAQ Rule', color: 'text-[#FF4444]', bg: 'bg-[#FF4444]/10' },
};

function ActionBadge({ action }: { action: string }) {
  const config = ACTION_COLORS[action] || {
    label: action.replace(/_/g, ' '),
    color: 'text-[#8a8a8a]',
    bg: 'bg-[#141414]',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.color} ${config.bg}`}>
      {config.label}
    </span>
  );
}

function DetailsCell({ details }: { details: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const entries = Object.entries(details);

  if (entries.length === 0) {
    return <span className="text-[#4a4a4a] text-xs">--</span>;
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
        className="text-left text-xs text-[#8a8a8a] hover:text-white transition-colors flex items-center gap-1 max-w-[200px]"
        title="Click to expand"
      >
        <span className="truncate">{summary}{hasMore ? '...' : ''}</span>
        <ChevronDown size={12} className="shrink-0 text-[#6a6a6a]" />
      </button>
    );
  }

  return (
    <div className="text-xs">
      <button
        onClick={() => setExpanded(false)}
        className="flex items-center gap-1 text-[#00D9FF] mb-1 hover:underline"
      >
        <span>Collapse</span>
        <ChevronUp size={12} />
      </button>
      <pre className="bg-[#141414] border border-[#2f2f2f] rounded p-2 text-[#8a8a8a] whitespace-pre-wrap max-w-[300px] overflow-auto font-mono text-[11px]">
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

      <div className="flex-1 overflow-auto p-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FileText size={20} className="text-[#00D9FF]" />
            <span className="text-sm text-[#8a8a8a]">
              {total} {total === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-[#FF4444] bg-[#FF4444]/10 rounded-lg hover:bg-[#FF4444]/20 transition-colors"
              >
                <X size={12} />
                Clear Filters
              </button>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg transition-colors border ${
                showFilters
                  ? 'text-[#00D9FF] bg-[#00D9FF]/10 border-[#00D9FF]/20'
                  : 'text-[#8a8a8a] bg-[#141414] border-[#2f2f2f] hover:text-white'
              }`}
            >
              <Filter size={14} />
              Filters
            </button>
          </div>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="mb-4 p-4 bg-[#0A0A0A] border border-[#2f2f2f] rounded-lg grid grid-cols-2 md:grid-cols-5 gap-3">
            {/* Admin filter */}
            <div>
              <label className="block text-[10px] text-[#6a6a6a] uppercase tracking-wider mb-1">Admin</label>
              <select
                value={adminFilter}
                onChange={(e) => { setAdminFilter(e.target.value); setPage(1); }}
                className="w-full bg-[#141414] border border-[#2f2f2f] rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#00D9FF]/50"
              >
                <option value="">All</option>
                {adminsData?.items?.map((a) => (
                  <option key={a.id} value={a.id}>{a.username}</option>
                ))}
              </select>
            </div>

            {/* Action filter */}
            <div>
              <label className="block text-[10px] text-[#6a6a6a] uppercase tracking-wider mb-1">Action</label>
              <select
                value={actionFilter}
                onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                className="w-full bg-[#141414] border border-[#2f2f2f] rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#00D9FF]/50"
              >
                <option value="">All</option>
                {ACTION_OPTIONS.map((a) => (
                  <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            {/* Target type filter */}
            <div>
              <label className="block text-[10px] text-[#6a6a6a] uppercase tracking-wider mb-1">Target Type</label>
              <select
                value={targetTypeFilter}
                onChange={(e) => { setTargetTypeFilter(e.target.value); setPage(1); }}
                className="w-full bg-[#141414] border border-[#2f2f2f] rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#00D9FF]/50"
              >
                <option value="">All</option>
                {TARGET_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            {/* Date from */}
            <div>
              <label className="block text-[10px] text-[#6a6a6a] uppercase tracking-wider mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="w-full bg-[#141414] border border-[#2f2f2f] rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#00D9FF]/50"
              />
            </div>

            {/* Date to */}
            <div>
              <label className="block text-[10px] text-[#6a6a6a] uppercase tracking-wider mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="w-full bg-[#141414] border border-[#2f2f2f] rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#00D9FF]/50"
              />
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-[#0A0A0A] border border-[#2f2f2f] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1A1A1A]">
                  <th className="text-left text-[10px] text-[#6a6a6a] uppercase tracking-wider px-4 py-3 font-medium">Timestamp</th>
                  <th className="text-left text-[10px] text-[#6a6a6a] uppercase tracking-wider px-4 py-3 font-medium">Admin</th>
                  <th className="text-left text-[10px] text-[#6a6a6a] uppercase tracking-wider px-4 py-3 font-medium">Action</th>
                  <th className="text-left text-[10px] text-[#6a6a6a] uppercase tracking-wider px-4 py-3 font-medium">Target</th>
                  <th className="text-left text-[10px] text-[#6a6a6a] uppercase tracking-wider px-4 py-3 font-medium">Details</th>
                  <th className="text-left text-[10px] text-[#6a6a6a] uppercase tracking-wider px-4 py-3 font-medium">IP Address</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-[#6a6a6a] text-sm">Loading...</td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-[#6a6a6a] text-sm">No audit logs found.</td>
                  </tr>
                ) : (
                  logs.map((log: AuditLogEntry) => (
                    <tr key={log.id} className="border-b border-[#1A1A1A] hover:bg-[#141414]/50 transition-colors">
                      <td className="px-4 py-3 text-xs text-[#8a8a8a] whitespace-nowrap font-mono">
                        {(() => { const d = new Date(log.created_at + (log.created_at.endsWith('Z') ? '' : 'Z')); return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }); })()}
                      </td>
                      <td className="px-4 py-3 text-xs text-white">
                        {log.admin_username || <span className="text-[#4a4a4a]">System</span>}
                      </td>
                      <td className="px-4 py-3">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="px-4 py-3 text-xs text-[#8a8a8a]">
                        {log.target_type && (
                          <span>
                            <span className="text-[#6a6a6a]">{log.target_type}</span>
                            {log.target_id != null && (
                              <span className="text-white ml-1 font-mono">#{log.target_id}</span>
                            )}
                          </span>
                        )}
                        {!log.target_type && <span className="text-[#4a4a4a]">--</span>}
                      </td>
                      <td className="px-4 py-3">
                        <DetailsCell details={log.details} />
                      </td>
                      <td className="px-4 py-3 text-xs text-[#6a6a6a] font-mono">
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
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#1A1A1A]">
              <span className="text-xs text-[#6a6a6a]">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex items-center justify-center w-8 h-8 rounded-md text-[#8a8a8a] hover:text-white hover:bg-[#141414] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
                          ? 'bg-[#00D9FF]/10 text-[#00D9FF]'
                          : 'text-[#8a8a8a] hover:text-white hover:bg-[#141414]'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="flex items-center justify-center w-8 h-8 rounded-md text-[#8a8a8a] hover:text-white hover:bg-[#141414] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
