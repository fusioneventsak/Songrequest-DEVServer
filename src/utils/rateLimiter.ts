import { v4 as uuidv4 } from 'uuid';
import LZString from 'lz-string';

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const DEFAULT_LIMIT = 60; // Default request limit per window
const HIGH_VOLUME_LIMIT = 150; // Higher limit for authenticated users
const REQUEST_SIZE_LIMIT = 200 * 1024; // 200KB payload limit (increased)

// Token bucket configuration for burst handling
const REFILL_RATE = 2; // Increased tokens per second (was 1)
const MAX_TOKENS = 15; // Increased maximum tokens (was 10)

// Rate limit tracking with expiration
interface RateLimitTracker {
  count: number;
  resetTime: number;
  tokens: number;
  lastRefill: number;
  lastRequest: number;
  recentRequests: number[];
}

// Store rate limit data by client ID with LRU expiration
class RateLimitStore {
  private store = new Map<string, RateLimitTracker>();
  private maxSize = 10000; // Maximum clients to track
  
  constructor() {
    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60 * 1000);
  }
  
  // Get rate limit data for a client
  get(key: string): RateLimitTracker | undefined {
    return this.store.get(key);
  }
  
  // Set rate limit data for a client
  set(key: string, value: RateLimitTracker): void {
    // Check if we need to evict entries
    if (this.store.size >= this.maxSize) {
      this.evictOldest();
    }
    
    this.store.set(key, value);
  }
  
  // Remove rate limit data for a client
  delete(key: string): boolean {
    return this.store.delete(key);
  }
  
  // Get all entries
  entries(): IterableIterator<[string, RateLimitTracker]> {
    return this.store.entries();
  }
  
  // Clean up expired entries
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, data] of this.store.entries()) {
      // Remove entries that have expired or haven't been used in 10 minutes
      if (data.resetTime < now || (now - data.lastRequest) > 10 * 60 * 1000) {
        this.store.delete(key);
        removed++;
      }
    }
    
    if (removed > 0) {
      console.log(`Cleaned up ${removed} expired rate limit entries`);
    }
  }
  
  // Evict oldest entries when store is full
  private evictOldest(): void {
    const now = Date.now();
    let oldestTime = now;
    let oldestKey: string | null = null;
    
    // Find the oldest entry based on last request time
    for (const [key, data] of this.store.entries()) {
      if (data.lastRequest < oldestTime) {
        oldestTime = data.lastRequest;
        oldestKey = key;
      }
    }
    
    // Remove the oldest entry
    if (oldestKey) {
      this.store.delete(oldestKey);
    }
  }
}

// Create store singleton
const rateLimitStore = new RateLimitStore();

/**
 * Generate a client fingerprint from available data
 */
export function getClientFingerprint(): string {
  // Try to get existing fingerprint from storage
  let fingerprint = localStorage.getItem('clientFingerprint');
  
  if (!fingerprint) {
    // Create a new fingerprint
    fingerprint = uuidv4();
    
    // Store in localStorage for persistence
    try {
      localStorage.setItem('clientFingerprint', fingerprint);
    } catch (e) {
      console.error('Error storing client fingerprint:', e);
    }
  }
  
  return fingerprint;
}

/**
 * Check if a request should be rate limited with enhanced tracking
 */
export function checkRateLimit(
  endpoint: string,
  limit: number = DEFAULT_LIMIT,
  isAuthenticated: boolean = false
): { 
  allowed: boolean; 
  retryAfter?: number;
  remainingRequests?: number;
  resetTime?: number;
} {
  const clientId = getClientFingerprint();
  const key = `${clientId}:${endpoint}`;
  const now = Date.now();
  
  // Apply higher limits for authenticated users
  const effectiveLimit = isAuthenticated ? HIGH_VOLUME_LIMIT : limit;
  
  // Get or initialize rate limit data
  let limitData = rateLimitStore.get(key);
  if (!limitData || limitData.resetTime < now) {
    // Reset limit if window expired
    limitData = {
      count: 0,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
      tokens: MAX_TOKENS,
      lastRefill: now,
      lastRequest: now,
      recentRequests: []
    };
    rateLimitStore.set(key, limitData);
  }
  
  // Update last request time
  limitData.lastRequest = now;
  
  // Track request times for burst detection
  limitData.recentRequests.push(now);
  
  // Only keep last 10 request times
  if (limitData.recentRequests.length > 10) {
    limitData.recentRequests.shift();
  }
  
  // Detect rapid bursts (more than 5 requests in 2 seconds)
  const burstThreshold = now - 2000; // 2 seconds ago
  const recentBurst = limitData.recentRequests.filter(time => time >= burstThreshold).length;
  
  // If user is sending too many requests in a burst, reduce tokens faster
  const burstPenalty = recentBurst > 5 ? 2 : 1;
  
  // Refill token bucket based on time elapsed
  const secondsElapsed = (now - limitData.lastRefill) / 1000;
  const tokensToAdd = Math.floor(secondsElapsed * REFILL_RATE);
  if (tokensToAdd > 0) {
    limitData.tokens = Math.min(limitData.tokens + tokensToAdd, MAX_TOKENS);
    limitData.lastRefill = now;
  }
  
  // Calculate remaining requests
  const remainingRequests = Math.max(0, effectiveLimit - limitData.count);
  
  // Check if request is allowed
  if (limitData.count < effectiveLimit && limitData.tokens >= burstPenalty) {
    limitData.count++;
    limitData.tokens -= burstPenalty;
    return { 
      allowed: true,
      remainingRequests,
      resetTime: limitData.resetTime
    };
  }
  
  // Request is rate limited, calculate retry-after time
  const retryAfter = Math.ceil((limitData.resetTime - now) / 1000);
  return { 
    allowed: false,
    retryAfter,
    remainingRequests: 0,
    resetTime: limitData.resetTime
  };
}

/**
 * Check request size to prevent large payload attacks
 */
export function checkRequestSize(data: any): boolean {
  try {
    let size: number;
    
    if (typeof data === 'string') {
      size = new Blob([data]).size;
    } else {
      try {
        // Attempt to stringify and compress the data to get a better size estimate
        const jsonStr = JSON.stringify(data);
        const compressed = LZString.compressToUTF16(jsonStr);
        size = new Blob([compressed]).size;
      } catch (e) {
        // Fallback to simple stringify
        const jsonStr = JSON.stringify(data);
        size = new Blob([jsonStr]).size;
      }
    }
    
    return size <= REQUEST_SIZE_LIMIT;
  } catch (e) {
    console.error('Error checking request size:', e);
    return false;
  }
}

/**
 * Rate limiting middleware for API requests
 */
export async function applyRateLimit<T>(
  endpoint: string,
  operation: () => Promise<T>,
  limit: number = DEFAULT_LIMIT,
  isAuthenticated: boolean = false
): Promise<T> {
  const { allowed, retryAfter, remainingRequests, resetTime } = checkRateLimit(endpoint, limit, isAuthenticated);
  
  if (!allowed) {
    throw new Error(`Rate limit exceeded. Please try again in ${retryAfter} seconds. Reset at ${new Date(resetTime || 0).toLocaleTimeString()}`);
  }
  
  return operation();
}