import { ThemeToggle } from "@/components/theme-toggle";

/**
 * The signed-out pages have no header, so the toggle sits in the corner —
 * someone should not have to log in to stop the screen glaring at them.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="fixed right-4 top-4 z-10">
        <ThemeToggle />
      </div>
      {children}
    </>
  );
}
