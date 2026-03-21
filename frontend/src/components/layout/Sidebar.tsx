import { memo } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Bot,
  HelpCircle,
  BarChart3,
  BrainCircuit,
  ShieldCheck,
  Settings,
  Ban,
  BookOpen,
  FileText,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import type { Role } from '../../types';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  minRole: Role;
}

const roleLevel: Record<Role, number> = {
  agent: 0,
  admin: 1,
  super_admin: 2,
};

const navItems: NavItem[] = [
  { to: '/', icon: <LayoutDashboard size={20} />, label: 'Dashboard', minRole: 'agent' },
  { to: '/chat', icon: <MessageSquare size={20} />, label: 'Chat', minRole: 'agent' },
  { to: '/users', icon: <Users size={20} />, label: 'Users', minRole: 'agent' },
  { to: '/blacklist', icon: <Ban size={20} />, label: 'Blacklist', minRole: 'agent' },
  { to: '/bots', icon: <Bot size={20} />, label: 'Bots', minRole: 'admin' },
  { to: '/faq', icon: <HelpCircle size={20} />, label: 'FAQ', minRole: 'admin' },
  { to: '/faq/ranking', icon: <BarChart3 size={20} />, label: 'Ranking', minRole: 'agent' },
  { to: '/faq/missed', icon: <BookOpen size={20} />, label: 'Missed', minRole: 'admin' },
  { to: '/ai', icon: <BrainCircuit size={20} />, label: 'AI', minRole: 'super_admin' },
  { to: '/admins', icon: <ShieldCheck size={20} />, label: 'Admins', minRole: 'super_admin' },
  { to: '/audit-logs', icon: <FileText size={20} />, label: 'Audit Log', minRole: 'super_admin' },
  { to: '/settings', icon: <Settings size={20} />, label: 'Settings', minRole: 'super_admin' },
];

function SidebarInner() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const userRole = user?.role ?? 'agent';

  const visibleItems = navItems.filter(
    (item) => roleLevel[userRole] >= roleLevel[item.minRole]
  );

  return (
    <aside className="flex flex-col w-16 h-screen bg-bg-sidebar border-r border-border-subtle shrink-0">
      {/* Logo */}
      <div className="flex items-center justify-center h-14 border-b border-border-subtle">
        <span className="text-accent font-bold text-sm tracking-tight">AC</span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 flex flex-col items-center gap-1 py-3 overflow-y-auto">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center justify-center w-11 h-11 rounded-lg transition-colors relative group ${
                isActive
                  ? 'bg-accent-10 text-accent'
                  : 'text-text-muted hover:text-text-secondary hover:bg-bg-elevated'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-accent rounded-r-full" />
                )}
                {item.icon}
                {/* Tooltip */}
                <div className="absolute left-full ml-2 px-2 py-1 bg-bg-elevated text-text-primary text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 border border-border-subtle">
                  {item.label}
                </div>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom - logout + version */}
      <div className="flex flex-col items-center gap-2 py-3 border-t border-border-subtle">
        <button
          onClick={logout}
          className="flex items-center justify-center w-11 h-11 rounded-lg text-text-muted hover:text-red hover:bg-red/10 transition-colors"
          title="Logout"
        >
          <LogOut size={20} />
        </button>
        <div className="flex flex-col items-center px-1 select-none">
          <span className="text-text-placeholder text-[8px] leading-tight">v{__APP_VERSION__}</span>
          <span className="text-text-placeholder text-[7px] leading-tight">&reg; NH&times;SK</span>
        </div>
      </div>
    </aside>
  );
}

// Sidebar only changes when user role changes, so wrap with memo
const Sidebar = memo(SidebarInner);
export default Sidebar;
