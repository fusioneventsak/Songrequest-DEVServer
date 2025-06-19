import React, { useState } from 'react';
import { Music4 } from 'lucide-react';
import { useUiSettings } from '../../hooks/useUiSettings';
import type { Song } from '../../types';

interface AlbumArtDisplayProps {
  albumArtUrl?: string;
  title?: string;
  size?: 'xs' | 'sm' | 'medium' | 'lg';
  imageClassName?: string;
  imageStyle?: React.CSSProperties;
  song?: Song;
  className?: string;
}

export function AlbumArtDisplay({ 
  albumArtUrl, 
  title, 
  size = 'medium', 
  imageClassName = '', 
  imageStyle = {},
  song,
  className = ''
}: AlbumArtDisplayProps) {
  const [imageLoadError, setImageLoadError] = useState(false);
  const { settings } = useUiSettings();
  const accentColor = settings?.frontend_accent_color || '#ff00ff';

  // If song is provided, use its properties
  const displayUrl = song?.albumArtUrl || albumArtUrl;
  const displayTitle = song?.title || title || 'Album Art';

  // Size configurations
  const sizeClasses = {
    xs: 'w-14 h-14',
    sm: 'w-12 h-12',
    medium: 'w-16 h-16',
    lg: 'w-20 h-20'
  };

  const iconSizes = {
    xs: 'w-6 h-6',
    sm: 'w-6 h-6',
    medium: 'w-8 h-8',
    lg: 'w-10 h-10'
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error('Album art failed to load:', displayUrl);
    setImageLoadError(true);
  };

  // Show fallback if no URL provided or image failed to load
  if (!displayUrl || imageLoadError) {
    return (
      <div 
        className={`${sizeClasses[size]} rounded-md flex items-center justify-center bg-neon-purple/20 flex-shrink-0 ${className}`}
        style={{
          boxShadow: `0 0 10px ${accentColor}30`,
          ...imageStyle
        }}
      >
        <Music4 
          className={`${iconSizes[size]}`}
          style={{ color: accentColor }}
        />
      </div>
    );
  }

  return (
    <img
      src={displayUrl}
      alt={`${displayTitle} album art`}
      className={`${sizeClasses[size]} object-cover rounded-md flex-shrink-0 ${imageClassName} ${className}`}
      style={{
        boxShadow: `0 0 10px ${accentColor}30`,
        ...imageStyle
      }}
      onError={handleImageError}
    />
  );
}