import React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AppShell } from "@/components/shell/app-shell";

export default async function TerminalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAuthed = await getSession();

  // If not authenticated and ADMIN_PASSWORD is set, redirect to /login
  if (!isAuthed && process.env.ADMIN_PASSWORD) {
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}
