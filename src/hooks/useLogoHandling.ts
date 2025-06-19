import { useCallback } from 'react';

export function useLogoHandling() {
  const handleError = useCallback((e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error("Logo failed to load:", e.currentTarget.src);
    
    if (!e.currentTarget) return;
    
    e.currentTarget.style.display = 'none';
    
    const parent = e.currentTarget.parentElement;
    if (parent && !parent.querySelector('.logo-fallback')) {
      const fallbackIcon = document.createElement('div');
      fallbackIcon.className = 'logo-fallback flex justify-center';
      fallbackIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80" viewBox="0 0 240 80" fill="none"><text x="80" y="45" font-family="sans-serif" font-size="28" font-weight="bold" fill="#ff00ff">uRequest Live</text></svg>';
      parent.appendChild(fallbackIcon);
    }
  }, []);

  return { handleError };
}