/**
 * Add a cache-busting parameter to a URL
 */
export function addCacheBuster(url: string): string {
  if (!url) return url;
  
  try {
    // Skip data URLs
    if (url.startsWith('data:')) return url;
    
    // Try to parse the URL properly
    const urlObj = new URL(url);
    
    // Remove any existing timestamps
    urlObj.searchParams.delete('t');
    urlObj.searchParams.delete('cb');
    urlObj.searchParams.delete('timestamp');
    
    // Add fresh cache busting
    urlObj.searchParams.set('t', Date.now().toString());
    return urlObj.toString();
  } catch (e) {
    // Fallback for invalid URLs
    console.warn('Invalid URL in addCacheBuster:', url);
    const hasQueryParams = url.includes('?');
    const separator = hasQueryParams ? '&' : '?';
    return `${url}${separator}t=${Date.now()}`;
  }
}

/**
 * Validate if a string is a valid URL
 */
export function isValidUrl(url: string): boolean {
  if (!url) return false;
  
  // Data URLs are always valid
  if (url.startsWith('data:')) return true;
  
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Fix URL formatting issues and ensure proper structure
 */
export function fixUnsplashUrl(url: string): string {
  if (!url) return url;
  
  // Skip data URLs
  if (url.startsWith('data:')) return url;
  
  try {
    // Parse URL to handle query parameters properly
    const urlObj = new URL(url);
    
    // Clean up existing cache busting parameters
    urlObj.searchParams.delete('t');
    urlObj.searchParams.delete('cb');
    urlObj.searchParams.delete('timestamp');
    
    // Add fresh cache busting
    urlObj.searchParams.set('t', Date.now().toString());
    
    return urlObj.toString();
  } catch (error) {
    console.error('Error fixing URL:', error);
    // If URL parsing fails, try simple cache busting
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}t=${Date.now()}`;
  }
}

/**
 * Creates a direct storage URL that bypasses the render API
 */
export function getDirectStorageUrl(url: string): string {
  if (!url) return url;
  
  // Skip data URLs
  if (url.startsWith('data:')) return url;
  
  try {
    // Convert render API URLs to direct storage URLs
    if (url.includes('/storage/v1/render/image/public/')) {
      // Extract bucket and path from the URL
      const pathMatch = url.match(/\/public\/([^\/]+)\/(.+?)(?:\?|$)/);
      if (pathMatch) {
        const [, bucket, objectPath] = pathMatch;
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const directUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${objectPath}`;
        console.log('Converted render URL to direct URL:', directUrl);
        return addCacheBuster(directUrl);
      }
    }
    
    return addCacheBuster(url);
  } catch (e) {
    console.error('Error getting direct storage URL:', e);
    return addCacheBuster(url);
  }
}

/**
 * Creates a reliable image URL with proper cache busting
 */
export function createReliableImageUrl(url: string | null): string | null {
  if (!url) return null;
  
  // Skip data URLs as they're already reliable
  if (url.startsWith('data:')) return url;
  
  try {
    // Check if URL is already absolute
    if (!url.startsWith('http')) {
      // If it's a relative URL and we have a Supabase URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (supabaseUrl && url.startsWith('/')) {
        url = supabaseUrl + url;
      } else {
        // For other relative URLs, make them absolute using the current origin
        url = window.location.origin + (url.startsWith('/') ? url : `/${url}`);
      }
    }
    
    // If URL contains a reference to bucket storage but not as a direct URL
    if (url.includes('/storage/v1/render/image/')) {
      url = getDirectStorageUrl(url);
      // getDirectStorageUrl already adds cache busting
      return url;
    }
    
    // Parse URL to handle query parameters properly
    let urlObj;
    try {
      urlObj = new URL(url);
    } catch (parseError) {
      console.warn('Invalid URL in createReliableImageUrl:', url);
      // Return the original URL with simple cache busting
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}t=${Date.now()}`;
    }
    
    // Clean up existing cache busting parameters
    urlObj.searchParams.delete('t');
    urlObj.searchParams.delete('cb');
    urlObj.searchParams.delete('timestamp');
    urlObj.searchParams.delete('retry');
    
    // Add fresh cache busting
    urlObj.searchParams.set('t', Date.now().toString());
    
    return urlObj.toString();
  } catch (error) {
    console.error('Error creating reliable URL:', error);
    // If URL processing fails, try simple cache busting
    try {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}t=${Date.now()}`;
    } catch (fallbackError) {
      console.error('Error applying fallback URL fix:', fallbackError);
      return url; // Return original as last resort
    }
  }
}