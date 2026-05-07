import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth/sign-in")({
  head: () => ({ meta: [{ title: "Log in — MyoTime" }] }),
  component: SignInPage,
});

function SignInPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: err } = await signIn(email, password);
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
        <h1 className="text-2xl font-bold">Log in</h1>
        <p className="mt-1 text-sm text-muted-foreground">Welcome back to MyoTime.</p>

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
            <span className="mb-1 block text-sm text-muted-foreground">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 outline-none focus:border-accent"
            />
          </label>
          <button type="submit" disabled={submitting} className="myo-btn w-full disabled:opacity-60">
            {submitting ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link to="/auth/sign-up" className="text-accent hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
