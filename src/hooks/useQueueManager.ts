import { useState, useEffect, useCallback } from 'react';
import { queueManager } from '../utils/queueManager';
import type { QueuedRequest, SongRequest, QueueStats } from '../types';

export function useQueueManager() {
  const [queue, setQueue] = useState<QueuedRequest[]>([]);
  const [stats, setStats] = useState<QueueStats>(queueManager.getStats());

  // Update local state when queue changes
  const refreshQueue = useCallback(() => {
    setQueue(queueManager.getQueue());
    setStats(queueManager.getStats());
  }, []);

  // Add a new request to the queue
  const addRequest = useCallback((request: SongRequest) => {
    const queuedRequest = queueManager.addRequest(request);
    refreshQueue();
    return queuedRequest;
  }, [refreshQueue]);

  // Complete a request
  const completeRequest = useCallback((id: string) => {
    queueManager.completeRequest(id);
    refreshQueue();
  }, [refreshQueue]);

  // Update priority for a request
  const updatePriority = useCallback((id: string) => {
    queueManager.updatePriority(id);
    refreshQueue();
  }, [refreshQueue]);

  // Clear the queue
  const clearQueue = useCallback(() => {
    queueManager.clear();
    refreshQueue();
  }, [refreshQueue]);

  // Keep local state in sync with queue manager
  useEffect(() => {
    refreshQueue();

    // Set up an interval to periodically refresh the queue
    const interval = setInterval(refreshQueue, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [refreshQueue]);

  return {
    queue,
    stats,
    addRequest,
    completeRequest,
    updatePriority,
    clearQueue,
  };
}