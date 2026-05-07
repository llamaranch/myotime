import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth/forgot-password")({
  head: () => ({ meta: [{ title: "Forgot password — MyoTime" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setSubmitting(false);
    setSubmitted(true);
  };

  return (
    <div className="honeycomb-bg flex min-h-screen items-center justify-center px-4">
      <div className="myo-card w-full max-w-sm p-6">
        <h1 className="text-2xl font-bold">Reset your password</h1>

        {submitted ? (
          <>
            <p className="mt-4 text-sm text-muted-foreground">
              If an account exists for that email, we've sent a password reset link. Check your inbox.
            </p>
            <Link to="/auth/sign-in" className="myo-btn mt-5 inline-block w-full text-center">
              Back to log in
            </Link>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your email and we'll send you a reset link.
            </p>
            <form onSubmit={onSubmit} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm text-muted-foreground">Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-2 outline-none focus:border-accent"
                />
              </label>
              <button type="submit" disabled={submitting} className="myo-btn w-full disabled:opacity-60">
                {submitting ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <p className="mt-5 text-center text-sm text-muted-foreground">
              Remembered it?{" "}
              <Link to="/auth/sign-in" className="text-accent hover:underline">Log in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
