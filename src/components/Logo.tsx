import React from 'react';
import { useLogoHandling } from '../../hooks/useLogoHandling';

interface LogoProps {
  url: string;
  isAdmin?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Logo({ url, isAdmin = false, onClick, className = '' }: LogoProps) {
  const { handleError } = useLogoHandling();

  return (
    <div 
      onClick={isAdmin ? onClick : undefined}
      className={`${isAdmin ? 'cursor-pointer' : ''} logo-container ${className}`}
      style={{ 
        background: 'none',
        backgroundColor: 'transparent'
      }}
      title={isAdmin ? "Click to change logo" : ""}
    >
      <img 
        src={url}
        alt="Logo" 
        className="frontend-logo"
        style={{
          background: 'none',
          backgroundColor: 'transparent',
          backgroundImage: 'none',
          WebkitMaskImage: 'none',
          maskImage: 'none',
          imageRendering: '-webkit-optimize-contrast'
        }}
        onError={handleError}
      />
    </div>
  );
}