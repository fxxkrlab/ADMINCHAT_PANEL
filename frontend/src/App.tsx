import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';

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

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
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
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
