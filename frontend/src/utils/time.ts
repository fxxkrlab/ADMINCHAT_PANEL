/**
 * Time utilities for ADMINCHAT Panel.
 * All backend timestamps are in UTC. This module converts to Asia/Shanghai (UTC+8).
 */

const TZ = 'Asia/Shanghai';

/** Parse a UTC timestamp string from backend, ensuring it's treated as UTC */
function parseUTC(dateStr: string): Date {
  // If the string doesn't end with Z or timezone info, append Z to mark as UTC
  if (!dateStr.endsWith('Z') && !dateStr.includes('+') && !dateStr.includes('T')) {
    return new Date(dateStr + 'Z');
  }
  if (!dateStr.endsWith('Z') && !dateStr.includes('+')) {
    return new Date(dateStr + 'Z');
  }
  return new Date(dateStr);
}

/** Format as time only: "20:02" */
export function formatTime(dateStr: string): string {
  const date = parseUTC(dateStr);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TZ,
  });
}

/** Format as full date-time: "2026/03/21 20:02:30" */
export function formatDateTime(dateStr: string): string {
  const date = parseUTC(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: TZ,
  });
}

/** Format as date only: "2026/03/21" */
export function formatDate(dateStr: string): string {
  const date = parseUTC(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: TZ,
  });
}

/** Format as relative time: "3分钟前", "2小时前", "昨天" etc. */
export function formatRelativeTime(dateStr: string): string {
  const date = parseUTC(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 2) return '昨天';
  if (diffDays < 7) return `${diffDays}天前`;

  return formatDate(dateStr);
}
