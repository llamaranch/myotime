import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth/sign-up")({
  head: () => ({ meta: [{ title: "Sign up — MyoTime" }] }),
  component: SignUpPage,
});

function SignUpPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    const { error: err } = await signUp(email, password, marketingOptIn);
    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
    navigate({ to: "/" });
  };

  return (
    <div className="honeycomb-bg flex min-h-screen items-center justify-center px-4">
      <div className="myo-card w-full max-w-sm p-6">
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign up to start building workouts.</p>

        {error && (
          <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

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
          <label className="block">
            <span className="mb-1 block text-sm text-muted-foreground">Password (min 8 characters)</span>
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
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={e => setMarketingOptIn(e.target.checked)}
              className="mt-1 accent-accent"
            />
            <span className="text-muted-foreground">
              Send me occasional emails about MyoTime updates and tips. (Optional)
            </span>
          </label>
          <button type="submit" disabled={submitting} className="myo-btn w-full disabled:opacity-60">
            {submitting ? "Signing up…" : "Sign up"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/auth/sign-in" className="text-accent hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
