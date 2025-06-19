import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { 
      hasError: true, 
      error,
      errorInfo: null
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console for debugging
    console.error('Error caught by boundary:', {
      error,
      errorInfo,
      name: error.name,
      message: error.message,
      stack: error.stack
    });

    this.setState({
      error,
      errorInfo
    });
  }

  private getErrorMessage(): string {
    const { error } = this.state;
    
    if (!error) {
      return 'An unexpected error occurred';
    }

    // Handle different error types
    if (error instanceof TypeError) {
      return `Type Error: ${error.message || 'An unexpected type error occurred'}`;
    }

    if (error instanceof ReferenceError) {
      return `Reference Error: ${error.message || 'An unexpected reference error occurred'}`;
    }

    // Return error message or fallback
    return error.message || 'An unexpected error occurred';
  }

  private getComponentStack(): string | null {
    return this.state.errorInfo?.componentStack || null;
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0" />
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-red-400">Something went wrong</h3>
              <p className="text-sm text-red-300">
                {this.getErrorMessage()}
              </p>
              {process.env.NODE_ENV === 'development' && this.getComponentStack() && (
                <details className="mt-2">
                  <summary className="text-sm text-red-300 cursor-pointer hover:text-red-200">
                    View component stack
                  </summary>
                  <pre className="mt-2 text-xs text-red-300 overflow-auto p-2 bg-red-500/5 rounded">
                    {this.getComponentStack()}
                  </pre>
                </details>
              )}
              <button
                onClick={() => window.location.reload()}
                className="mt-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-md text-sm transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}