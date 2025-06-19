import React from 'react';
import { useLogoHandling } from '../../hooks/useLogoHandling';
import { useUiSettings } from '../../hooks/useUiSettings';

interface LogoProps {
  url: string;
  isAdmin?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Logo({ url, isAdmin = false, onClick, className = '' }: LogoProps) {
  const { handleError } = useLogoHandling();
  const { settings } = useUiSettings();
  const accentColor = settings?.frontend_accent_color || '#ff00ff';

  return (
    <div 
      onClick={isAdmin ? onClick : undefined}
      className={`${isAdmin ? 'cursor-pointer' : ''} logo-container ${className}`}
      title={isAdmin ? "Click to change logo" : ""}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        animation: "logoGlow 2s ease-in-out infinite",
       marginBottom: "1.5rem", // Added explicit margin to ensure proper spacing
       maxWidth: "100%" // Ensure logo container doesn't overflow
      }}
    >
      <img 
        src={url}
        alt="Logo" 
        className="frontend-logo"
        style={{
         maxHeight: "150%", // Increased from 100% to make logo larger
          width: "auto",
          height: "auto",
          display: "block",
          objectFit: "contain",
          filter: `drop-shadow(0 0 15px ${accentColor}80)`,
          position: "relative",
          zIndex: 1,
         maxWidth: "100%" // Ensure image doesn't overflow its container
        }}
        onError={handleError}
      />
      
      {/* Glow effect layers */}
      <div 
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle, ${accentColor}20 0%, transparent 70%)`,
          filter: "blur(10px)",
          animation: "logoPulse 2s ease-in-out infinite",
        }}
      />
      <div 
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle, ${accentColor}10 0%, transparent 60%)`,
          filter: "blur(20px)",
          animation: "logoPulse 2s ease-in-out infinite",
          animationDelay: "0.5s",
        }}
      />

      <style 
        >{`
        @keyframes logoPulse {
          0%, 100% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.1);
          }
        }

        @keyframes logoGlow {
          0%, 100% {
            filter: drop-shadow(0 0 15px ${accentColor}80);
          }
          50% {
            filter: drop-shadow(0 0 25px ${accentColor});
          }
        }
      `}</style>
    </div>
  );
}