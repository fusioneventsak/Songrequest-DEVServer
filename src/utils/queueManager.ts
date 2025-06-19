import { v4 as uuidv4 } from 'uuid';
import type { QueuedRequest, SongRequest, QueueStats } from '../types';

class QueueManager {
  private queue: QueuedRequest[] = [];
  private stats: QueueStats = {
    totalRequests: 0,
    activeRequests: 0,
    completedRequests: 0,
    averageWaitTime: 0,
  };
  private totalWaitTime = 0;

  // Add a new request to the queue
  public addRequest(request: SongRequest): QueuedRequest {
    const queuedRequest: QueuedRequest = {
      id: uuidv4(),
      request,
      priority: this.calculatePriority(request),
      timestamp: new Date(),
    };

    this.queue.push(queuedRequest);
    this.sortQueue();

    // Update stats
    this.stats.totalRequests++;
    this.stats.activeRequests = this.queue.length;

    return queuedRequest;
  }

  // Calculate priority score for a request
  private calculatePriority(request: SongRequest): number {
    // Base priority starts at 1
    let priority = 1;

    // Add points for votes
    priority += request.votes;

    // Add points for unique requesters
    priority += request.requesters.length;

    // Normalize by time to ensure older requests don't get buried
    const ageInMinutes = (Date.now() - new Date(request.createdAt).getTime()) / (1000 * 60);
    const ageFactor = Math.min(ageInMinutes / 30, 1); // Cap at 30 minutes
    priority += ageFactor * 2; // Add up to 2 points for age

    return priority;
  }

  // Sort the queue based on priority
  private sortQueue(): void {
    this.queue.sort((a, b) => {
      // First compare priorities
      const priorityDiff = b.priority - a.priority;
      if (priorityDiff !== 0) return priorityDiff;

      // If priorities are equal, sort by timestamp (older first)
      return a.timestamp.getTime() - b.timestamp.getTime();
    });
  }

  // Get all requests in priority order
  public getQueue(): QueuedRequest[] {
    return [...this.queue];
  }

  // Get a specific request by ID
  public getRequest(id: string): QueuedRequest | undefined {
    return this.queue.find(qr => qr.id === id);
  }

  // Mark a request as completed
  public completeRequest(id: string): void {
    const request = this.getRequest(id);
    if (!request) return;

    // Calculate wait time
    const waitTime = Date.now() - request.timestamp.getTime();
    this.totalWaitTime += waitTime;

    // Update stats
    this.stats.completedRequests++;
    this.stats.activeRequests--;
    this.stats.averageWaitTime = this.totalWaitTime / this.stats.completedRequests;

    // Remove from queue
    this.queue = this.queue.filter(qr => qr.id !== id);
  }

  // Update priority for a request (e.g., after receiving votes)
  public updatePriority(id: string): void {
    const request = this.getRequest(id);
    if (!request) return;

    request.priority = this.calculatePriority(request.request);
    this.sortQueue();
  }

  // Get queue statistics
  public getStats(): QueueStats {
    return { ...this.stats };
  }

  // Clear the queue
  public clear(): void {
    this.queue = [];
    this.stats.activeRequests = 0;
  }
}

// Export singleton instance
export const queueManager = new QueueManager();