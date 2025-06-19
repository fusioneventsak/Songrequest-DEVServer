import React, { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { searchITunes } from '../utils/itunes';
import type { Song } from '../types';

interface SongEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  song?: Song | null;
  onSave: (song: Song) => void;
  onAdd: (song: Omit<Song, 'id'>) => void;
}

export function SongEditorModal({ isOpen, onClose, song, onSave, onAdd }: SongEditorModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState<Omit<Song, 'id'>>({
    title: '',
    artist: '',
    genre: '',
    key: '',
    notes: '',
    albumArtUrl: '',
  });

  // Update form data when song prop changes
  useEffect(() => {
    if (song) {
      setFormData({
        title: song.title,
        artist: song.artist,
        genre: song.genre || '',
        key: song.key || '',
        notes: song.notes || '',
        albumArtUrl: song.albumArtUrl || '',
      });
    } else {
      setFormData({
        title: '',
        artist: '',
        genre: '',
        key: '',
        notes: '',
        albumArtUrl: '',
      });
    }
  }, [song]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name === 'genre') {
      const formattedValue = value
        .replace(/\s+/g, ' ')
        .replace(/\s*,\s*/g, ', ')
        .replace(/^,\s*/, '')
        .replace(/\s*,$/, '');
      
      setFormData(prev => ({
        ...prev,
        [name]: formattedValue
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsProcessing(true);
      
      // Search for album art
      const albumArtUrl = await searchITunes(formData.title, formData.artist);
      
      const cleanedGenre = formData.genre
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/\s*,\s*/g, ', ')
        .replace(/^,\s*/, '')
        .replace(/\s*,$/, '');

      const songData = {
        ...formData,
        genre: cleanedGenre,
        albumArtUrl
      };

      if (song) {
        // Update existing song
        const { error } = await supabase
          .from('songs')
          .update(songData)
          .eq('id', song.id);

        if (error) throw error;
        onSave({ id: song.id, ...songData });
      } else {
        // Add new song
        const { data, error } = await supabase
          .from('songs')
          .insert(songData)
          .select()
          .single();

        if (error) throw error;
        if (data) onAdd(data);
      }

      onClose();
    } catch (error) {
      console.error('Error saving song:', error);
      alert('Error saving song. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative glass-effect rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <button
          onClick={handleClose}
          disabled={isProcessing}
          className="absolute top-4 right-4 text-gray-400 hover:text-white disabled:opacity-50"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-xl font-bold text-white mb-6">
          {song ? 'Edit Song' : 'Add New Song'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium mb-2 text-white">Title *</label>
              <input
                type="text"
                id="title"
                name="title"
                required
                value={formData.title}
                onChange={handleInputChange}
                disabled={isProcessing}
                className="input-field"
                placeholder="Enter song title"
              />
            </div>
            <div>
              <label htmlFor="artist" className="block text-sm font-medium mb-2 text-white">Artist *</label>
              <input
                type="text"
                id="artist"
                name="artist"
                required
                value={formData.artist}
                onChange={handleInputChange}
                disabled={isProcessing}
                className="input-field"
                placeholder="Enter artist name"
              />
            </div>
            <div>
              <label htmlFor="genre" className="block text-sm font-medium mb-2 text-white">
                Genres
                <span className="text-gray-400 text-xs ml-2">
                  (separate with comma and space, e.g. "Rock, Pop, Dance")
                </span>
              </label>
              <input
                type="text"
                id="genre"
                name="genre"
                value={formData.genre}
                onChange={handleInputChange}
                disabled={isProcessing}
                className="input-field"
                placeholder="Rock, Pop, Dance"
              />
            </div>
            <div>
              <label htmlFor="key" className="block text-sm font-medium mb-2 text-white">Key</label>
              <input
                type="text"
                id="key"
                name="key"
                value={formData.key}
                onChange={handleInputChange}
                disabled={isProcessing}
                className="input-field"
                placeholder="Enter song key"
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="albumArtUrl" className="block text-sm font-medium mb-2 text-white">Album Art URL</label>
            <input
              type="url"
              id="albumArtUrl"
              name="albumArtUrl"
              value={formData.albumArtUrl}
              onChange={handleInputChange}
              disabled={isProcessing}
              className="input-field"
              placeholder="https://example.com/album-art.jpg"
            />
          </div>
          
          <div>
            <label htmlFor="notes" className="block text-sm font-medium mb-2 text-white">Notes</label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              disabled={isProcessing}
              className="input-field"
              rows={3}
              placeholder="Add any notes about the song..."
            />
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isProcessing}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="neon-button flex items-center disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {song ? 'Update Song' : 'Add Song'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}