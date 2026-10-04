interface ErrorContext {
  context: string
  userId?: string
  timestamp?: string
  [key: string]: any
}

interface SupabaseError {
  message?: string
  details?: string
  hint?: string
  code?: string
}

export class ErrorLogger {
  static logSupabaseError(error: SupabaseError, context: ErrorContext) {
    const errorDetails = {
      message: error?.message || 'Unknown Supabase error',
      details: error?.details || null,
      hint: error?.hint || null,
      code: error?.code || null,
      timestamp: new Date().toISOString(),
      ...context
    }
    
    console.error(`Supabase Error [${context.context}]:`, errorDetails)
    console.error('Full error object:', JSON.stringify(error, null, 2))
    
    return errorDetails
  }

  static logGenericError(error: unknown, context: ErrorContext) {
    const errorInfo = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null,
      timestamp: new Date().toISOString(),
      type: typeof error,
      ...context
    }
    
    console.error(`Generic Error [${context.context}]:`, errorInfo)
    console.error('Raw error object:', error)
    
    return errorInfo
  }

  static logNetworkError(error: any, context: ErrorContext) {
    const errorDetails = {
      message: error?.message || 'Network error occurred',
      status: error?.status || null,
      statusText: error?.statusText || null,
      url: error?.config?.url || null,
      method: error?.config?.method || null,
      timestamp: new Date().toISOString(),
      ...context
    }
    
    console.error(`Network Error [${context.context}]:`, errorDetails)
    
    return errorDetails
  }
}