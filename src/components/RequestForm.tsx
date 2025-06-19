import React, { useState } from 'react';
import { Music } from 'lucide-react';
import type { RequestFormData } from '../types';

interface RequestFormProps {
  onSubmit: (data: RequestFormData) => void;
}

export function RequestForm({ onSubmit }: RequestFormProps) {
  const [formData, setFormData] = useState<RequestFormData>({
    title: '',
    artist: '',
    requestedBy: '',
    userPhoto: '',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({ title: '', artist: '', requestedBy: '', userPhoto: '', message: '' });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="glass-effect rounded-lg p-6 space-y-4">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-white mb-2">
          Song Title *
        </label>
        <input
          type="text"
          id="title"
          name="title"
          required
          value={formData.title}
          onChange={handleChange}
          className="input-field"
          placeholder="Enter song title"
        />
      </div>
      <div>
        <label htmlFor="artist" className="block text-sm font-medium text-white mb-2">
          Artist
        </label>
        <input
          type="text"
          id="artist"
          name="artist"
          value={formData.artist}
          onChange={handleChange}
          className="input-field"
          placeholder="Enter artist name"
        />
      </div>
      <div>
        <label htmlFor="requestedBy" className="block text-sm font-medium text-white mb-2">
          Your Name *
        </label>
        <input
          type="text"
          id="requestedBy"
          name="requestedBy"
          required
          value={formData.requestedBy}
          onChange={handleChange}
          className="input-field"
          placeholder="Enter your name"
        />
      </div>
      <button
        type="submit"
        className="neon-button w-full flex items-center justify-center"
      >
        <Music className="w-4 h-4 mr-2" />
        Submit Request
      </button>
    </form>
  );
}