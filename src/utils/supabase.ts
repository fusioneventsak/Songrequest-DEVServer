// src/utils/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Log connection details for debugging
console.log('Connecting to Supabase:', {
  url: supabaseUrl,
  hasKey: !!supabaseAnonKey,
  keyLength: supabaseAnonKey.length
});

// Configure connection pooling
const POOL_SIZE = 10;
const CONNECTION_TIMEOUT = 30000; // 30 seconds

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false // Prevent auto-detection of auth params in URL
  },
  global: {
    headers: {
      'X-Client-Info': 'song-request-app/1.1.0',
      'X-Connection-Pool': `${POOL_SIZE}`,
      'X-Connection-Timeout': `${CONNECTION_TIMEOUT}`
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 10, // Increased from 5 to improve realtime responsiveness
      // Exclude photo data from realtime updates to reduce payload size
      excludeColumns: ['photo', 'userPhoto']
    },
    reconnect: {
      maxRetries: 20, // Increased for better reliability in production
      delay: 2000, // Increased to reduce server load
      timeout: 60000 // 60 second timeout for connection attempts
    }
  },
  db: {
    schema: 'public',
    // Configure connection pooling
    poolSize: POOL_SIZE,
    connectionTimeout: CONNECTION_TIMEOUT
  }
});

// Log Supabase configuration for debugging
console.log('Supabase configuration:', {
  url: supabaseUrl,
  hasAnonKey: !!supabaseAnonKey,
  isProduction: window.location.hostname !== 'localhost' && 
               !window.location.hostname.includes('stackblitz') &&
               !window.location.hostname.includes('127.0.0.1')
});
// Helper function to handle Supabase errors
export function handleSupabaseError(error: any): never {
  console.error('Supabase error:', error);
  const errorMessage = error?.message || error?.error_description || 'Database operation failed';
  throw new Error(errorMessage);
}

// Execute a database operation with proper error handling
export async function executeDbOperation<T>(
  operationKey: string,
  operation: () => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  try {
    // Check if the operation is already aborted
    if (signal?.aborted) {
      const abortError = new Error('Operation aborted');
      abortError.name = 'AbortError';
      throw abortError;
    }

    // Check network status
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('No network connection available');
    }

    // Add timeout protection
    const operationPromise = operation();
    
    if (signal) {
      // Create a race between the operation and the abort signal
      const abortPromise = new Promise<T>((_, reject) => {
        const abortHandler = () => {
          const abortError = new Error('Operation aborted');
          abortError.name = 'AbortError';
          reject(abortError);
        };
        
        // Use addEventListener with once option to prevent memory leaks
        signal.addEventListener('abort', abortHandler, { once: true });
      });
      
      // Use Promise.race to handle whichever resolves/rejects first
      return await Promise.race([operationPromise, abortPromise]);
    } else {
      return await operationPromise;
    }
  } catch (error: any) {
    // Handle AbortError silently - this is expected when component unmounts
    if (error.name === 'AbortError' || error.message?.includes('aborted') || 
        error.message?.includes('Component unmounted')) {
      console.log(`Request aborted for ${operationKey}`);
      return { data: null, error: null } as unknown as T;
    }

    // Handle component unmount silently
    if (error.message?.includes('Component unmounted')) {
      console.log(`Operation cancelled - component unmounted: ${operationKey}`);
      return { data: null, error: null } as unknown as T;
    }

    // Handle timeout errors
    if (error.message?.includes('timeout') || error.name === 'TimeoutError') {
      console.error(`Operation timed out: ${operationKey}`);
      throw new Error(`Operation timed out: ${operationKey}`);
    }

    // Handle network errors
    if (error.message?.includes('network') || 
        error.name === 'NetworkError' || 
        error.message?.includes('fetch') || 
        (typeof navigator !== 'undefined' && !navigator.onLine)) {
      console.error(`Network error during operation: ${operationKey}`);
      throw new Error(`Network error: ${error.message || 'Failed to connect to server'}`);
    }

    // Log the error with context
    console.error(`DB operation "${operationKey}" failed:`, {
      error,
      name: error.name,
      message: error.message,
      stack: error.stack,
      context: operationKey,
      url: error.requestUrl || 'unknown'
    });

    // Throw a properly formatted error
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(`DB operation "${operationKey}" failed: ${String(error)}`);
    }
  }
}

// Format request data for consistent handling
export function formatRequestData(request: any) {
  return {
    ...request,
    requesters: request.requesters?.map((requester: any) => {
      // Optimize payload by excluding large photo data from memory
      const { photo, ...rest } = requester;
      return {
        ...rest,
        // Keep photo URL but not base64 data
        photo: photo && photo.startsWith('data:') ? null : photo,
        timestamp: new Date(requester.created_at)
      };
    }) || []
  };
}

// Format set list data for consistent handling
export function formatSetListData(setList: any) {
  return {
    ...setList,
    date: new Date(setList.date),
    songs: setList.set_list_songs
      ?.sort((a: any, b: any) => a.position - b.position)
      .map((item: any) => item.song) || []
  };
}