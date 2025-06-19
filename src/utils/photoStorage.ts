import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';
import { resizeAndCompressImage } from './imageUtils';

/**
 * Uploads a user photo to Supabase storage and returns the URL
 * @param photoFile The file to upload
 * @param userId The user ID to associate with the photo
 * @returns The URL of the uploaded photo
 */
export async function uploadUserPhoto(photoFile: File, userId: string): Promise<string> {
  try {
    // Generate a unique filename
    const fileExt = photoFile.name.split('.').pop() || 'jpg';
    const fileName = `${userId}/avatar-${uuidv4()}.${fileExt}`;
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('user-photos')
      .upload(fileName, photoFile, {
        cacheControl: '3600',
        upsert: true,
        contentType: `image/${fileExt}`
      });
    
    if (error) throw error;
    
    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('user-photos')
      .getPublicUrl(fileName);
    
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading photo:', error);
    throw error;
  }
}

/**
 * Converts a data URL to a Blob
 * @param dataUrl The data URL to convert
 * @returns A Blob representing the data
 */
export function dataURLtoBlob(dataUrl: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      if (!dataUrl || typeof dataUrl !== 'string') {
        reject(new Error('Invalid data URL: input is null or not a string'));
        return;
      }
      
      if (!dataUrl.startsWith('data:')) {
        reject(new Error('Invalid data URL format: must start with "data:"'));
        return;
      }
      
      const arr = dataUrl.split(',');
      if (arr.length !== 2) {
        reject(new Error('Invalid data URL format: missing comma separator'));
        return;
      }
      
      const mime = arr[0].match(/:(.*?);/)?.[1];
      if (!mime) {
        reject(new Error('Invalid data URL format: could not extract MIME type'));
        return;
      }
      
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      
      resolve(new Blob([u8arr], { type: mime }));
    } catch (error) {
      console.error('Error converting data URL to blob:', error);
      reject(error);
    }
  });
}

/**
 * Converts a data URL to a File
 * @param dataUrl The data URL to convert
 * @param fileName The name to give the file
 * @returns A File object
 */
export function dataURLtoFile(dataUrl: string, fileName: string): Promise<File> {
  return new Promise(async (resolve, reject) => {
    try {
      const blob = await dataURLtoBlob(dataUrl);
      const file = new File(
        [blob], 
        fileName, 
        { type: blob.type }
      );
      resolve(file);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generates a default avatar as a URL for users without photos
 * @param name The user's name to generate initials from
 * @returns A data URL containing the SVG avatar
 */
export function generateDefaultAvatar(name: string): string {
  // Generate a simple SVG with the user's initials
  const initials = name.split(' ')
    .map(part => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
  
  // Random pastel background color
  const hue = Math.floor(Math.random() * 360);
  const bgColor = `hsl(${hue}, 70%, 80%)`;
  const textColor = '#333';
    
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="200">
      <rect width="100" height="100" fill="${bgColor}" />
      <text x="50" y="50" font-family="Arial, sans-serif" font-size="40" font-weight="bold" 
            fill="${textColor}" text-anchor="middle" dominant-baseline="central">${initials}</text>
    </svg>
  `;
  
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Deletes a user photo from storage
 * @param url The URL of the photo to delete
 */
export async function deleteUserPhoto(url: string): Promise<void> {
  try {
    // Extract the path from the URL
    const path = url.split('/').slice(-2).join('/');
    
    // Delete from storage
    const { error } = await supabase.storage
      .from('user-photos')
      .remove([path]);
    
    if (error) throw error;
  } catch (error) {
    console.error('Error deleting photo:', error);
    throw error;
  }
}