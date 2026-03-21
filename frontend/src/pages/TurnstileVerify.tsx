import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shield, CheckCircle, XCircle, Loader2 } from 'lucide-react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'error-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact';
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

type VerifyState = 'loading' | 'ready' | 'verifying' | 'success' | 'error' | 'config_error';

export default function TurnstileVerify() {
  const [searchParams] = useSearchParams();
  const uid = searchParams.get('uid');

  const [state, setState] = useState<VerifyState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const widgetRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);

  // Fetch the site key from the API
  useEffect(() => {
    async function fetchConfig() {
      try {
        const resp = await fetch('/api/v1/turnstile/config');
        const data = await resp.json();
        if (data.data?.site_key) {
          setSiteKey(data.data.site_key);
          setState('ready');
        } else {
          setState('config_error');
          setErrorMessage('Turnstile is not configured on this server.');
        }
      } catch {
        setState('config_error');
        setErrorMessage('Failed to load verification configuration.');
      }
    }
    fetchConfig();
  }, []);

  // Handle successful turnstile token
  const handleVerify = useCallback(async (token: string) => {
    if (!uid) {
      setState('error');
      setErrorMessage('Missing user ID. Please use the link sent by the bot.');
      return;
    }

    setState('verifying');

    try {
      const resp = await fetch('/api/v1/turnstile/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, tg_uid: Number(uid) }),
      });
      const data = await resp.json();

      if (data.data?.success) {
        setState('success');
      } else {
        setState('error');
        setErrorMessage(data.data?.message || data.message || 'Verification failed. Please try again.');
      }
    } catch {
      setState('error');
      setErrorMessage('Network error. Please check your connection and try again.');
    }
  }, [uid]);

  // Load Turnstile script and render widget
  useEffect(() => {
    if (state !== 'ready' || !siteKey || !containerRef.current) return;

    function renderWidget() {
      if (!window.turnstile || !containerRef.current) return;
      // Clear any previous widget
      if (widgetRef.current) {
        try { window.turnstile.remove(widgetRef.current); } catch { /* ignore */ }
      }
      widgetRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey!,
        callback: handleVerify,
        'error-callback': () => {
          setState('error');
          setErrorMessage('Verification challenge failed. Please try again.');
        },
        theme: 'dark',
      });
    }

    if (window.turnstile) {
      renderWidget();
      return;
    }

    if (!scriptLoadedRef.current) {
      scriptLoadedRef.current = true;
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = () => renderWidget();
      script.onerror = () => {
        setState('config_error');
        setErrorMessage('Failed to load verification script. Please disable ad blockers and try again.');
      };
      document.head.appendChild(script);
    }

    return () => {
      if (widgetRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetRef.current); } catch { /* ignore */ }
        widgetRef.current = null;
      }
    };
  }, [state, siteKey, handleVerify]);

  if (!uid) {
    return (
      <div className="min-h-screen bg-bg-page flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-bg-card border border-border rounded-xl p-8 text-center">
          <XCircle size={48} className="text-red mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Invalid Link
          </h1>
          <p className="text-text-secondary text-sm">
            Missing user ID. Please use the verification link sent by the bot in Telegram.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-page flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-bg-card border border-border rounded-xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent/10 mb-4">
            <Shield size={28} className="text-accent" />
          </div>
          <h1
            className="text-xl font-semibold text-white mb-2"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            ADMINCHAT Verification
          </h1>
          <p className="text-text-secondary text-sm">
            Please complete the verification to continue chatting
          </p>
        </div>

        {/* States */}
        {state === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 size={32} className="text-accent animate-spin" />
            <p className="text-text-muted text-sm">Loading verification...</p>
          </div>
        )}

        {state === 'ready' && (
          <div className="flex justify-center py-4">
            <div ref={containerRef} />
          </div>
        )}

        {state === 'verifying' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 size={32} className="text-accent animate-spin" />
            <p className="text-text-secondary text-sm">Verifying...</p>
          </div>
        )}

        {state === 'success' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#059669]/10">
              <CheckCircle size={36} className="text-green" />
            </div>
            <h2 className="text-lg font-semibold text-white">Verification Complete!</h2>
            <p className="text-text-secondary text-sm text-center">
              You can now return to Telegram and continue chatting.
            </p>
          </div>
        )}

        {(state === 'error' || state === 'config_error') && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#FF4444]/10">
              <XCircle size={36} className="text-red" />
            </div>
            <h2 className="text-lg font-semibold text-white">Verification Failed</h2>
            <p className="text-text-secondary text-sm text-center">{errorMessage}</p>
            {state === 'error' && (
              <button
                onClick={() => window.location.reload()}
                className="mt-3 px-5 py-2 rounded-lg bg-accent/10 text-accent text-sm font-medium hover:bg-accent/20 transition-colors border border-accent/20"
              >
                Try Again
              </button>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-border-subtle text-center">
          <p className="text-text-placeholder text-xs">
            Protected by Cloudflare Turnstile
          </p>
        </div>
      </div>
    </div>
  );
}
