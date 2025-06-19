import { useEffect, useRef, useState } from 'react';

/**
 * Custom hook to manage scroll behavior for the application
 * 
 * Controls when the header should be hidden or shown based on scroll direction
 * without adding additional header components to the DOM.
 */
export function useScrollBehavior(threshold = 50) {
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [hasScrolledDown, setHasScrolledDown] = useState(false);
  const lastScrollY = useRef(0);
  
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Determine if we're scrolling up or down
      const isScrollingDown = currentScrollY > lastScrollY.current;
      
      // Set hasScrolledDown once user has scrolled past threshold
      if (!hasScrolledDown && currentScrollY > threshold) {
        setHasScrolledDown(true);
      } else if (currentScrollY === 0) {
        setHasScrolledDown(false);
      }
      
      // Control header visibility based on scroll direction
      if (isScrollingDown && currentScrollY > threshold) {
        // When scrolling down past threshold, hide header
        setIsHeaderVisible(false);
      } else if (!isScrollingDown) {
        // When scrolling up, show header
        setIsHeaderVisible(true);
      }
      
      // Save current scroll position
      lastScrollY.current = currentScrollY;
    };
    
    // Add scroll event listener with passive option for better performance
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [threshold, hasScrolledDown]);
  
  return {
    isHeaderVisible,
    hasScrolledDown
  };
}