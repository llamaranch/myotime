import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/reset-password")({
  head: () => ({ meta: [{ title: "Set new password — MyoTime" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const token_hash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type");
        const errDesc =
          url.searchParams.get("error_description") ||
          url.hash.match(/error_description=([^&]+)/)?.[1];

        if (errDesc) {
          setTokenError(decodeURIComponent(errDesc));
          return;
        }
        if (token_hash && type === "recovery") {
          const { error } = await supabase.auth.verifyOtp({ token_hash, type: "recovery" });
          if (error) {
            setTokenError(error.message);
            return;
          }
        } else {
          // Allow SDK to consume hash-style recovery tokens.
          await new Promise(r => setTimeout(r, 100));
        }
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setTokenError("Reset link is invalid or has expired.");
          return;
        }
        setReady(true);
      } catch (e: unknown) {
        setTokenError(e instanceof Error ? e.message : "Something went wrong");
      }
    })();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    toast.success("Password updated. Please log in.");
    await supabase.auth.signOut();
    navigate({ to: "/auth/sign-in", replace: true });
  };

  return (
    <div className="honeycomb-bg flex min-h-screen items-center justify-center px-4">
      <div className="myo-card w-full max-w-sm p-6">
        <h1 className="text-2xl font-bold">Set a new password</h1>

        {tokenError ? (
          <>
            <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {tokenError}
            </div>
            <Link to="/auth/forgot-password" className="myo-btn mt-5 inline-block w-full text-center">
              Start over
            </Link>
          </>
        ) : !ready ? (
          <p className="mt-4 text-sm text-muted-foreground">Verifying link…</p>
        ) : (
          <>
            {error && (
              <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <form onSubmit={onSubmit} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm text-muted-foreground">New password (min 8 characters)</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 outline-none focus:border-accent"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-muted-foreground">Confirm new password</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 outline-none focus:border-accent"
                />
              </label>
              <button type="submit" disabled={submitting} className="myo-btn w-full disabled:opacity-60">
                {submitting ? "Updating…" : "Update password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
