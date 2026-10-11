"use client";

import { useRouter } from "next/navigation";

interface FeatureNotAvailableProps {
  title?: string;
  description?: string;
}

export default function FeatureNotAvailable({
  title = "Feature Coming Soon",
  description = "This section is not yet available in the current version.",
}: FeatureNotAvailableProps) {
  const router = useRouter();

  return (
    <div className="flex flex-1 items-center justify-center min-h-[400px]">
      <div className="text-center max-w-md p-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="text-5xl mb-4">🔧</div>
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">{title}</h2>
        <p className="text-[var(--color-text-secondary)] mb-6">{description}</p>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 rounded-md bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}
