import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  pluginId: string;
  pluginName?: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PluginErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[Plugin:${this.props.pluginId}]`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-4 max-w-md text-center p-8">
            <div className="p-3 rounded-full bg-[#FF8800]/10">
              <AlertTriangle size={24} className="text-[#FF8800]" />
            </div>
            <h3 className="text-white text-sm font-semibold">
              Plugin Error: {this.props.pluginName || this.props.pluginId}
            </h3>
            <p className="text-[#6a6a6a] text-xs">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#141414] text-[#8a8a8a] border border-[#2f2f2f] hover:bg-[#1A1A1A] transition-colors"
            >
              <RefreshCw size={12} />
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
