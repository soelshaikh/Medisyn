import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-surface)] gap-[var(--space-4)]">
      <h1 className="text-[var(--font-size-4xl)] font-bold text-[var(--color-text-primary)]">404</h1>
      <p className="text-[var(--font-size-lg)] text-[var(--color-text-secondary)]">Page not found</p>
      <Link
        href="/dashboard"
        className="text-[var(--font-size-sm)] text-[var(--color-primary)] hover:underline"
      >
        Return to Dashboard
      </Link>
    </div>
  );
}
