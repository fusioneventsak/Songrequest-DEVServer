export interface SongRequest {
  id: string;
  title: string;
  artist?: string;
  requesters: {
    id: string;
    name: string;
    photo: string;
    message?: string;
    timestamp: string;
  }[];
  votes: number;
  status: 'pending' | 'approved' | 'rejected' | 'played';
  isLocked?: boolean;
  isPlayed?: boolean;
  createdAt: string;
}

export interface RequestFormData {
  title: string;
  artist: string;
  requestedBy: string;
  userPhoto: string;
  message?: string;
  userId?: string;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  genre?: string;
  key?: string;
  notes?: string;
  lastPlayed?: Date;
  albumArtUrl?: string;
}

export interface SetList {
  id: string;
  name: string;
  date: Date | string;
  songs: Song[];
  notes?: string;
  isActive?: boolean;
}

export interface User {
  id?: string;
  name: string;
  photo: string;
}

export interface QueuedRequest {
  id: string;
  request: SongRequest;
  priority: number;
  timestamp: Date;
}

export interface QueueStats {
  totalRequests: number;
  activeRequests: number;
  completedRequests: number;
  averageWaitTime: number;
}