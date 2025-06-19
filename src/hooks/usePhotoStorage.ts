import { useState, useCallback } from 'react';
import { uploadUserPhoto, generateDefaultAvatar, deleteUserPhoto } from '../utils/photoStorage';

/**
 * Hook for managing user photo uploads and storage
 */
export function usePhotoStorage() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Upload a photo file to storage
   */
  const uploadPhoto = useCallback(async (file: File | Blob, userId: string): Promise<string> => {
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);
    
    try {
      // Convert Blob to File if needed
      const photoFile = file instanceof File 
        ? file 
        : new File([file], `${userId}-photo.jpg`, { type: 'image/jpeg' });
      
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const next = prev + Math.random() * 15;
          return next > 90 ? 90 : next;
        });
      }, 300);
      
      // Upload the photo
      const photoUrl = await uploadUserPhoto(photoFile, userId);
      
      // Complete progress
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      return photoUrl;
    } catch (error) {
      console.error('Error uploading photo:', error);
      setError(error instanceof Error ? error : new Error('Failed to upload photo'));
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, []);

  /**
   * Generate a default avatar for users without photos
   */
  const getDefaultAvatar = useCallback((name: string): string => {
    return generateDefaultAvatar(name);
  }, []);

  /**
   * Delete a user's photo from storage
   */
  const deletePhoto = useCallback(async (url: string): Promise<void> => {
    try {
      if (url && !url.startsWith('data:')) {
        await deleteUserPhoto(url);
      }
    } catch (error) {
      console.error('Error deleting photo:', error);
      setError(error instanceof Error ? error : new Error('Failed to delete photo'));
      throw error;
    }
  }, []);

  return {
    uploadPhoto,
    deletePhoto,
    getDefaultAvatar,
    isUploading,
    uploadProgress,
    error
  };
}