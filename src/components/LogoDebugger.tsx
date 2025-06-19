import React, { useState, useEffect } from 'react';
import { AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import { useUiSettings } from '../hooks/useUiSettings';
import { checkImageAccessibility } from '../utils/uploadLogo';

export function LogoDebugger() {
  const { settings, loading, refreshSettings } = useUiSettings();
  const [imgError, setImgError] = useState(false);
  const [isAccessible, setIsAccessible] = useState<boolean | null>(null);
  const [checkingAccessibility, setCheckingAccessibility] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  
  // Update URL when settings change
  useEffect(() => {
    if (settings?.band_logo_url) {
      // Skip data URLs as they're already reliable
      if (settings.band_logo_url.startsWith('data:')) {
        setImageUrl(settings.band_logo_url);
        setIsAccessible(true); // Data URLs are always accessible
      } else {
        setImageUrl(settings.band_logo_url);
      }
    }
  }, [settings]);
  
  // Check image accessibility
  const checkAccessibility = async () => {
    if (!imageUrl) return;
    
    // Skip check for data URLs
    if (imageUrl.startsWith('data:')) {
      setIsAccessible(true);
      return;
    }
    
    setCheckingAccessibility(true);
    try {
      const result = await checkImageAccessibility(imageUrl);
      setIsAccessible(result);
    } catch (error) {
      console.error('Error checking accessibility:', error);
      setIsAccessible(false);
    } finally {
      setCheckingAccessibility(false);
    }
  };
  
  // Run accessibility check when URL changes
  useEffect(() => {
    if (imageUrl) {
      checkAccessibility();
    }
  }, [imageUrl]);
  
  if (loading) return <div>Loading settings...</div>;
  
  const logoUrl = settings?.band_logo_url || null;
  const isDataUrl = logoUrl?.startsWith('data:');
  
  const refreshImage = () => {
    setImgError(false);
    if (isDataUrl) return; // No need to refresh data URLs
    
    setImageUrl(prev => {
      if (!prev) return prev;
      try {
        const urlObj = new URL(prev);
        urlObj.searchParams.set('t', Date.now().toString());
        return urlObj.toString();
      } catch {
        // For invalid URLs, add simple timestamp
        const separator = prev.includes('?') ? '&' : '?';
        return `${prev}${separator}t=${Date.now()}`;
      }
    });
  };
  
  return (
    <div className="p-4 border border-red-500 my-4 rounded-lg">
      <h3 className="text-lg font-bold mb-2 text-white">Logo Debugger</h3>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <p>Original Logo URL: <span className="text-gray-300 break-all">{logoUrl || 'No URL found'}</span></p>
          <button 
            onClick={refreshSettings} 
            className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs flex items-center"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Refresh Settings
          </button>
        </div>
        
        {/* For data URLs, show a message */}
        {isDataUrl && (
          <div className="p-2 bg-green-500/10 border border-green-500/20 rounded">
            <p className="text-green-400">Using data URL (embedded SVG). This is reliable and doesn't depend on external servers.</p>
          </div>
        )}
        
        <div className="my-2 p-3 border border-dashed border-gray-500 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-medium text-white">Logo Preview:</h4>
            <button 
              onClick={refreshImage}
              disabled={isDataUrl}
              className={`px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs flex items-center ${isDataUrl ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Reload Image
            </button>
          </div>
          
          {imageUrl ? (
            <div>
              <div className="mb-2 py-2 px-3 bg-gray-800/50 rounded text-xs">
                <p className="text-gray-400 break-all">Testing URL: {imageUrl}</p>
                <p className="mt-1">
                  Accessibility: {' '}
                  {checkingAccessibility ? (
                    <span className="text-yellow-400">Checking...</span>
                  ) : isAccessible === null ? (
                    <span className="text-gray-400">Unknown</span>
                  ) : isAccessible ? (
                    <span className="text-green-400">Accessible</span>
                  ) : (
                    <span className="text-red-400">Not accessible</span>
                  )}
                </p>
              </div>
              
              <div className="border border-gray-600 p-2 rounded flex items-center justify-center">
                <img 
                  src={imageUrl} 
                  alt="Test logo" 
                  className={`h-16 ${imgError ? 'hidden' : ''}`}
                  onError={(e) => {
                    console.error("Logo load error in debugger:", imageUrl);
                    setImgError(true);
                  }}
                />
                
                {imgError && (
                  <div className="flex items-center text-yellow-400">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Failed to load image from URL
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-yellow-400">No logo URL defined in settings</div>
          )}
        </div>
        
        {imageUrl && !isDataUrl && (
          <div className="space-y-2">
            <p className="text-white font-medium">URL Analysis:</p>
            <pre className="p-2 bg-darker-purple/50 text-xs text-gray-300 overflow-x-auto rounded">
              {imageUrl.split(/([?&])/g).map((part, i) => {
                if (part === '?' || part === '&') {
                  return <span key={i} className="text-yellow-400">{part}</span>;
                }
                if (i > 0) {
                  return <span key={i} className="text-blue-400">{part}</span>;
                }
                return <span key={i}>{part}</span>;
              })}
            </pre>
            
            <div className="flex flex-wrap gap-2 mt-2">
              <button 
                className="px-3 py-1 bg-blue-500 text-white rounded text-xs flex items-center"
                onClick={() => window.open(imageUrl, '_blank')}
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Open URL Directly
              </button>
              
              <button 
                className="px-3 py-1 bg-green-500 text-white rounded text-xs flex items-center"
                onClick={() => {
                  try {
                    // For proper URLs, parse and remove all query params
                    const url = new URL(imageUrl);
                    const baseUrl = url.origin + url.pathname;
                    window.open(baseUrl, '_blank');
                  } catch {
                    // For invalid URLs, try to strip everything after ? or &
                    const baseUrl = imageUrl.split(/[?&]/)[0];
                    window.open(baseUrl, '_blank');
                  }
                }}
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Open Without Cache Parameters
              </button>
              
              <button 
                className="px-3 py-1 bg-gray-600 text-white rounded text-xs"
                onClick={() => {
                  navigator.clipboard.writeText(imageUrl);
                  alert('URL copied to clipboard');
                }}
              >
                Copy URL
              </button>
            </div>
          </div>
        )}
        
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded">
          <h5 className="font-medium text-amber-400 mb-1">Solution for CORS issues:</h5>
          <ul className="list-disc pl-4 text-xs text-amber-300">
            <li className="mb-1">The app now uses an embedded SVG data URL for the logo</li>
            <li className="mb-1">This approach avoids CORS issues completely as it doesn't rely on external domains</li>
            <li className="mb-1">The embedded logo is stored directly in the database as a data URL</li>
            <li className="mb-1">No network requests are made to load the logo, eliminating CORS concerns</li>
            <li>When uploading a new logo, it's automatically converted to this safe format</li>
          </ul>
        </div>
      </div>
    </div>
  );
}