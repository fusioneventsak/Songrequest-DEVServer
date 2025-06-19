import pLimit from 'p-limit';
import { v4 as uuidv4 } from 'uuid';

// Request priorities
export enum RequestPriority {
  HIGH = 0,
  MEDIUM = 1,
  LOW = 2
}

// Request item in queue
interface QueueItem<T> {
  id: string;
  operation: () => Promise<T>;
  priority: RequestPriority;
  timestamp: number;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
  retryCount: number;
  maxRetries: number;
}

// Queue processing statistics
interface QueueStats {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  currentQueueSize: number;
  peakQueueSize: number;
  processingTime: {
    min: number;
    max: number;
    avg: number;
  };
}

/**
 * Improved, resilient request queue with better error handling
 */
class RequestQueue {
  private queue: QueueItem<any>[] = [];
  private inProgress = new Set<string>();
  private concurrencyLimit: pLimit.Limit;
  private isProcessing = false;
  private maxQueueSize: number;
  private stats: QueueStats = {
    totalProcessed: 0,
    successCount: 0,
    failureCount: 0,
    currentQueueSize: 0,
    peakQueueSize: 0,
    processingTime: {
      min: Number.MAX_SAFE_INTEGER,
      max: 0,
      avg: 0,
    },
  };
  private totalProcessingTime = 0;
  private onQueueFull: (() => void) | null = null;
  private onQueueEmpty: (() => void) | null = null;
  
  constructor(concurrency: number = 5, maxQueueSize: number = 150) {
    this.concurrencyLimit = pLimit(concurrency);
    this.maxQueueSize = maxQueueSize;
    
    // Schedule periodic cleanup
    setInterval(() => this.cleanStaleRequests(), 60000); // Clean every minute
  }

  /**
   * Set callback for when queue becomes full
   */
  public setQueueFullCallback(callback: () => void): void {
    this.onQueueFull = callback;
  }
  
  /**
   * Set callback for when queue becomes empty
   */
  public setQueueEmptyCallback(callback: () => void): void {
    this.onQueueEmpty = callback;
  }
  
  /**
   * Add a request to the queue with priority and retry options
   */
  public async enqueue<T>(
    operation: () => Promise<T>,
    priority: RequestPriority = RequestPriority.MEDIUM,
    maxRetries: number = 3
  ): Promise<T> {
    // Check if queue is within capacity limits
    if (this.queue.length >= this.maxQueueSize) {
      // Trigger queue full callback if provided
      if (this.onQueueFull) {
        this.onQueueFull();
      }
      
      throw new Error(`Request queue is full (${this.queue.length}/${this.maxQueueSize}). Please try again later.`);
    }
    
    return new Promise<T>((resolve, reject) => {
      const id = uuidv4();
      
      this.queue.push({
        id,
        operation,
        priority,
        timestamp: Date.now(),
        resolve,
        reject,
        retryCount: 0,
        maxRetries,
      });
      
      // Update stats
      this.stats.currentQueueSize = this.queue.length;
      if (this.queue.length > this.stats.peakQueueSize) {
        this.stats.peakQueueSize = this.queue.length;
      }
      
      // Sort queue by priority, then by timestamp
      this.queue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return a.timestamp - b.timestamp;
      });
      
      // Start processing if not already
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }
  
  /**
   * Process items in the queue concurrently with retry logic
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      while (this.queue.length > 0) {
        const nextItem = this.queue.shift();
        if (!nextItem) continue;
        
        // Skip if already in progress (shouldn't happen, but safety check)
        if (this.inProgress.has(nextItem.id)) continue;
        
        // Mark as in progress
        this.inProgress.add(nextItem.id);
        
        // Execute with concurrency control
        this.concurrencyLimit(async () => {
          const startTime = Date.now();
          
          try {
            const result = await nextItem.operation();
            
            // Track processing time
            const processingTime = Date.now() - startTime;
            this.updateProcessingTimeStats(processingTime);
            
            // Update success stats
            this.stats.totalProcessed++;
            this.stats.successCount++;
            
            nextItem.resolve(result);
          } catch (error) {
            // Handle retries if applicable
            if (nextItem.retryCount < nextItem.maxRetries) {
              // Increment retry count
              nextItem.retryCount++;
              
              // Add back to queue with exponential backoff priority
              const backoffPriority = Math.min(
                nextItem.priority + nextItem.retryCount, 
                RequestPriority.LOW
              );
              
              // Re-add to queue with backoff
              this.queue.push({
                ...nextItem,
                priority: backoffPriority,
                timestamp: Date.now() + (nextItem.retryCount * 1000) // Increasing delay
              });
              
              console.warn(`Retrying operation (attempt ${nextItem.retryCount}/${nextItem.maxRetries})`);
            } else {
              // Max retries reached, reject the promise
              // Update failure stats
              this.stats.totalProcessed++;
              this.stats.failureCount++;
              
              // Ensure we're always passing proper Error objects to reject
              if (error instanceof Error) {
                nextItem.reject(error);
              } else {
                // Create a proper Error object with a descriptive message
                nextItem.reject(new Error(`Queue operation failed after ${nextItem.maxRetries} retries: ${String(error)}`));
              }
            }
          } finally {
            this.inProgress.delete(nextItem.id);
            this.stats.currentQueueSize = this.queue.length;
            
            // Trigger queue empty callback if applicable
            if (this.queue.length === 0 && this.inProgress.size === 0 && this.onQueueEmpty) {
              this.onQueueEmpty();
            }
          }
        });
      }
    } finally {
      this.isProcessing = false;
      
      // If new items were added during processing, start again
      if (this.queue.length > 0) {
        this.processQueue();
      }
    }
  }
  
  /**
   * Update processing time statistics
   */
  private updateProcessingTimeStats(processingTime: number): void {
    // Update min/max processing times
    if (processingTime < this.stats.processingTime.min) {
      this.stats.processingTime.min = processingTime;
    }
    if (processingTime > this.stats.processingTime.max) {
      this.stats.processingTime.max = processingTime;
    }
    
    // Update average processing time
    this.totalProcessingTime += processingTime;
    this.stats.processingTime.avg = this.totalProcessingTime / this.stats.totalProcessed;
  }
  
  /**
   * Clean stale requests from the queue (older than 5 minutes)
   */
  private cleanStaleRequests(): void {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes
    
    // Filter out stale requests
    const staleItems = this.queue.filter(item => (now - item.timestamp) > timeout);
    
    // Remove stale items from the queue
    if (staleItems.length > 0) {
      console.warn(`Removing ${staleItems.length} stale requests from queue`);
      
      // Reject all stale items
      staleItems.forEach(item => {
        item.reject(new Error('Request timed out in queue'));
      });
      
      // Update the queue
      this.queue = this.queue.filter(item => (now - item.timestamp) <= timeout);
      
      // Update stats
      this.stats.currentQueueSize = this.queue.length;
    }
  }
  
  /**
   * Get current queue length
   */
  public get length(): number {
    return this.queue.length;
  }
  
  /**
   * Get number of requests currently being processed
   */
  public get activeCount(): number {
    return this.inProgress.size;
  }
  
  /**
   * Get queue statistics
   */
  public getStats(): QueueStats {
    return { ...this.stats };
  }
  
  /**
   * Clear the queue (rejects all pending requests)
   */
  public clear(reason: string = 'Queue cleared'): void {
    const queueSize = this.queue.length;
    
    for (const item of this.queue) {
      item.reject(new Error(reason));
    }
    
    this.queue = [];
    this.stats.currentQueueSize = 0;
    
    console.warn(`Cleared ${queueSize} pending requests from queue`);
  }
}

// Create global request queue instance
export const requestQueue = new RequestQueue();

/**
 * Enqueue a request for the song requests API
 */
export async function enqueueSongRequest<T>(
  operation: () => Promise<T>,
  priority: RequestPriority = RequestPriority.MEDIUM,
  maxRetries: number = 3
): Promise<T> {
  try {
    return await requestQueue.enqueue(operation, priority, maxRetries);
  } catch (error) {
    console.error('Error in song request queue processing:', error);
    // Ensure we're always throwing a proper Error object
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(`Request queueing failed: ${String(error)}`);
    }
  }
}