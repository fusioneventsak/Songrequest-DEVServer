import { Music4 } from 'lucide-react';

// iTunes API search interface
export interface iTunesSearchResult {
  resultCount: number;
  results: Array<{
    artworkUrl100: string;
    artistName: string;
    trackName: string;
    collectionName?: string;
  }>;
}

// Default placeholder icon as SVG data URL
export const DEFAULT_ALBUM_ART = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M9 18V5l12-2v13"/>
  <circle cx="6" cy="18" r="3"/>
  <circle cx="18" cy="16" r="3"/>
</svg>
`)}`;

export async function searchITunes(title: string, artist: string): Promise<string> {
  try {
    // Don't attempt search if title or artist is empty
    if (!title.trim() || !artist.trim()) {
      return DEFAULT_ALBUM_ART;
    }

    // Encode the search terms
    const query = encodeURIComponent(`${title} ${artist}`);
    const url = `https://itunes.apple.com/search?term=${query}&entity=song&limit=1`;

    const response = await fetch(url);
    if (!response.ok) {
      console.warn('iTunes API request failed:', response.statusText);
      return DEFAULT_ALBUM_ART;
    }

    const data: iTunesSearchResult = await response.json();

    if (data.resultCount > 0) {
      // Get the high resolution version by replacing '100x100' with '600x600'
      const artworkUrl = data.results[0].artworkUrl100.replace('100x100', '600x600');
      
      // Verify the URL is valid
      try {
        const artworkResponse = await fetch(artworkUrl, { method: 'HEAD' });
        if (artworkResponse.ok) {
          return artworkUrl;
        }
      } catch (error) {
        console.warn('Album art URL validation failed:', error);
      }
    }

    return DEFAULT_ALBUM_ART;
  } catch (error) {
    console.warn('Error fetching iTunes data:', error);
    return DEFAULT_ALBUM_ART;
  }
}