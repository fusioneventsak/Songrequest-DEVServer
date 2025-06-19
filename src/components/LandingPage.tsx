import React, { useState, useRef } from 'react';
import { Camera, User as UserIcon, AlertTriangle, UserCircle } from 'lucide-react';
import { resizeAndCompressImage, getOptimalCameraConstraints, getOptimalFileInputAccept, supportsHighQualityCapture } from '../utils/imageUtils';
import { dataURLtoBlob } from '../utils/photoStorage';
import { usePhotoStorage } from '../hooks/usePhotoStorage';
import type { User } from '../types';

interface LandingPageProps {
  onComplete: (user: User) => void;
  initialUser?: User | null;
}

// Increased limit to handle smartphone photos after compression
const MAX_PHOTO_SIZE = 1024 * 1024; // 1MB limit for compressed photos (up from 300KB)
const MAX_INPUT_SIZE = 50 * 1024 * 1024; // 50MB max input size (supports all major phone brands)

export function LandingPage({ onComplete, initialUser }: LandingPageProps) {
  const [name, setName] = useState(initialUser?.name || '');
  const [photo, setPhoto] = useState<string>(initialUser?.photo || '');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { uploadPhoto, getDefaultAvatar } = usePhotoStorage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = async () => {
    try {
      // Get optimal camera constraints based on device
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'user', // Use front camera by default
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      
      console.log('Requesting camera with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        console.log('Camera stream obtained, setting to video element');
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded, playing video');
          videoRef.current?.play().catch(e => {
            console.error('Error playing video:', e);
          });
        };
        setIsCapturing(true);
        setErrorMessage(null);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setErrorMessage('Could not access camera. Please check your permissions or try uploading a photo from your gallery instead.');
    }
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      try {
        setIsProcessing(true);
        setErrorMessage(null);
        
        const context = canvasRef.current.getContext('2d');
        if (context) {
          // Set dimensions for the capture - higher resolution for better quality
          const width = 600; // Increased for better quality on all devices
          const height = (videoRef.current.videoHeight / videoRef.current.videoWidth) * width;
          
          canvasRef.current.width = width;
          canvasRef.current.height = height;
          context.drawImage(videoRef.current, 0, 0, width, height);
          
          const photoData = canvasRef.current.toDataURL('image/jpeg', 0.9); // High quality initial capture
          
          try {
            const compressedPhoto = await resizeAndCompressImage(photoData, 300, 300, 0.8);
            
            // Instead of storing base64 in state, upload to storage and store URL
            const userId = initialUser?.id || name.toLowerCase().replace(/\s+/g, '-');
            const photoUrl = await uploadPhoto(await dataURLtoBlob(compressedPhoto), userId);
            setPhoto(photoUrl);
            stopCamera();
          } catch (error) {
            if (error instanceof Error) {
              setErrorMessage(error.message);
            } else {
              setErrorMessage('Error processing your photo. Please try again.');
            }
          }
        }
      } catch (error) {
        console.error('Error capturing photo:', error);
        setErrorMessage('Error processing your photo. Please try again.');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsCapturing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsProcessing(true);
        setErrorMessage(null);
        
        // Check if file is too large to process (before compression)
        if (file.size > MAX_INPUT_SIZE) {
          setErrorMessage(`Image file is too large (${Math.round(file.size/(1024*1024))}MB). Please select an image under ${Math.round(MAX_INPUT_SIZE/(1024*1024))}MB.`);
          return;
        }
        
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            // Use higher resolution and quality for compression to maintain image quality
            const compressedPhoto = await resizeAndCompressImage(reader.result as string, 300, 300, 0.8);
            
            // Instead of storing base64 in state, upload to storage and store URL
            const userId = initialUser?.id || name.toLowerCase().replace(/\s+/g, '-');
            const photoUrl = await uploadPhoto(await dataURLtoBlob(compressedPhoto), userId);
            setPhoto(photoUrl);
          } catch (error) {
            if (error instanceof Error) {
              setErrorMessage(error.message);
            } else {
              setErrorMessage('Error processing your photo. Please try a different image.');
            }
          } finally {
            setIsProcessing(false);
          }
        };
        reader.onerror = () => {
          setErrorMessage('Error reading the image file. Please try again.');
          setIsProcessing(false);
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error('Error handling file upload:', error);
        setErrorMessage('An error occurred while processing your photo.');
        setIsProcessing(false);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setErrorMessage('Please enter your name');
      return;
    }
    
    // Use the photo URL or generate a default avatar
    const userPhoto = photo || getDefaultAvatar(name);
    
    onComplete({ 
      id: initialUser?.id || name.toLowerCase().replace(/\s+/g, '-'), 
      name, 
      photo: userPhoto 
    });
  };

  return (
    <div className="min-h-screen bg-darker-purple flex items-center justify-center p-4">
      <div className="glass-effect rounded-lg shadow-xl p-8 max-w-md w-full border border-neon-purple/20">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white neon-text mb-2">
            {initialUser ? 'Edit Profile' : 'Welcome to Song Request'}
          </h1>
          <p className="text-gray-300">
            {initialUser
              ? 'Update your profile information'
              : 'Please introduce yourself before making a request'}
          </p>
        </div>

        {errorMessage && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-md p-3 mb-6 flex items-start">
            <AlertTriangle className="w-5 h-5 text-red-400 mr-2 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm">{errorMessage}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Your Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field text-gray-800"
              placeholder="Enter your name"
              maxLength={50}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Your Photo <span className="text-neon-pink">(Recommended)</span>
            </label>
            
            {isCapturing ? (
              <div className="space-y-4">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full rounded-lg neon-border"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={capturePhoto}
                    disabled={isProcessing}
                    className="flex-1 neon-button flex items-center justify-center"
                  >
                    {isProcessing ? (
                      <span>Processing...</span>
                    ) : (
                      <>
                        <Camera className="w-4 h-4 mr-2" />
                        Take Photo
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-4 py-2 text-sm text-neon-pink hover:text-white transition-colors border border-neon-pink/30 rounded-md"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : photo ? (
              <div className="space-y-4">
                <img
                  src={photo}
                  alt="Preview"
                  className="w-32 h-32 rounded-full mx-auto object-cover neon-border"
                />
                <button
                  type="button"
                  onClick={() => setPhoto('')}
                  className="w-full px-4 py-2 text-sm text-neon-pink hover:text-white transition-colors"
                >
                  Remove Photo
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <UserCircle className="w-32 h-32 text-gray-400 mx-auto" />
                </div>
                <p className="text-center text-gray-400 text-sm">
                  No photo selected. A default avatar will be created for you.
                </p>
                
                {/* Separate buttons for camera and gallery */}
                <div className="flex gap-2">
                  {supportsHighQualityCapture() && (
                    <button
                      type="button"
                      onClick={startCamera}
                      disabled={isProcessing}
                      className="flex-1 neon-button flex items-center justify-center"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Take Photo
                    </button>
                  )}
                  
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                    className="flex-1 neon-button flex items-center justify-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                      <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                    Upload Photo
                  </button>
                </div>
                
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={getOptimalFileInputAccept()}
                  onChange={handleFileUpload}
                  disabled={isProcessing}
                  className="hidden"
                />
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
            <p className="text-xs text-gray-400 mt-2">
              All smartphone photos supported (iPhone, Samsung, Google Pixel, etc.). Images will be automatically compressed to save space.
            </p>
          </div>

          <button
            type="submit"
            disabled={!name.trim() || isProcessing}
            className="neon-button w-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UserIcon className="w-4 h-4 mr-2" />
            {initialUser ? 'Update Profile' : 'Continue to Song Requests'}
          </button>
        </form>
      </div>
    </div>
  );
}