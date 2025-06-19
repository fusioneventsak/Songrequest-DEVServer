import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Plus, Save, Trash2, Music4, Check, Edit2, X, Search, Loader2, Play, AlertCircle, Filter, Tags, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../utils/supabase';
import type { Song, SetList } from '../types';

interface SetListManagerProps {
  songs: Song[];
  setLists: SetList[];
  onCreateSetList: (setList: Omit<SetList, 'id'>) => void;
  onUpdateSetList: (setList: SetList) => void;
  onDeleteSetList: (id: string) => void;
  onSetActive: (id: string) => void;
}

export function SetListManager({
  songs,
  setLists,
  onCreateSetList,
  onUpdateSetList,
  onDeleteSetList,
  onSetActive,
}: SetListManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingSetList, setEditingSetList] = useState<SetList | null>(null);
  const [selectedSongs, setSelectedSongs] = useState<Song[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isActivating, setIsActivating] = useState<string | null>(null);
  const [expandedSetLists, setExpandedSetLists] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [isCreatingByGenre, setIsCreatingByGenre] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  const availableGenres = useMemo(() => {
    const genreSet = new Set<string>();
    
    songs.forEach(song => {
      if (song.genre) {
        song.genre.split(',').forEach(genre => {
          genreSet.add(genre.trim());
        });
      }
    });
    
    return Array.from(genreSet).sort();
  }, [songs]);

  const songsByGenre = useMemo(() => {
    if (selectedGenres.length === 0) return [];
    
    return songs.filter(song => {
      if (!song.genre) return false;
      
      const songGenres = song.genre.split(',').map(g => g.trim());
      return selectedGenres.some(genre => songGenres.includes(genre));
    });
  }, [songs, selectedGenres]);

  const toggleGenreSelection = useCallback((genre: string) => {
    setSelectedGenres(prev => 
      prev.includes(genre)
        ? prev.filter(g => g !== genre)
        : [...prev, genre]
    );
  }, []);

  const filteredSongs = useMemo(() => {
    let songsToFilter = isCreatingByGenre ? songsByGenre : songs;
    
    if (!searchTerm.trim()) return songsToFilter;
    
    const searchLower = searchTerm.toLowerCase();
    return songsToFilter.filter(song => {
      return (
        song.title.toLowerCase().includes(searchLower) ||
        song.artist.toLowerCase().includes(searchLower) ||
        (song.genre?.toLowerCase() || '').includes(searchLower)
      );
    });
  }, [songs, songsByGenre, searchTerm, isCreatingByGenre]);

  const toggleSongSelection = useCallback((song: Song) => {
    console.log('Toggling song selection:', song.title, 'Has album art:', !!song.albumArtUrl);
    setSelectedSongs(prev => {
      const isSelected = prev.find(s => s.id === song.id);
      if (isSelected) {
        return prev.filter(s => s.id !== song.id);
      } else {
        // Make sure we preserve the full song object including albumArtUrl
        const fullSong = { ...song };
        console.log('Adding song to selection:', fullSong.title, 'Album art:', fullSong.albumArtUrl);
        return [...prev, fullSong];
      }
    });
  }, []);

  const toggleSetListExpansion = useCallback((setListId: string) => {
    setExpandedSetLists(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(setListId)) {
        newExpanded.delete(setListId);
      } else {
        newExpanded.add(setListId);
      }
      return newExpanded;
    });
  }, []);

  const resetForm = useCallback(() => {
    setIsCreating(false);
    setEditingSetList(null);
    setSelectedSongs([]);
    setFormData({
      name: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
    setIsCreatingByGenre(false);
    setSelectedGenres([]);
    setSearchTerm('');
  }, []);

  const startEdit = useCallback((setList: SetList) => {
    console.log('Starting to edit setlist:', setList.name);
    console.log('Setlist songs with album art:', setList.songs?.filter(s => s.albumArtUrl).length, '/', setList.songs?.length);
    console.log('First setlist song:', setList.songs?.[0]);
    
    setEditingSetList(setList);
    setSelectedSongs(setList.songs || []);
    setFormData({
      name: setList.name,
      date: typeof setList.date === 'string' ? setList.date.split('T')[0] : setList.date.toISOString().split('T')[0],
      notes: setList.notes || '',
    });
    setIsCreating(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSongs.length === 0) return;

    setIsSaving(true);
    try {
      const setListData = {
        name: formData.name,
        date: formData.date,
        notes: formData.notes,
        songs: selectedSongs,
        isActive: false,
      };

      if (editingSetList) {
        await onUpdateSetList({ ...setListData, id: editingSetList.id });
      } else {
        await onCreateSetList(setListData);
      }

      resetForm();
    } catch (error) {
      console.error('Error saving set list:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetActive = async (id: string) => {
    setIsActivating(id);
    try {
      await onSetActive(id);
    } catch (error) {
      console.error('Error setting active set list:', error);
    } finally {
      setIsActivating(null);
    }
  };

  const handleDeleteSetList = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this set list?')) {
      await onDeleteSetList(id);
    }
  };

  const renderGenres = (genreString: string) => {
    if (!genreString) return null;
    
    return genreString.split(',').map((genre, index) => (
      <span 
        key={index} 
        className="inline-block px-1.5 py-0.5 mr-1 mb-1 text-xs rounded-full bg-neon-purple/20 text-gray-300"
      >
        {genre.trim()}
      </span>
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Set List Manager</h2>
        <button
          onClick={() => setIsCreating(true)}
          className="neon-button flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Set List
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleSubmit} className="glass-effect rounded-lg p-6 space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-white">
              {editingSetList ? 'Edit Set List' : 'Create New Set List'}
            </h3>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setIsCreatingByGenre(!isCreatingByGenre)}
                className={`px-3 py-1 text-sm rounded-md ${
                  isCreatingByGenre
                    ? 'bg-neon-pink text-white'
                    : 'bg-neon-purple/20 text-gray-300 hover:text-white'
                }`}
              >
                <Tags className="w-4 h-4 mr-1 inline" />
                By Genre
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
                Set List Name
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-neon-purple/10 border border-neon-purple/20 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-neon-pink"
                placeholder="Enter set list name"
                required
              />
            </div>

            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-300 mb-1">
                Date
              </label>
              <input
                type="date"
                id="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 bg-neon-purple/10 border border-neon-purple/20 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-neon-pink"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 bg-neon-purple/10 border border-neon-purple/20 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-neon-pink"
              placeholder="Optional notes for this set list"
              rows={3}
            />
          </div>

          {isCreatingByGenre && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Genres ({selectedGenres.length} selected)
              </label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto border border-neon-purple/20 rounded-md p-2">
                {availableGenres.map(genre => (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => toggleGenreSelection(genre)}
                    className={`px-2 py-1 text-xs rounded-full transition-colors ${
                      selectedGenres.includes(genre)
                        ? 'bg-neon-pink text-white'
                        : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {genre}
                  </button>
                ))}
              </div>
              {selectedGenres.length > 0 && (
                <p className="text-sm text-gray-400 mt-1">
                  {songsByGenre.length} songs match selected genres
                </p>
              )}
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-300">
                Select Songs ({selectedSongs.length} selected)
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search songs..."
                  className="pl-9 pr-3 py-1 text-sm bg-neon-purple/10 border border-neon-purple/20 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-neon-pink"
                />
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto border border-neon-purple/20 rounded-md">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-2">
                {filteredSongs.map(song => (
                  <div
                    key={song.id}
                    onClick={() => toggleSongSelection(song)}
                    className={`flex items-center justify-between p-2 rounded cursor-pointer ${
                      selectedSongs.find(s => s.id === song.id)
                        ? 'bg-neon-purple/20 border-neon-pink border'
                        : 'hover:bg-neon-purple/10'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      {/* Direct img like the working kiosk/user frontend */}
                      <div className="w-12 h-12 flex-shrink-0 relative">
                        {song.albumArtUrl ? (
                          <img
                            src={song.albumArtUrl}
                            alt={`${song.title} album art`}
                            className="w-12 h-12 object-cover rounded-md neon-border"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-md flex items-center justify-center bg-neon-purple/20 flex-shrink-0">
                            <Music4 className="w-6 h-6 text-neon-pink" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-white">{song.title}</p>
                        <p className="text-sm text-gray-300">{song.artist}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {renderGenres(song.genre)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {filteredSongs.length === 0 && (
                  <div className="col-span-2 text-center py-8 text-gray-400">
                    No songs match your search criteria
                  </div>
                )}
              </div>
            </div>
          </div>

          {selectedSongs.length > 0 && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium text-white">Selected Songs ({selectedSongs.length})</h4>
                {selectedSongs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedSongs([])}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto border border-neon-purple/20 rounded-lg p-2">
                {selectedSongs.map((song, index) => (
                  <div
                    key={`${song.id}`}
                    className="flex items-center justify-between p-2 bg-neon-purple/10 rounded"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-gray-400 text-sm">{index + 1}.</span>
                      {/* Direct img like the working kiosk/user frontend */}
                      <div className="w-12 h-12 flex-shrink-0 relative">
                        {song.albumArtUrl ? (
                          <img
                            src={song.albumArtUrl}
                            alt={`${song.title} album art`}
                            className="w-12 h-12 object-cover rounded-md neon-border"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-md flex items-center justify-center bg-neon-purple/20 flex-shrink-0">
                            <Music4 className="w-6 h-6 text-neon-pink" />
                          </div>
                        )}
                      </div>
                      <div>
                        <span className="font-medium text-white">{song.title}</span>
                        <p className="text-sm text-gray-300">{song.artist}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSongSelection(song);
                      }}
                      className="p-1 text-red-400 hover:bg-red-400/20 rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 rounded-md border border-neon-pink text-neon-pink hover:bg-neon-pink/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="neon-button flex items-center"
              disabled={isSaving || selectedSongs.length === 0}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {editingSetList ? 'Update Set List' : 'Create Set List'}
                </>
              )}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {setLists.length === 0 ? (
          <div className="glass-effect rounded-lg p-6 text-center">
            <AlertCircle className="w-12 h-12 text-neon-pink mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No Set Lists Yet</h3>
            <p className="text-gray-300 mb-4">
              Create your first set list to organize the songs your band will play.
            </p>
            <button
              onClick={() => setIsCreating(true)}
              className="neon-button flex items-center mx-auto"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Set List
            </button>
          </div>
        ) : (
          setLists.map((setList) => {
            const isExpanded = expandedSetLists.has(setList.id);
            const isActivatingThis = isActivating === setList.id;
            
            return (
              <div key={setList.id} className="glass-effect rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-medium text-white">{setList.name}</h3>
                      {setList.isActive && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-300">
                          <Play className="w-3 h-3 mr-1" />
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-300">
                      {new Date(setList.date).toLocaleDateString()} • {setList.songs?.length || 0} songs
                    </p>
                    {setList.notes && (
                      <p className="text-sm text-gray-400 mt-1">{setList.notes}</p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    {!setList.isActive ? (
                      <button
                        onClick={() => handleSetActive(setList.id)}
                        disabled={isActivatingThis}
                        className="px-3 py-1 text-sm rounded-md bg-green-500/20 text-green-300 hover:bg-green-500/30 disabled:opacity-50"
                      >
                        {isActivatingThis ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin inline" />
                            Activating...
                          </>
                        ) : (
                          'Set Active'
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSetActive(setList.id)}
                        disabled={isActivatingThis}
                        className="px-3 py-1 text-sm rounded-md bg-red-500/20 text-red-300 hover:bg-red-500/30 disabled:opacity-50"
                      >
                        {isActivatingThis ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin inline" />
                            Deactivating...
                          </>
                        ) : (
                          'Deactivate'
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(setList)}
                      className="p-2 text-neon-pink hover:bg-neon-pink/10 rounded-full"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteSetList(setList.id)}
                      className="p-2 text-red-400 hover:bg-red-400/20 rounded-full"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleSetListExpansion(setList.id)}
                      className="p-2 text-gray-400 hover:text-white rounded-full"
                      title={isExpanded ? 'Hide songs' : 'Show songs'}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="space-y-2 transition-all duration-300 mt-4">
                    {setList.songs && setList.songs.length > 0 ? (
                      setList.songs.map((song, index) => (
                        <div
                          key={`${setList.id}-${song.id}`}
                          className="flex items-center space-x-3 p-2 bg-neon-purple/10 rounded"
                        >
                          <span className="text-gray-400 text-sm">{index + 1}.</span>
                          {/* Direct img like the working kiosk/user frontend */}
                          <div className="w-12 h-12 flex-shrink-0 relative">
                            {song.albumArtUrl ? (
                              <img
                                src={song.albumArtUrl}
                                alt={`${song.title} album art`}
                                className="w-12 h-12 object-cover rounded-md neon-border"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-md flex items-center justify-center bg-neon-purple/20 flex-shrink-0">
                                <Music4 className="w-6 h-6 text-neon-pink" />
                              </div>
                            )}
                          </div>
                          <div>
                            <span className="font-medium text-white">{song.title}</span>
                            <p className="text-sm text-gray-300">{song.artist}</p>
                            {song.genre && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {song.genre.split(',').map((genre, i) => (
                                  <span 
                                    key={i} 
                                    className="inline-block px-1.5 py-0.5 text-xs rounded-full bg-neon-purple/20 text-gray-300"
                                  >
                                    {genre.trim()}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-400 text-sm italic p-2 bg-neon-purple/5 rounded">
                        No songs in this set list
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}