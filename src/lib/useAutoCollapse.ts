'use client';

import { useEffect } from 'react';

/**
 * Tablet / small-laptop range: wide enough for the md: desktop layout, but too
 * narrow to fit both expanded sidebars beside the document.
 */
export const COMPACT_LAYOUT_QUERY = '(min-width: 768px) and (max-width: 1279.98px)';

/**
 * Collapses a sidebar to its icon rail when the viewport is in the compact range,
 * and expands it again above it. Runs on mount and only when the viewport crosses
 * a boundary, so a manual toggle in between is left alone. Below md: the sidebar
 * is a mobile drawer, so it is always expanded there.
 */
export function useAutoCollapse(setCollapsed: (collapsed: boolean) => void) {
  useEffect(() => {
    const mql = window.matchMedia(COMPACT_LAYOUT_QUERY);
    setCollapsed(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setCollapsed(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [setCollapsed]);
}
