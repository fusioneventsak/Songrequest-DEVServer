/**
 * Browser-compatible caching implementation
 */

// Cache TTL (Time To Live) settings in seconds
const DEFAULT_TTL = 60; // 1 minute
const SONGS_TTL = 300; // 5 minutes
const REQUESTS_TTL = 30; // 30 seconds
const SET_LISTS_TTL = 300; // 5 minutes

// Cache size limits
const MAX_CACHE_SIZE = 50; // Maximum number of items in cache
const MAX_CACHE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit

// Cache item structure
interface CacheItem<T> {
  value: T;
  expires: number;
  size: number;
  lastAccessed: number;
}

/**
 * Memory-efficient caching service for browser environments
 */
class CacheService {
  private cache: Map<string, CacheItem<any>> = new Map();
  private totalSize: number = 0;
  private cleanupInterval: number;

  constructor() {
    // Run cleanup every minute
    this.cleanupInterval = window.setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Clear expired items and manage memory usage
   */
  private cleanup(): void {
    const now = Date.now();
    let deleted = 0;
    
    for (const [key, item] of this.cache.entries()) {
      // Remove expired items
      if (item.expires <= now) {
        this.cache.delete(key);
        this.totalSize -= item.size;
        deleted++;
      }
    }
    
    // Implement LRU eviction if we're still over memory limit
    if (this.totalSize > MAX_CACHE_SIZE_BYTES || this.cache.size > MAX_CACHE_SIZE) {
      this.evictLeastRecentlyUsed();
    }
    
    if (deleted > 0) {
      console.log(`Cache cleanup: removed ${deleted} expired items`);
    }
  }
  
  /**
   * Estimate size of object in bytes
   */
  private estimateSize(value: any): number {
    try {
      const json = JSON.stringify(value);
      // Estimate: 2 bytes per character in JSON
      return json.length * 2;
    } catch (e) {
      // Default size estimate if JSON serialization fails
      return 1024;
    }
  }

  /**
   * Evict least recently used items to make space
   */
  private evictLeastRecentlyUsed(): void {
    // Convert cache entries to array for sorting
    const entries = Array.from(this.cache.entries())
      .map(([key, item]) => ({ key, item }))
      .sort((a, b) => a.item.lastAccessed - b.item.lastAccessed);
    
    // Remove items until we're under the limit
    for (const entry of entries) {
      if (this.totalSize <= MAX_CACHE_SIZE_BYTES && this.cache.size <= MAX_CACHE_SIZE) {
        break;
      }
      
      this.cache.delete(entry.key);
      this.totalSize -= entry.item.size;
    }
  }

  /**
   * Store item in cache with TTL
   */
  set<T>(key: string, value: T, ttl: number = DEFAULT_TTL): boolean {
    // Skip caching if value is null or undefined
    if (value === null || value === undefined) {
      return false;
    }
    
    // Calculate expiration time
    const expires = Date.now() + (ttl * 1000);
    
    // Estimate item size
    const size = this.estimateSize(value);
    
    // If this single item is larger than our cache limit, don't cache it
    if (size > MAX_CACHE_SIZE_BYTES) {
      console.warn(`Item too large to cache: ${key} (${size} bytes)`);
      return false;
    }
    
    // Check if we need to make room
    if (this.cache.size >= MAX_CACHE_SIZE || (this.totalSize + size) > MAX_CACHE_SIZE_BYTES) {
      this.evictLeastRecentlyUsed();
    }
    
    // Store the item
    this.cache.set(key, {
      value,
      expires,
      size,
      lastAccessed: Date.now()
    });
    
    this.totalSize += size;
    return true;
  }

  /**
   * Get item from cache
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    const now = Date.now();
    
    // Check if item has expired
    if (item.expires <= now) {
      this.cache.delete(key);
      this.totalSize -= item.size;
      return null;
    }
    
    // Update last accessed time (for LRU)
    item.lastAccessed = now;
    
    return item.value as T;
  }

  /**
   * Delete item from cache
   */
  del(key: string): boolean {
    const item = this.cache.get(key);
    
    if (item) {
      this.cache.delete(key);
      this.totalSize -= item.size;
      return true;
    }
    
    return false;
  }

  /**
   * Clear all items from cache
   */
  clear(): void {
    this.cache.clear();
    this.totalSize = 0;
  }

  /**
   * Set songs with appropriate TTL
   */
  setSongs<T>(key: string, songs: T): boolean {
    return this.set(key, songs, SONGS_TTL);
  }

  /**
   * Set requests with appropriate TTL
   */
  setRequests<T>(key: string, requests: T): boolean {
    return this.set(key, requests, REQUESTS_TTL);
  }

  /**
   * Set set lists with appropriate TTL
   */
  setSetLists<T>(key: string, setLists: T): boolean {
    return this.set(key, setLists, SET_LISTS_TTL);
  }
}

// Create singleton instance
export const cacheService = new CacheService();