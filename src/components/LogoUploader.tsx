import React, { useState, useRef, useEffect } from 'react';
import { Upload, Check, X, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { uploadBandLogo, dataURLtoBlob, isValidImageType } from '../utils/uploadLogo';

interface LogoUploaderProps {
  currentLogoUrl?: string | null;
  onSuccess?: (url: string) => void;
}

export function LogoUploader({ currentLogoUrl, onSuccess }: LogoUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [uploadStartTime, setUploadStartTime] = useState<number>(0);
  const [imageUrl, setImageUrl] = useState<string | null>(currentLogoUrl);

  // Skip data URLs in logo preview as they're self-contained
  const isDataUrl = currentLogoUrl?.startsWith('data:');

  // Reset error state when the component mounts or currentLogoUrl changes
  useEffect(() => {
    setImageError(false);
    setImageUrl(currentLogoUrl);
  }, [currentLogoUrl]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setError(null);
      setSuccess(false);
      setPreviewUrl(null);
      setUploadStartTime(Date.now());

      // Validate file type - only allow PNG and SVG
      if (!isValidImageType(file)) {
        throw new Error('Please upload a PNG or SVG file to preserve transparency');
      }

      // Read file as data URL
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          if (!event.target?.result) {
            throw new Error('Failed to read file');
          }

          const dataUrl = event.target.result as string;
          setPreviewUrl(dataUrl);

          // Upload to get PNG data URL
          console.log('Starting upload process...');
          const logoUrl = await uploadBandLogo(file);
          console.log('Upload complete');

          // Store the URL for local display
          setImageUrl(logoUrl);
          
          // Reset uploading state and show success message
          setIsUploading(false);
          setSuccess(true);

          // Update in parent component
          if (onSuccess) {
            onSuccess(logoUrl);
          }
        } catch (err) {
          console.error('Image processing error:', err);
          setError('Error processing image: ' + (err instanceof Error ? err.message : String(err)));
          setIsUploading(false);
        }
      };

      reader.onerror = () => {
        setError('Failed to read file');
        setIsUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Logo upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload logo');
      setIsUploading(false);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleImageError = () => {
    console.error("Failed to load current logo\nURL:", imageUrl);
    setImageError(true);
  };

  // Safety timeout to reset uploading state if it gets stuck
  useEffect(() => {
    if (isUploading && uploadStartTime > 0) {
      const timeout = setTimeout(() => {
        const uploadDuration = Date.now() - uploadStartTime;
        if (uploadDuration > 30000) { // 30 seconds
          console.warn('Upload taking too long, resetting state');
          setIsUploading(false);
          setError('Upload timed out. Please try again with a smaller image.');
        }
      }, 30000);
      
      return () => clearTimeout(timeout);
    }
  }, [isUploading, uploadStartTime]);

  return (
    <div className="space-y-4">
      {/* Current logo preview */}
      {imageUrl && (
        <div className="p-3 border border-neon-purple/20 rounded bg-darker-purple">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-white">Current Logo</h4>
          </div>
          <div className="logo-container h-12 w-32 flex items-center justify-center">
            {!imageError ? (
              <img 
                ref={imgRef}
                src={imageUrl}
                alt="Current logo" 
                className="h-12 w-auto object-contain"
                onError={handleImageError}
              />
            ) : (
              <div className="logo-fallback flex items-center text-yellow-400 text-xs">
                <AlertTriangle className="w-4 h-4 mr-1" />
                Failed to load logo
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload component */}
      <div>
        <label className={`flex items-center justify-center px-4 py-2 bg-neon-purple/10 text-white rounded-md hover:bg-neon-purple/20 cursor-pointer transition-colors border border-neon-purple/20 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
          <Upload className="w-4 h-4 mr-2" />
          {isUploading ? 'Uploading...' : 'Upload Logo'}
          <input
            type="file"
            accept="image/png,image/svg+xml"
            onChange={handleFileChange}
            disabled={isUploading}
            className="hidden"
            ref={fileInputRef}
          />
        </label>
        <p className="text-xs text-gray-400 mt-2">
          Supported formats: PNG, SVG (transparent backgrounds only)
        </p>
      </div>

      {/* Preview */}
      {previewUrl && (
        <div className="p-3 border border-green-500/20 rounded bg-darker-purple">
          <h4 className="text-sm font-medium text-white mb-2">Preview</h4>
          <img 
            src={previewUrl} 
            alt="Logo preview" 
            className="h-12 w-auto object-contain"
          />
        </div>
      )}

      {/* Status messages */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm flex items-center">
          <X className="w-4 h-4 mr-2 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && !error && !isUploading && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded text-green-400 text-sm flex items-center">
          <Check className="w-4 h-4 mr-2 flex-shrink-0" />
          Logo uploaded successfully!
        </div>
      )}

      {isUploading && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded text-blue-400 text-sm flex items-center">
          <Loader2 className="w-4 h-4 mr-2 flex-shrink-0 animate-spin" />
          Processing logo...
        </div>
      )}
    </div>
  );
}