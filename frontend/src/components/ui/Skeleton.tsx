interface SkeletonProps {
  className?: string;
  width?: number | string;
  height?: number | string;
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

/** Reusable skeleton/shimmer placeholder for loading states. */
export function Skeleton({ className = '', width, height, rounded = 'md' }: SkeletonProps) {
  const roundedClass = {
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    full: 'rounded-full',
  }[rounded];

  return (
    <div
      className={`animate-pulse bg-[#141414] ${roundedClass} ${className}`}
      style={{ width, height }}
    />
  );
}

/** Skeleton shaped like a stat card on the Dashboard */
export function StatCardSkeleton() {
  return (
    <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8" rounded="lg" />
      </div>
      <Skeleton className="h-9 w-20" />
    </div>
  );
}

/** Skeleton for a user card in UsersGrid */
export function UserCardSkeleton() {
  return (
    <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-4">
      <div className="flex items-start gap-3 mb-3">
        <Skeleton className="w-12 h-12" rounded="full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

/** Skeleton for a conversation item in the conversation list */
export function ConversationItemSkeleton() {
  return (
    <div className="px-3 py-3 border-b border-[#1A1A1A]">
      <div className="flex items-start gap-3">
        <Skeleton className="w-10 h-10" rounded="full" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-8" />
          </div>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
    </div>
  );
}

/** Skeleton for a table row (e.g., FAQ table) */
export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-[#1A1A1A]">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

/** Skeleton for the dashboard panel section */
export function DashboardPanelSkeleton() {
  return (
    <div className="bg-[#0A0A0A] border border-[#1A1A1A] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-4 w-4" rounded="sm" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" rounded="lg" />
        ))}
      </div>
    </div>
  );
}
