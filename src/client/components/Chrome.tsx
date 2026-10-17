import { Link, useLocation } from "wouter";
import { cn } from "./ui/primitives";

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <circle cx="25" cy="32" r="15" fill="#0f766e" fillOpacity="0.85" />
      <circle cx="39" cy="32" r="15" fill="#7e3a8c" fillOpacity="0.85" />
      <path d="M32 18.6a15 15 0 0 1 0 26.8a15 15 0 0 1 0-26.8z" fill="#2f4b8f" />
    </svg>
  );
}

export function Header() {
  const [location] = useLocation();
  const nav = [
    { href: "/workspace/guest", label: "Workspace", short: "Workspace", active: location.startsWith("/workspace") },
    { href: "/methodology", label: "Method & limits", short: "Method", active: location === "/methodology" },
  ];
  return (
    <header className="no-print border-b border-line/80 bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:gap-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2 rounded-md sm:gap-2.5">
          <Logo className="size-8 shrink-0" />
          <span className="font-display text-lg font-semibold tracking-tight whitespace-nowrap text-ink max-[359px]:sr-only">Room for Both</span>
        </Link>
        <nav aria-label="Main" className="flex shrink-0 items-center gap-0.5 text-sm sm:gap-1">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={n.active ? "page" : undefined}
              className={cn("rounded-md px-2 py-2 font-medium text-ink-soft hover:bg-sunken hover:text-ink sm:px-3", n.active && "text-ink")}
            >
              <span className="hidden sm:inline">{n.label}</span>
              <span className="sm:hidden">{n.short}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

// The public repository URL is supplied at build time so the footer never shows a placeholder link.
const REPOSITORY_URL = import.meta.env.VITE_REPOSITORY_URL as string | undefined;

export function Footer() {
  return (
    <footer className="no-print mt-16 border-t border-line bg-sunken/50">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          <span className="font-display font-semibold text-ink">Room for Both</span> — decision support, not a contract. Every brief is a draft for people to review.
        </p>
        <p className="flex gap-4">
          <Link href="/methodology" className="link">
            Method, data use &amp; limits
          </Link>
          <a className="link" href="/third-party-licenses.md">
            Open-source licences
          </a>
          {REPOSITORY_URL && (
            <a className="link" href={REPOSITORY_URL} rel="noreferrer">
              Source code
            </a>
          )}
        </p>
      </div>
    </footer>
  );
}
