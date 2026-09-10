"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

/** True once the element has scrolled within `rootMargin` of the viewport — stays true
 * after that (used to lazily mount an expensive child, like a chart, exactly once). */
export function useInView<T extends HTMLElement = HTMLDivElement>(rootMargin = "200px"): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView, rootMargin]);

  return [ref, inView];
}
