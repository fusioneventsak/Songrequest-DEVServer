/**
 * Resizes and compresses an image to reduce payload size
 * Updated to handle standard smartphone photos from all major brands (iPhone, Samsung, Google Pixel, etc.)
 * Supports images up to 50MB and compresses them efficiently
 * @param dataUrl The data URL of the image to compress
 * @param maxWidth Maximum width of the resulting image
 * @param maxHeight Maximum height of the resulting image
 * @param quality Compression quality (0-1)
 * @returns Promise that resolves to compressed image data URL
 */
export function resizeAndCompressImage(
  dataUrl: string, 
  maxWidth = 300, 
  maxHeight = 300,
  quality = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Validate input
      if (!dataUrl || typeof dataUrl !== 'string') {
        reject(new Error('Invalid data URL: input is null or not a string'));
        return;
      }
      
      // Basic format validation
      if (!dataUrl.startsWith('data:image/')) {
        reject(new Error('Invalid data URL format: must start with "data:image/"'));
        return;
      }

      const img = new Image();
      
      img.onload = () => {
        try {
          // Calculate new dimensions while maintaining aspect ratio
          let width = img.width;
          let height = img.height;
          
          if (width === 0 || height === 0) {
            reject(new Error('Invalid image dimensions: width or height is zero'));
            return;
          }
          
          // Calculate aspect ratio
          const aspectRatio = width / height;
          
          // Scale down if needed - more aggressive scaling for large images
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round(maxWidth / aspectRatio);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round(maxHeight * aspectRatio);
              height = maxHeight;
            }
          }
          
          // Create canvas for resizing
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Failed to create canvas context'));
            return;
          }
          
          // Enable high-quality image scaling
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          // Draw image with resize
          ctx.drawImage(img, 0, 0, width, height);
          
          // Start with user-specified quality and progressively compress if needed
          const maxSize = 1024 * 1024; // 1MB max
          let compressedDataUrl: string;
          let currentQuality = quality;
          
          // Progressive compression loop
          for (let attempts = 0; attempts < 5; attempts++) {
            try {
              compressedDataUrl = canvas.toDataURL('image/jpeg', currentQuality);
              
              // Check file size
              const base64 = compressedDataUrl.split(',')[1];
              const size = Math.ceil((base64.length * 3) / 4);
              
              // If size is acceptable, we're done
              if (size <= maxSize) {
                resolve(compressedDataUrl);
                return;
              }
              
              // Reduce quality for next attempt
              currentQuality = Math.max(0.1, currentQuality - 0.15);
              
              // If this is the last attempt and still too large, try smaller dimensions
              if (attempts === 4) {
                // Reduce canvas size and try again
                const smallerWidth = Math.floor(width * 0.8);
                const smallerHeight = Math.floor(height * 0.8);
                
                canvas.width = smallerWidth;
                canvas.height = smallerHeight;
                ctx.drawImage(img, 0, 0, smallerWidth, smallerHeight);
                
                compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6);
                const finalBase64 = compressedDataUrl.split(',')[1];
                const finalSize = Math.ceil((finalBase64.length * 3) / 4);
                
                if (finalSize > maxSize) {
                  reject(new Error(`Image is too large (${Math.round(finalSize/1024)}KB) even after maximum compression. Please use a smaller image or crop it before uploading.`));
                  return;
                }
                
                resolve(compressedDataUrl);
                return;
              }
            } catch (canvasError) {
              console.error('Canvas toDataURL error:', canvasError);
              reject(new Error('Failed to generate compressed image: ' + (canvasError instanceof Error ? canvasError.message : String(canvasError))));
              return;
            }
          }
          
        } catch (innerError) {
          console.error('Error in image processing:', innerError);
          reject(innerError instanceof Error ? innerError : new Error('Error processing image: ' + String(innerError)));
        }
      };
      
      img.onerror = (error) => {
        console.error('Image loading error:', error);
        reject(new Error('Failed to load image for compression. The image may be corrupted or in an unsupported format.'));
      };
      
      // Set crossOrigin to handle CORS issues
      img.crossOrigin = 'anonymous';
      img.src = dataUrl;
      
    } catch (error) {
      console.error('Unexpected error in image compression:', error);
      reject(error instanceof Error ? error : new Error('Unexpected error: ' + String(error)));
    }
  });
}

/**
 * Estimates the file size of a data URL in bytes
 */
export function estimateDataUrlSize(dataUrl: string): number {
  if (!dataUrl) return 0;
  
  // Extract the base64 part (after the comma)
  const base64 = dataUrl.split(',')[1];
  if (!base64) return 0;
  
  // Base64 encodes 3 bytes into 4 chars, so the decoded size is 3/4 of the base64 length
  return Math.floor(base64.length * 0.75);
}

/**
 * Gets the dimensions of an image from a data URL
 */
export function getImageDimensions(dataUrl: string): Promise<{ width: number, height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.width,
        height: img.height
      });
    };
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    img.crossOrigin = 'anonymous';
    img.src = dataUrl;
  });
}

/**
 * Gets optimal camera constraints based on device
 * This function has been updated to be more reliable across different devices
 */
/**
 * Validates an image URL by attempting to load it
 */
export function validateImageUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!url) {
      resolve(false);
      return;
    }
    
    const img = new Image();
    const timeout = setTimeout(() => {
      console.warn('Image validation timed out:', url);
      resolve(false);
    }, 10000); // Increased timeout for larger images
    
    img.onload = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    
    img.onerror = () => {
      clearTimeout(timeout);
      console.warn('Image validation failed:', url);
      resolve(false);
    };
    
    img.crossOrigin = 'anonymous';
    
    // Add cache busting parameter
    const cacheBuster = Date.now();
    const separator = url.includes('?') ? '&' : '?';
    img.src = `${url}${separator}t=${cacheBuster}`;
  });
}

/**
 * Utility function to convert file size to human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Detect device type and camera capabilities
 */
export function getDeviceInfo() {
  const userAgent = navigator.userAgent.toLowerCase();
  
  // Device detection
  const isIOS = /iphone|ipad|ipod/.test(userAgent);
  const isAndroid = /android/.test(userAgent);
  const isSamsung = /samsung/.test(userAgent) || /sm-/.test(userAgent);
  const isPixel = /pixel/.test(userAgent);
  const isOnePlus = /oneplus/.test(userAgent);
  const isHuawei = /huawei/.test(userAgent);
  const isXiaomi = /xiaomi|mi\s/.test(userAgent);
  const isOppo = /oppo/.test(userAgent);
  const isVivo = /vivo/.test(userAgent);
  const isLG = /lg/.test(userAgent);
  const isMobile = isIOS || isAndroid;
  
  // Camera capabilities detection
  const hasMediaDevices = 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;
  const supportsImageCapture = 'ImageCapture' in window;
  
  return {
    device: {
      isMobile,
      isIOS,
      isAndroid,
      brand: isSamsung ? 'Samsung' : 
             isPixel ? 'Google Pixel' :
             isOnePlus ? 'OnePlus' :
             isHuawei ? 'Huawei' :
             isXiaomi ? 'Xiaomi' :
             isOppo ? 'Oppo' :
             isVivo ? 'Vivo' :
             isLG ? 'LG' :
             isIOS ? 'Apple' : 'Unknown'
    },
    camera: {
      hasMediaDevices,
      supportsImageCapture,
      canUseCamera: hasMediaDevices
    }
  };
}

/**
 * Get optimal camera constraints based on device
 */
export function getOptimalCameraConstraints() {
  return {
    video: {
      facingMode: 'user', // Use front camera for profile photos
      width: { ideal: 1280 },
      height: { ideal: 720 }
    }
  }
}

/**
 * Check if the device likely supports high-quality camera capture
 */
export function supportsHighQualityCapture(): boolean {
  const deviceInfo = getDeviceInfo();
  
  // Check for modern browser features and mobile device
  return deviceInfo.device.isMobile && deviceInfo.camera.hasMediaDevices;
}

/**
 * Get file input accept string optimized for mobile devices
 */
export function getOptimalFileInputAccept(): string {
  const deviceInfo = getDeviceInfo();
  
  if (deviceInfo.device.isMobile) {
    // Mobile devices - prefer camera but allow gallery
    return "image/*";
  } else {
    // Desktop - standard image formats
    return "image/jpeg,image/png,image/webp,image/heic,image/heif";
  }
}