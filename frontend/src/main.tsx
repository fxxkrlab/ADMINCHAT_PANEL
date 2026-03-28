import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App';

// Expose shared libs to window for plugin IIFE bundles
// Plugins use external + globals to reference these instead of bundling their own copy
import * as ReactJSXRuntime from 'react/jsx-runtime';
import * as TanStackReactQuery from '@tanstack/react-query';
(window as any).React = React;
(window as any).ReactDOM = ReactDOM;
(window as any).ReactJSXRuntime = ReactJSXRuntime;
(window as any).TanStackReactQuery = TanStackReactQuery;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
