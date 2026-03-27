import { Suspense, useEffect, useState, type ComponentType } from 'react';
import { PluginErrorBoundary } from './PluginErrorBoundary';
import { PluginProvider } from './PluginContext';

interface PluginRegistry {
  get(moduleName: string): Promise<{ default: ComponentType }>;
}

declare global {
  interface Window {
    [key: `__acp_plugin_${string}`]: PluginRegistry | undefined;
  }
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#00D9FF] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-[#6a6a6a]">Loading plugin...</span>
      </div>
    </div>
  );
}

const LOAD_TIMEOUT_MS = 10_000;
const moduleCache = new Map<string, ComponentType>();
const failedPlugins = new Set<string>();

async function loadRemoteModule(pluginId: string, moduleName: string): Promise<ComponentType> {
  const cacheKey = `${pluginId}/${moduleName}`;
  if (moduleCache.has(cacheKey)) {
    return moduleCache.get(cacheKey)!;
  }

  // Don't retry plugins that already failed in this session
  if (failedPlugins.has(pluginId)) {
    throw new Error(`Plugin ${pluginId} failed to load previously`);
  }

  // Plugin static files served under /api/v1/p-static/{id}/
  // Separate from /api/v1/plugins/ to avoid FastAPI route conflicts
  const remoteUrl = `/api/v1/p-static/${pluginId}/dist/remoteEntry.js`;

  await new Promise<void>((resolve, reject) => {
    if (window[`__acp_plugin_${pluginId}`]) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = remoteUrl;
    script.type = 'module';

    const timeoutId = setTimeout(() => {
      cleanup();
      script.remove();
      reject(new Error(`Plugin ${pluginId} load timed out after ${LOAD_TIMEOUT_MS / 1000}s`));
    }, LOAD_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timeoutId);
      script.onload = null;
      script.onerror = null;
    };

    script.onload = () => {
      cleanup();
      resolve();
    };
    script.onerror = () => {
      cleanup();
      // Remove the failed script tag from DOM to prevent accumulation
      script.remove();
      reject(new Error(`Failed to load plugin: ${pluginId}`));
    };

    document.head.appendChild(script);
  });

  const pluginRegistry = window[`__acp_plugin_${pluginId}`];
  if (!pluginRegistry) {
    failedPlugins.add(pluginId);
    throw new Error(`Plugin ${pluginId} did not register itself`);
  }

  const mod = await pluginRegistry.get(moduleName);
  if (!mod || !mod.default) {
    throw new Error(`Module ${moduleName} not found in plugin ${pluginId}`);
  }

  const component = mod.default as ComponentType;
  moduleCache.set(cacheKey, component);
  return component;
}

export function PluginLoader({
  pluginId,
  pluginName,
  moduleName = './pages/Main',
}: {
  pluginId: string;
  pluginName?: string;
  moduleName?: string;
}) {
  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Reset state when pluginId/moduleName changes
    setComponent(null);
    setError(null);

    loadRemoteModule(pluginId, moduleName)
      .then(comp => {
        if (!cancelled) setComponent(() => comp);
      })
      .catch(err => {
        if (!cancelled) {
          failedPlugins.add(pluginId);
          setError(err);
        }
      });

    return () => { cancelled = true; };
  }, [pluginId, moduleName]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8">
          <p className="text-[#FF4444] text-sm mb-2">Failed to load plugin</p>
          <p className="text-[#6a6a6a] text-xs mb-4">{error.message}</p>
          <button
            onClick={() => {
              failedPlugins.delete(pluginId);
              moduleCache.delete(`${pluginId}/${moduleName}`);
              setError(null);
            }}
            className="text-xs text-[#00D9FF] hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!Component) {
    return <PageLoader />;
  }

  return (
    <PluginErrorBoundary pluginId={pluginId} pluginName={pluginName}>
      <PluginProvider pluginId={pluginId}>
        <Suspense fallback={<PageLoader />}>
          <Component />
        </Suspense>
      </PluginProvider>
    </PluginErrorBoundary>
  );
}
