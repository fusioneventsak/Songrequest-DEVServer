import { useEffect, useRef, useState } from 'react';

/**
 * Custom hook to handle smooth scrolling and sticky header behavior
 * 
 * @param {number} headerHeight - The height of the header in pixels
 * @param {number} [threshold=50] - The scroll threshold to trigger header visibility change
 * @returns Object containing refs and state values for implementing sticky header
 */
export function useStickyHeader(headerHeight: number, threshold = 50) {
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isScrollingUp, setIsScrollingUp] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const lastScrollY = useRef(0);
  const headerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // We add an option to prevent race conditions with events
    let isUpdating = false;

    const handleScroll = () => {
      // Avoid multiple rapid updates
      if (isUpdating) return;
      
      isUpdating = true;
      
      // Use requestAnimationFrame for better performance
      window.requestAnimationFrame(() => {
        try {
          const currentScrollY = window.scrollY;
          
          // Determine if we're scrolling up or down
          const isScrollingDown = currentScrollY > lastScrollY.current;
          setIsScrollingUp(!isScrollingDown);
  
          // Set hasScrolled to true once user has scrolled past threshold
          if (!hasScrolled && currentScrollY > threshold) {
            setHasScrolled(true);
          }
          
          // Hide header when scrolling down past threshold
          if (isScrollingDown && currentScrollY > threshold) {
            setIsHeaderVisible(false);
          } 
          // Show header when scrolling up
          else if (!isScrollingDown) {
            setIsHeaderVisible(true);
            
            // Reset hasScrolled when we scroll back to top
            if (currentScrollY === 0) {
              setHasScrolled(false);
            }
          }
          
          // Remember last scroll position
          lastScrollY.current = currentScrollY;
        } catch (err) {
          console.error('Error in scroll handler:', err);
        } finally {
          isUpdating = false;
        }
      });
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Apply initial padding to content area to account for header height
    if (contentRef.current) {
      contentRef.current.style.paddingTop = `${headerHeight}px`;
    }
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [headerHeight, threshold, hasScrolled]);
  
  return {
    headerRef,
    contentRef,
    isHeaderVisible,
    isScrollingUp,
    hasScrolled
  };
}