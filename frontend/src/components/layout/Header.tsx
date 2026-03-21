import { memo } from 'react';
import { Bell, User } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

interface HeaderProps {
  title?: string;
}

function HeaderInner({ title }: HeaderProps) {
  const user = useAuthStore((s) => s.user);

  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-border-subtle bg-bg-page shrink-0">
      <div>
        {title && (
          <h1 className="text-xl font-bold text-text-primary font-['Space_Grotesk']">{title}</h1>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button className="flex items-center justify-center w-9 h-9 rounded-lg text-text-muted hover:text-text-secondary hover:bg-bg-elevated transition-colors">
          <Bell size={18} />
        </button>

        {/* User badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-elevated">
          <User size={16} className="text-text-muted" />
          <span className="text-sm text-text-secondary">{user?.username ?? 'Guest'}</span>
          <span className="text-xs text-accent bg-accent-10 px-1.5 py-0.5 rounded">
            {user?.role ?? 'agent'}
          </span>
        </div>
      </div>
    </header>
  );
}

// Only re-renders when title or user changes
const Header = memo(HeaderInner);
export default Header;
