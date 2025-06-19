import React, { useEffect, useState } from 'react';
import { useStickyHeader } from '../hooks/useStickyHeader';
import { Logo } from './shared/Logo';
import { useUiSettings } from '../hooks/useUiSettings';

interface StickyHeaderProps {
  tickerElement?: React.ReactNode;
  logoUrl?: string | null;
  isAdmin?: boolean;
  onLogoClick?: () => void;
  children?: React.ReactNode;
}

export function StickyHeader({
  tickerElement,
  logoUrl,
  isAdmin = false,
  onLogoClick,
  children
}: StickyHeaderProps) {
  const { settings } = useUiSettings();
  const [headerHeight, setHeaderHeight] = useState(100); // Updated default height to 100px
  const { headerRef, isHeaderVisible, hasScrolled } = useStickyHeader(headerHeight);
  
  // Measure the header's actual height after mounting
  useEffect(() => {
    if (headerRef.current) {
      const height = headerRef.current.offsetHeight;
      setHeaderHeight(height);
    }
  }, [settings?.band_name]);
  
  return (
    <>
      <header 
        ref={headerRef}
        className={`frontend-header fixed top-0 left-0 right-0 transition-transform duration-300 w-full z-50 ${
          hasScrolled && !isHeaderVisible ? '-translate-y-full' : 'translate-y-0'
        }`}
        style={{ height: "100px" }}
      >
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center">
              <Logo 
                url={logoUrl || ''} 
                isAdmin={isAdmin} 
                onClick={onLogoClick}
                className="h-20"
              />
              <h1 className="text-white font-bold ml-4 text-2xl sm:text-3xl">
                {settings?.band_name || 'uRequest Live'}
              </h1>
            </div>
            {children}
          </div>
        </div>
      </header>
      
      <div style={{ height: headerHeight }} />
      {tickerElement}
    </>
  );
}