import React, { useState } from 'react';
import { Upload, Image } from 'lucide-react';
import { LogoUploader } from './LogoUploader';

interface LogoManagerProps {
  isAdmin: boolean;
  currentLogoUrl: string | null;
  onLogoUpdate: (url: string) => void;
}

export function LogoManager({ isAdmin, currentLogoUrl, onLogoUpdate }: LogoManagerProps) {
  const [showUploader, setShowUploader] = useState(false);

  const handleLogoClick = () => {
    if (isAdmin) {
      setShowUploader(true);
    }
  };

  if (!isAdmin && !showUploader) {
    return null;
  }

  return (
    <div>
      {!showUploader ? (
        <div className="glass-effect rounded-lg p-4 mb-4">
          <h3 className="text-sm font-medium text-white mb-2 flex items-center">
            <Image className="w-4 h-4 mr-1" />
            Logo Management
          </h3>
          <p className="text-xs text-gray-300 mb-3">
            Click the button below to change the front-end logo
          </p>
          <button
            onClick={handleLogoClick}
            className="text-xs bg-neon-purple/20 hover:bg-neon-purple/30 text-neon-pink px-2 py-1 rounded flex items-center"
          >
            <Upload className="w-3 h-3 mr-1" />
            Change Logo
          </button>
        </div>
      ) : (
        <div className="glass-effect rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-medium text-white flex items-center">
              <Upload className="w-4 h-4 mr-1" />
              Upload New Logo
            </h3>
            <button
              onClick={() => setShowUploader(false)}
              className="text-xs text-gray-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
          <LogoUploader 
            currentLogoUrl={currentLogoUrl}
            onSuccess={(url) => {
              onLogoUpdate(url);
              setShowUploader(false);
            }}
          />
        </div>
      )}
    </div>
  );
}