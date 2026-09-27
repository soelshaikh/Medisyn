"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { filesApi, isStorageKey } from "@/api/files.api";

interface Props {
  fileUrl:   string;
  label?:    string;
  className?: string;
}

/**
 * Renders a link to a document.
 * - If the value is already an http/https URL, opens it directly.
 * - If it's a storage key, calls /files/signed-url first, then opens the result.
 */
export function SecureDocumentLink({ fileUrl, label = "View Attachment", className }: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isStorageKey(fileUrl)) return; /* let the browser follow href directly */
    e.preventDefault();
    setLoading(true);
    try {
      const signedUrl = await filesApi.getSignedUrl(fileUrl);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      alert("Could not load document. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <a
      href={isStorageKey(fileUrl) ? "#" : fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={[
        "inline-flex items-center gap-1.5 text-[var(--font-size-xs)] text-[var(--color-primary)] font-semibold hover:underline",
        loading ? "opacity-60 pointer-events-none" : "",
        className ?? "",
      ].join(" ")}
    >
      {loading
        ? <Loader2 size={12} className="animate-spin" />
        : <FileText size={12} />
      }
      {label}
    </a>
  );
}
