"use client";

import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

import { getToken } from "@/lib/auth";

const PUBLIC = new Set(["/login"]);

/**
 * Client-side route guard. The token lives in localStorage, which Next middleware can't
 * read, so the check happens on mount: no token on a protected route → /login. The API
 * client also bounces on any 401, so an expired token can't leave you on a dead screen.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  const isPublic = PUBLIC.has(pathname);

  useEffect(() => {
    if (isPublic) {
      setReady(true);
      return;
    }
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [pathname, isPublic, router]);

  if (!ready) {
    return <div className="min-h-screen bg-bg" aria-busy="true" />;
  }
  return <>{children}</>;
}
