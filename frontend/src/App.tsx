import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import { useActivePlugins } from './plugins/useInstalledPlugins';
import { PluginLoader } from './plugins/PluginLoader';

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-[#0C0C0C]">
          <div className="flex flex-col items-center gap-4 max-w-md text-center">
            <div className="text-[#FF4444] text-4xl">!</div>
            <h2 className="text-white text-lg font-semibold">Something went wrong</h2>
            <p className="text-[#8a8a8a] text-sm">{this.state.error?.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-md bg-[#00D9FF]/10 text-[#00D9FF] text-sm hover:bg-[#00D9FF]/20 transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Route-based code splitting: lazy-load all pages so only the needed chunk is loaded
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Chat = lazy(() => import('./pages/Chat'));
const UsersGrid = lazy(() => import('./pages/UsersGrid'));
const UserDetail = lazy(() => import('./pages/UserDetail'));
const BotPool = lazy(() => import('./pages/BotPool'));
const FAQList = lazy(() => import('./pages/FAQList'));
const FAQEditor = lazy(() => import('./pages/FAQEditor'));
const FAQRanking = lazy(() => import('./pages/FAQRanking'));
const MissedKnowledge = lazy(() => import('./pages/MissedKnowledge'));
const AISettings = lazy(() => import('./pages/AISettings'));
const AdminManage = lazy(() => import('./pages/AdminManage'));
const Settings = lazy(() => import('./pages/Settings'));
const Blacklist = lazy(() => import('./pages/Blacklist'));
const AuditLog = lazy(() => import('./pages/AuditLog'));
const Market = lazy(() => import('./pages/Market'));
const TurnstileVerify = lazy(() => import('./pages/TurnstileVerify'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#00D9FF] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-[#6a6a6a]">Loading...</span>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { data: activePlugins } = useActivePlugins();

  // Build plugin routes from active plugins
  const pluginRoutes = (activePlugins || []).flatMap(p =>
    (p.manifest.frontend?.sidebar || [])
      .filter(item => item.path.startsWith('/p/'))
      .map(item => ({
        path: item.path,
        pluginId: p.plugin_id,
        pluginName: p.name,
      }))
  );

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/verify" element={<TurnstileVerify />} />

      {/* Authenticated */}
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/chat/:conversationId" element={<Chat />} />
        <Route path="/users" element={<UsersGrid />} />
        <Route path="/users/:id" element={<UserDetail />} />
        <Route path="/blacklist" element={<Blacklist />} />
        <Route path="/bots" element={<BotPool />} />
        <Route path="/faq" element={<FAQList />} />
        <Route path="/faq/new" element={<FAQEditor />} />
        <Route path="/faq/:id/edit" element={<FAQEditor />} />
        <Route path="/faq/ranking" element={<FAQRanking />} />
        <Route path="/faq/missed" element={<MissedKnowledge />} />
        <Route path="/ai" element={<AISettings />} />
        <Route path="/admins" element={<AdminManage />} />
        <Route path="/audit-logs" element={<AuditLog />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/market" element={<Market />} />

        {/* Dynamic plugin routes */}
        {pluginRoutes.map(route => (
          <Route
            key={route.path}
            path={`${route.path}/*`}
            element={
              <PluginLoader
                pluginId={route.pluginId}
                pluginName={route.pluginName}
              />
            }
          />
        ))}
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <AppRoutes />
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
