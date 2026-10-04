'use client'

import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Optional fallback UI. If not provided, a default error card is shown. */
  fallback?: ReactNode
  /** Name shown in the error card, e.g. "Doctor Dashboard" */
  componentName?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      `[ErrorBoundary${this.props.componentName ? `: ${this.props.componentName}` : ''}]`,
      error,
      errorInfo.componentStack,
    )
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="min-h-[300px] flex items-center justify-center p-8">
          <div className="border border-red-200 bg-red-50 p-8 max-w-lg w-full text-center">
            <div className="inline-flex items-center justify-center p-3 bg-red-600 text-white mb-4">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold uppercase tracking-tight mb-2 text-red-900">
              {this.props.componentName
                ? `${this.props.componentName} Error`
                : 'Something Went Wrong'}
            </h2>
            <p className="text-sm text-red-700 font-mono mb-6 break-words">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-mono uppercase tracking-widest hover:bg-black/80 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
