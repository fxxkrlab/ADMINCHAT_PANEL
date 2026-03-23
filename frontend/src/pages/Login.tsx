import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import {
  LogIn,
  MessageSquare,
  Bot,
  ShieldCheck,
  BarChart3,
  Eye,
  EyeOff,
  User,
  Lock,
} from 'lucide-react';

const features = [
  {
    icon: <MessageSquare size={18} />,
    title: 'Bidirectional Messaging',
    desc: 'Forward and reply to Telegram messages in real time',
  },
  {
    icon: <Bot size={18} />,
    title: 'Multi-Bot Pool',
    desc: 'Manage multiple bots with automatic failover',
  },
  {
    icon: <ShieldCheck size={18} />,
    title: 'Role-Based Access',
    desc: 'Fine-grained permissions for agents and admins',
  },
  {
    icon: <BarChart3 size={18} />,
    title: 'FAQ & Analytics',
    desc: 'Automated replies with hit-rate analytics',
  },
];

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const loginWithCredentials = useAuthStore((s) => s.loginWithCredentials);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await loginWithCredentials(username, password);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } };
      setError(
        axiosError.response?.data?.detail || 'Invalid username or password'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#080808]">
      {/* Left side - Brand */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center px-12">
        <div className="max-w-md w-full text-center">
          <h1 className="text-[42px] font-bold tracking-tight font-['Space_Grotesk'] leading-tight">
            <span className="text-[#00D9FF]">ADMINCHAT</span>
          </h1>
          <p className="text-[42px] font-bold text-white font-['Space_Grotesk'] leading-tight">Panel</p>
          <p className="text-[#8a8a8a] text-sm leading-relaxed mt-4 max-w-sm mx-auto">
            Telegram customer service management platform with bidirectional
            message forwarding, multi-bot pool, and intelligent FAQ engine.
          </p>

          {/* Cyan divider */}
          <div className="flex justify-center my-8">
            <div className="w-[60px] h-[2px] bg-[#00D9FF]" />
          </div>

          <div className="space-y-5 text-left max-w-sm mx-auto">
            {features.map((f) => (
              <div key={f.title} className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#00D9FF]/10 text-[#00D9FF] shrink-0">
                  {f.icon}
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{f.title}</p>
                  <p className="text-[#6a6a6a] text-xs mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center px-6 lg:px-16 lg:border-l lg:border-[#1A1A1A]">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="text-center mb-8 lg:hidden">
            <h1 className="text-2xl font-bold tracking-tight font-['Space_Grotesk']">
              <span className="text-[#00D9FF]">ADMIN</span>
              <span className="text-white">CHAT</span>
            </h1>
            <p className="text-[#6a6a6a] text-sm mt-1 font-['Space_Grotesk']">Panel</p>
          </div>

          {/* Desktop heading */}
          <div className="hidden lg:block mb-8">
            <h2 className="text-[28px] font-bold text-white font-['Space_Grotesk']">Sign In</h2>
            <p className="text-[#6a6a6a] text-sm mt-1">
              Sign in to your account to continue
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            <div>
              <label className="block text-[13px] font-medium text-[#8a8a8a] mb-2 font-['Inter']">
                Username
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6a6a6a]" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-10 pl-10 pr-4 bg-[#0C0C0C] border border-[#2f2f2f] rounded-lg text-white text-sm placeholder:text-[#4a4a4a] focus:outline-none focus:border-[#00D9FF] transition-colors"
                  placeholder="Enter username"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[#8a8a8a] mb-2 font-['Inter']">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6a6a6a]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 pl-10 pr-10 bg-[#0C0C0C] border border-[#2f2f2f] rounded-lg text-white text-sm placeholder:text-[#4a4a4a] focus:outline-none focus:border-[#00D9FF] transition-colors"
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6a6a6a] hover:text-[#8a8a8a] transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-[#2f2f2f] bg-[#141414] text-[#00D9FF] focus:ring-[#00D9FF] focus:ring-offset-0 cursor-pointer"
              />
              <label
                htmlFor="remember"
                className="text-xs text-[#6a6a6a] cursor-pointer select-none"
              >
                Remember me
              </label>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 bg-[#FF4444]/10 border border-[#FF4444]/20 rounded-lg">
                <p className="text-[#FF4444] text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full flex items-center justify-center gap-2 h-11 bg-[#00D9FF] text-black font-semibold text-sm rounded-lg hover:bg-[#00C4E6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogIn size={16} />
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-[#4a4a4a] text-[11px] mt-6 font-['JetBrains_Mono']">
            ADMINCHAT Panel v{__APP_VERSION__}
          </p>
        </div>
      </div>
    </div>
  );
}
