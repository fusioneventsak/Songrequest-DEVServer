import React from 'react';
import { ThumbsUp, Check, X, Music2 } from 'lucide-react';
import type { SongRequest } from '../types';

interface RequestListProps {
  requests: SongRequest[];
  onVote: (id: string) => void;
  onUpdateStatus: (id: string, status: SongRequest['status']) => void;
}

export function RequestList({ requests, onVote, onUpdateStatus }: RequestListProps) {
  const getStatusColor = (status: SongRequest['status']) => {
    switch (status) {
      case 'approved': return 'text-green-400';
      case 'rejected': return 'text-red-400';
      case 'played': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="space-y-4">
      {requests.map((request) => (
        <div
          key={request.id}
          className="glass-effect rounded-lg p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <img
              src={request.userPhoto}
              alt={`${request.requestedBy}'s photo`}
              className="w-12 h-12 rounded-full object-cover neon-border"
            />
            <div>
              <h3 className="font-medium text-white">{request.title}</h3>
              {request.artist && (
                <p className="text-gray-300">by {request.artist}</p>
              )}
              <p className="text-sm text-gray-400">
                Requested by: {request.requestedBy}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <span className="flex items-center">
              <span className="font-medium text-white mr-2">{request.votes}</span>
              <button
                onClick={() => onVote(request.id)}
                className="p-1 hover:bg-neon-purple/20 rounded text-neon-pink"
              >
                <ThumbsUp className="w-5 h-5" />
              </button>
            </span>
            
            <div className="flex space-x-2">
              <button
                onClick={() => onUpdateStatus(request.id, 'approved')}
                className="p-1 text-green-400 hover:bg-green-400/20 rounded-full"
              >
                <Check className="w-5 h-5" />
              </button>
              <button
                onClick={() => onUpdateStatus(request.id, 'rejected')}
                className="p-1 text-red-400 hover:bg-red-400/20 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
              <button
                onClick={() => onUpdateStatus(request.id, 'played')}
                className="p-1 text-blue-400 hover:bg-blue-400/20 rounded-full"
              >
                <Music2 className="w-5 h-5" />
              </button>
            </div>
            
            <span className={`text-sm font-medium ${getStatusColor(request.status)}`}>
              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}