"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-surface)] gap-[var(--space-4)]">
      <h2 className="text-[var(--font-size-2xl)] font-semibold text-[var(--color-text-primary)]">
        Something went wrong
      </h2>
      <p className="text-[var(--font-size-sm)] text-[var(--color-text-muted)] max-w-sm text-center">
        {error.message || "An unexpected error occurred. Please try again."}
      </p>
      <button
        onClick={reset}
        className="px-[var(--space-4)] py-[var(--space-2)] rounded-[var(--radius-md)] text-[var(--font-size-sm)] font-medium transition-colors"
        style={{ background: "var(--color-primary)", color: "var(--color-white)" }}
      >
        Try again
      </button>
    </div>
  );
}
