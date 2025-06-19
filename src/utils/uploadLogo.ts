import { supabase } from './supabase';
import { resizeAndCompressImage } from './imageUtils';

// Default logo URL from Fusion Events 
const DEFAULT_LOGO_URL = "https://www.fusion-events.ca/wp-content/uploads/2025/03/ulr-wordmark.png";

/**
 * Checks if an image URL is accessible
 */
export async function checkImageAccessibility(url: string): Promise<boolean> {
  if (!url) return false;
  
  // Skip check for data URLs as they're always accessible
  if (url.startsWith('data:')) return true;
  
  return new Promise((resolve) => {
    const img = new Image();
    let timeout: NodeJS.Timeout;

    img.onload = () => {
      clearTimeout(timeout);
      console.log('Image is accessible:', url);
      resolve(true);
    };

    img.onerror = () => {
      clearTimeout(timeout);
      console.warn('Image is NOT accessible:', url);
      resolve(false);
    };

    // Set crossOrigin to handle CORS issues
    img.crossOrigin = 'anonymous';
    
    // Add cache busting to avoid caching issues
    const cacheBuster = `t=${Date.now()}`;
    const separator = url.includes('?') ? '&' : '?';
    
    try {
      img.src = `${url}${separator}${cacheBuster}`;
    } catch (error) {
      console.error('Error setting image src:', error);
      resolve(false);
    }

    // Set timeout to avoid hanging
    timeout = setTimeout(() => {
      console.warn('Image accessibility check timed out:', url);
      resolve(false);
    }, 5000);
  });
}

/**
 * Converts a data URL to a Blob while preserving transparency
 */
export function dataURLtoBlob(dataUrl: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      // Validate data URL format
      if (!dataUrl || typeof dataUrl !== 'string') {
        throw new Error('Invalid data URL: Input is null or not a string');
      }
      
      if (!dataUrl.startsWith('data:')) {
        throw new Error('Invalid data URL format: Must start with "data:"');
      }

      // Split the data URL to get mime type and base64 data
      const parts = dataUrl.split(',');
      if (parts.length !== 2) {
        throw new Error('Invalid data URL structure: Missing comma separator');
      }
      
      const [header, base64Data] = parts;
      if (!header || !base64Data) {
        throw new Error('Invalid data URL structure: Missing header or data');
      }

      // Get mime type from header
      const mimeMatch = header.match(/^data:(.*?);base64$/);
      if (!mimeMatch) {
        throw new Error('Invalid mime type in data URL');
      }
      const mimeType = mimeMatch[1];

      try {
        // Convert base64 to binary
        const binaryStr = atob(base64Data);
        const len = binaryStr.length;
        const arr = new Uint8Array(len);

        for (let i = 0; i < len; i++) {
          arr[i] = binaryStr.charCodeAt(i);
        }

        // Create and return blob with proper mime type
        const blob = new Blob([arr], { type: mimeType });
        resolve(blob);
      } catch (binaryError) {
        throw new Error('Failed to decode base64 data: ' + 
          (binaryError instanceof Error ? binaryError.message : String(binaryError)));
      }
    } catch (error) {
      console.error('Error in dataURLtoBlob:', error);
      reject(error instanceof Error ? error : new Error('Unknown error: ' + String(error)));
    }
  });
}

/**
 * Validates if a file is an acceptable image type
 */
export function isValidImageType(file: File): boolean {
  const acceptedTypes = ['image/png', 'image/svg+xml'];
  return acceptedTypes.includes(file.type);
}

/**
 * Creates a direct storage URL for a file
 */
function getDirectStorageUrl(bucket: string, path: string, baseUrl: string): string {
  return `${baseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

/**
 * Get the public URL for a file with proper caching disabled
 */
export function getPublicUrl(path: string, bucket: string = 'app_assets'): string {
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path, {
      download: false
    });
  
  // Add cache busting
  const url = data.publicUrl;
  const cacheBuster = Date.now();
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}cb=${cacheBuster}`;
}

/**
 * Uploads a logo to Supabase storage and returns a direct data URL
 * This approach solves transparency issues by preserving the original PNG format
 */
export async function uploadBandLogo(fileData: Blob | File): Promise<string> {
  console.log('Starting logo upload process');
  try {
    // Convert to PNG with transparency
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to create canvas context');
    }

    // Create a temporary image to get dimensions
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = URL.createObjectURL(fileData);
    });

    // Set canvas size to match image
    canvas.width = img.width;
    canvas.height = img.height;

    // Clear canvas with transparency
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image preserving transparency
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(img, 0, 0);

    // Convert to PNG data URL
    const pngDataUrl = canvas.toDataURL('image/png');

    // Update UI settings with PNG data URL
    const { data: settings, error: settingsError } = await supabase
      .from('ui_settings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      throw new Error('Failed to fetch current settings');
    }

    if (!settings || settings.length === 0) {
      // Create new settings if none exist
      const { error: createError } = await supabase
        .from('ui_settings')
        .insert({
          band_logo_url: pngDataUrl,
          band_name: 'uRequest Live',
          primary_color: '#ff00ff',
          secondary_color: '#9d00ff',
          frontend_bg_color: '#13091f',
          frontend_accent_color: '#ff00ff',
          updated_at: new Date().toISOString()
        });

      if (createError) {
        throw new Error('Failed to create settings with new logo');
      }
    } else {
      // Update existing settings
      const { error: updateError } = await supabase
        .from('ui_settings')
        .update({
          band_logo_url: pngDataUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', settings[0].id);

      if (updateError) {
        throw new Error('Failed to update settings with new logo');
      }
    }

    return pngDataUrl;
  } catch (error) {
    console.error('Error in logo upload process:', error);
    throw error instanceof Error 
      ? error 
      : new Error('Failed to upload logo: ' + String(error));
  }
}