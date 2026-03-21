import { memo } from 'react';
import { useAuthStore } from '../../stores/authStore';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

function HeaderInner({ title, subtitle }: HeaderProps) {
  const user = useAuthStore((s) => s.user);

  return (
    <header className="flex items-center justify-between px-8 pt-6 pb-0 bg-bg-page shrink-0">
      <div>
        {title && (
          <h1 className="text-[28px] font-bold text-text-primary font-['Space_Grotesk']">{title}</h1>
        )}
        {subtitle && (
          <p className="text-sm text-text-muted mt-0.5">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Admin avatar */}
        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-black text-xs font-bold font-['Space_Grotesk']">
          {(user?.username?.[0] ?? 'A').toUpperCase()}
        </div>
        <span className="text-sm text-text-secondary">{user?.username ?? 'Admin'}</span>
      </div>
    </header>
  );
}

// Only re-renders when title or user changes
const Header = memo(HeaderInner);
export default Header;
