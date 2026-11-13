"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * TopLoader: Sleek horizontal violet loading bar that sweeps across the very top of
 * the viewport during route transitions, providing instant visual feedback.
 */
export function TopLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // When path or query params change, animate the progress bar
    setLoading(true);
    const timer = setTimeout(() => {
      setLoading(false);
    }, 350);

    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  if (!loading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-1 overflow-hidden bg-transparent pointer-events-none">
      <div className="h-full bg-gradient-to-r from-violet-600 via-indigo-500 to-fuchsia-500 animate-[progress-bar_0.8s_ease-in-out_infinite] shadow-[0_0_10px_rgba(124,58,237,0.7)]" />
    </div>
  );
}

export default TopLoader;

