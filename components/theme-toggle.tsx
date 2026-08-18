"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

/**
 * Cycles light → dark → system.
 *
 * "System" is kept as a real option rather than a hidden default: someone whose
 * laptop switches at sunset should be able to have the app follow it.
 */
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // The server cannot know the user's theme, so rendering the real icon before
  // mount would guarantee a hydration mismatch. Render a placeholder instead.
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Change theme"
        disabled
      >
        <span className="size-4" />
      </Button>
    );
  }

  const next =
    theme === "light" ? "dark" : theme === "dark" ? "system" : "light";

  const label =
    theme === "system"
      ? `System theme (currently ${resolvedTheme})`
      : theme === "dark"
        ? "Dark theme"
        : "Light theme";

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(next)}
      title={`${label}. Click for ${next}.`}
      aria-label={`${label}. Switch to ${next}.`}
    >
      {theme === "system" ? <MonitorIcon /> : theme === "dark" ? <MoonIcon /> : <SunIcon />}
    </Button>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
