'use client';

import React from 'react';
import { AlertTriangle, ArrowLeft, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary that catches client-side JS errors
 * and shows a friendly error screen instead of a white screen.
 * Includes "Go to Dashboard" and "Try Again" recovery buttons.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleGoToDashboard = () => {
    // Reset state and navigate to dashboard
    this.setState({ hasError: false, error: null });
    // Use window.location for a hard reset to clear any corrupted state
    window.location.href = '/';
  };

  handleTryAgain = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Allow custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full text-center space-y-6">
            {/* Error Icon */}
            <div className="flex justify-center">
              <div className="size-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="size-8 text-destructive" />
              </div>
            </div>

            {/* Error Title */}
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">
                Something went wrong
              </h1>
              <p className="text-muted-foreground text-sm">
                An unexpected error occurred. Your data is safe — try refreshing the page or go back to the dashboard.
              </p>
            </div>

            {/* Error Details (collapsible for debugging) */}
            {this.state.error && (
              <details className="text-left">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                  Error details
                </summary>
                <pre className="mt-2 p-3 bg-muted rounded-md text-xs text-muted-foreground overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              </details>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={this.handleTryAgain}
                variant="outline"
                className="gap-2"
              >
                <RotateCcw className="size-4" />
                Try Again
              </Button>
              <Button
                onClick={this.handleGoToDashboard}
                className="gap-2"
              >
                <ArrowLeft className="size-4" />
                Go to Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
