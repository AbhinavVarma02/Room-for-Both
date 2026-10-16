import { Link } from "wouter";

export function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
      <p className="eyebrow">Page not found</p>
      <h1 className="mt-3 text-3xl font-semibold">There's nothing at this address</h1>
      <p className="mt-3 text-ink-soft">The page may have moved, or the link may be incomplete.</p>
      <Link href="/" className="link mt-6 inline-block">
        Go to the home page
      </Link>
    </div>
  );
}
