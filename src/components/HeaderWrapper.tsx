import React, { useState, useEffect } from 'react';
import { StickyHeader } from './StickyHeader';
import { Ticker } from './Ticker';
import { useUiSettings } from '../hooks/useUiSettings';

interface HeaderWrapperProps {
  logoUrl?: string | null;
  isAdmin?: boolean;
  onLogoClick?: () => void;
  nextSong?: {
    title: string;
    artist?: string;
    albumArtUrl?: string;
  };
  customMessage?: string;
  tickerActive?: boolean;
  children?: React.ReactNode;
  showBackButton?: boolean;
  onBack?: () => void;
}

export function HeaderWrapper({
  logoUrl,
  isAdmin = false,
  onLogoClick,
  nextSong,
  customMessage,
  tickerActive = true,
  children,
  showBackButton = false,
  onBack
}: HeaderWrapperProps) {
  const { settings } = useUiSettings();
  const [localLogoUrl, setLocalLogoUrl] = useState<string | null>(null);
  
  // Initialize logo URL from props or settings
  useEffect(() => {
    setLocalLogoUrl(logoUrl || settings?.band_logo_url || null);
  }, [logoUrl, settings]);

  // Prepare ticker element if needed
  const tickerElement = tickerActive ? (
    <Ticker 
      nextSong={nextSong} 
      customMessage={customMessage} 
      showInBackend={true}
    />
  ) : null;
  
  return (
    <StickyHeader
      tickerElement={tickerElement}
      logoUrl={localLogoUrl}
      isAdmin={isAdmin}
      onLogoClick={onLogoClick}
    >
      {children}
    </StickyHeader>
  );
}