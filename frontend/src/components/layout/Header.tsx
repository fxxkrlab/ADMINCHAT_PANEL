import { memo } from 'react';
import { useAuthStore } from '../../stores/authStore';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

function HeaderInner({ title, subtitle }: HeaderProps) {
  const user = useAuthStore((s) => s.user);

  return (
    <header className="flex items-center justify-between px-8 pt-6 pb-0 bg-[#0C0C0C] shrink-0">
      <div>
        {title && (
          <h1 className="text-[28px] font-bold text-[#FFFFFF] font-['Space_Grotesk']">{title}</h1>
        )}
        {subtitle && (
          <p className="text-sm text-[#6a6a6a] mt-0.5">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Admin avatar */}
        <div className="w-8 h-8 rounded-full bg-[#00D9FF] flex items-center justify-center text-black text-xs font-bold font-['Space_Grotesk']">
          {(user?.username?.[0] ?? 'A').toUpperCase()}
        </div>
        <span className="text-sm text-[#8a8a8a]">{user?.username ?? 'Admin'}</span>
      </div>
    </header>
  );
}

// Only re-renders when title or user changes
const Header = memo(HeaderInner);
export default Header;
