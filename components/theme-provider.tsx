"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Wraps next-themes, which writes `class="dark"` onto <html> before first
 * paint. globals.css defines the dark variant as `&:is(.dark *)`, so that one
 * class is what flips every token in the file.
 *
 * The inline script it injects is why <html> needs suppressHydrationWarning:
 * the class is added before React hydrates, so server and client markup differ
 * by design.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
