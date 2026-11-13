"use client";

import Link, { type LinkProps } from "next/link";
import React, { useState, createContext, useContext } from "react";
import { Menu, X } from "lucide-react";

// Aceternity UI — Sidebar (no-dependency version).
// Uses CSS transitions instead of framer-motion. Pass `animate={false}` on
// <Sidebar> to lock the rail at 240px with labels always visible.

function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

interface Links {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = (props: React.ComponentProps<"div">) => {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileSidebar {...props} />
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen, animate } = useSidebar();
  return (
    <div
      className={cn(
        "h-full hidden md:flex md:flex-col bg-surface shrink-0 overflow-hidden transition-[width] duration-200",
        animate ? (open ? "w-[240px]" : "w-16") : "w-[240px]",
        className,
      )}
      onMouseEnter={() => animate && setOpen(true)}
      onMouseLeave={() => animate && setOpen(false)}
      {...props}
    >
      {children}
    </div>
  );
};

export const MobileSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen } = useSidebar();
  return (
    <div
      className={cn(
        "h-14 px-4 flex flex-row md:hidden items-center justify-between bg-surface w-full border-b",
        "border-[var(--color-border)]",
      )}
      style={{ borderColor: "var(--color-border)" }}
      {...props}
    >
      <div className="flex justify-end z-20 w-full">
        <button
          onClick={() => setOpen(!open)}
          className="text-[var(--color-text)] p-1"
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>
      </div>
      {open && (
        <div
          className={cn(
            "fixed h-full w-full inset-0 bg-surface p-10 z-[100] flex flex-col",
            className,
          )}
        >
          <button
            className="absolute right-10 top-10 z-50 text-[var(--color-text)]"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
          {children}
        </div>
      )}
    </div>
  );
};

export const SidebarLink = ({
  link,
  className,
  ...props
}: {
  link: Links;
  className?: string;
} & Omit<LinkProps, "href">) => {
  const { open, animate } = useSidebar();
  return (
    <Link
      href={link.href}
      className={cn("flex items-center justify-start gap-2 group/sidebar py-2", className)}
      {...props}
    >
      {link.icon}
      <span
        className={cn(
          "text-inherit text-sm font-medium group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre",
          animate && !open ? "hidden opacity-0" : "inline-block opacity-100",
        )}
      >
        {link.label}
      </span>
    </Link>
  );
};

