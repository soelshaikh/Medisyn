"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Eye, EyeOff, User, X } from "lucide-react";
import apiClient from "@/lib/apiClient";
import { useAdminAuthStore } from "@/stores/adminAuthStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const STORAGE_KEY = "admin_saved_accounts";
const MAX_SAVED   = 5;

interface SavedAccount { email: string; password: string }

function loadSaved(): SavedAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedAccount[]) : [];
  } catch { return []; }
}

function saveToDisk(accounts: SavedAccount[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

export default function AdminLoginPage() {
  const router = useRouter();
  const { setAuth, clearAuth, isAuthenticated, _hasHydrated } = useAdminAuthStore();

  const [email,          setEmail]          = useState("");
  const [password,       setPassword]       = useState("");
  const [showPassword,   setShowPassword]   = useState(false);
  const [rememberMe,     setRememberMe]     = useState(false);
  const [error,          setError]          = useState("");
  const [savedAccounts,   setSavedAccounts]   = useState<SavedAccount[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIdx,    setHighlightIdx]    = useState(-1);

  const emailWrapperRef = useRef<HTMLDivElement>(null);

  /* Load saved accounts + remember-me preference after mount */
  useEffect(() => {
    const accounts = loadSaved();
    setSavedAccounts(accounts);
    const remembered = localStorage.getItem("admin_remember_me") === "true";
    setRememberMe(remembered);
    if (remembered && accounts.length > 0) {
      setEmail(accounts[0].email);
      setPassword(accounts[0].password);
    }
  }, []);

  /* Close suggestion dropdown on outside click */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (emailWrapperRef.current && !emailWrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  /* Redirect if already authenticated */
  useEffect(() => {
    if (!_hasHydrated) return;
    if (isAuthenticated) {
      const token = sessionStorage.getItem("access_token");
      if (token) { router.replace("/dashboard"); }
      else        { clearAuth(); }
    }
  }, [_hasHydrated, isAuthenticated, router, clearAuth]);

  function selectAccount(acc: SavedAccount) {
    setEmail(acc.email);
    setPassword(acc.password);
    setShowSuggestions(false);
    setHighlightIdx(-1);
  }

  function handleEmailKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && highlightIdx >= 0) {
      e.preventDefault();
      selectAccount(suggestions[highlightIdx]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setHighlightIdx(-1);
    }
  }

  function removeAccount(e: React.MouseEvent, email: string) {
    e.stopPropagation();
    const updated = savedAccounts.filter((a) => a.email !== email);
    setSavedAccounts(updated);
    saveToDisk(updated);
  }

  const login = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post("/auth/super-admin/login", { email, password });
      return res.data.data;
    },
    onSuccess: (data) => {
      /* Persist credentials if "Remember me" is checked */
      localStorage.setItem("admin_remember_me", String(rememberMe));
      if (rememberMe) {
        const filtered = savedAccounts.filter((a) => a.email !== email);
        const updated  = [{ email, password }, ...filtered].slice(0, MAX_SAVED);
        setSavedAccounts(updated);
        saveToDisk(updated);
      }

      setAuth(
        {
          id:          data.user.id,
          email:       data.user.email,
          fullName:    data.user.fullName,
          roles:       data.user.roles ?? [],
          permissions: data.user.permissions ?? [],
        },
        data.accessToken,
      );
      router.replace("/dashboard");
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "Invalid email or password");
    },
  });

  /* Filtered suggestions matching current email input */
  const suggestions = savedAccounts.filter((a) =>
    email === "" || a.email.toLowerCase().includes(email.toLowerCase()),
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface)] px-4">
      <div className="w-full max-w-sm bg-[var(--color-white)] rounded-[var(--radius-xl)] shadow-[var(--shadow-lg)] p-8">
        <div className="mb-8 text-center">
          <h1 className="text-[var(--font-size-2xl)] font-bold text-[var(--color-text-primary)]">
            MediSyn Admin
          </h1>
          <p className="mt-1 text-[var(--font-size-sm)] text-[var(--color-text-muted)]">
            Sign in to the administration panel
          </p>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); setError(""); login.mutate(); }}
          className="flex flex-col gap-[var(--space-4)]"
        >
          {/* Email with saved-accounts dropdown */}
          <div ref={emailWrapperRef} className="relative">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setShowSuggestions(true); setHighlightIdx(-1); }}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              onKeyDown={handleEmailKeyDown}
              required
              autoComplete="off"
              placeholder="admin@medisyn.ca"
            />

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-50 top-full mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-lg)] overflow-hidden">
                {suggestions.map((acc, idx) => (
                  <li
                    key={acc.email}
                    onMouseDown={() => selectAccount(acc)}
                    onMouseEnter={() => setHighlightIdx(idx)}
                    onMouseLeave={() => setHighlightIdx(-1)}
                    className={[
                      "flex items-center gap-3 px-3 py-2.5 cursor-pointer group transition-colors",
                      highlightIdx === idx
                        ? "bg-[var(--color-primary-light)]"
                        : "hover:bg-[var(--color-primary-light)]",
                    ].join(" ")}
                  >
                    <div className="w-7 h-7 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center shrink-0">
                      <User size={13} className="text-[var(--color-primary)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[var(--font-size-sm)] font-medium text-[var(--color-text-primary)] truncate">
                        {acc.email}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">
                        {"•".repeat(Math.min(acc.password.length, 10))}
                      </p>
                    </div>
                    <button
                      type="button"
                      onMouseDown={(e) => removeAccount(e, acc.email)}
                      className="shrink-0 p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-[var(--color-error-light)] transition-colors opacity-0 group-hover:opacity-100"
                      title="Remove saved account"
                    >
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Password with eye toggle */}
          <Input
            label="Password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors focus:outline-none"
                tabIndex={-1}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
          />

          {/* Remember me */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded accent-[var(--color-primary)] cursor-pointer"
            />
            <span className="text-[var(--font-size-sm)] text-[var(--color-text-secondary)]">
              Remember me
            </span>
          </label>

          {error && (
            <p className="text-[var(--font-size-sm)] text-[var(--color-error)]">{error}</p>
          )}

          <Button type="submit" loading={login.isPending} fullWidth>
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
