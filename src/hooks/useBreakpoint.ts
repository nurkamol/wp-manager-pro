import { useState, useEffect } from 'react'

interface Breakpoint {
  isMobile: boolean   // < 768px
  isTablet: boolean   // 768–1023px
  isDesktop: boolean  // >= 1024px
}

function getBreakpoint(): Breakpoint {
  const w = window.innerWidth
  return {
    isMobile:  w < 768,
    isTablet:  w >= 768 && w < 1024,
    isDesktop: w >= 1024,
  }
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(getBreakpoint)

  useEffect(() => {
    const handler = () => setBp(getBreakpoint())
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  return bp
}
