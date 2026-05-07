import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ title: "Confirming — MyoTime" }] }),
  component: CallbackPage,
});

function CallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"working" | "error">("working");
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const token_hash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type") as
          | "signup"
          | "email"
          | "recovery"
          | "magiclink"
          | "invite"
          | null;
        const errDesc = url.searchParams.get("error_description") || url.hash.match(/error_description=([^&]+)/)?.[1];

        if (errDesc) {
          setStatus("error");
          setError(decodeURIComponent(errDesc));
          return;
        }

        if (token_hash && type) {
          const { error } = await supabase.auth.verifyOtp({ token_hash, type });
          if (error) {
            setStatus("error");
            setError(error.message);
            return;
          }
        } else {
          // Hash-based session (detectSessionInUrl=true) — give SDK a tick.
          await new Promise(r => setTimeout(r, 100));
        }

        const { data } = await supabase.auth.getUser();
        setEmail(data.user?.email ?? null);

        if (type === "recovery") {
          navigate({ to: "/auth/reset-password", replace: true });
          return;
        }
        navigate({ to: "/", replace: true });
      } catch (e: unknown) {
        setStatus("error");
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    })();
  }, [navigate]);

  const onResend = async () => {
    if (!email) {
      toast.error("Enter your email on the sign-in page and try Resend from there.");
      return;
    }
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setResending(false);
    if (error) toast.error(error.message);
    else toast.success("Verification email sent");
  };

  return (
    <div className="honeycomb-bg flex min-h-screen items-center justify-center px-4">
      <div className="myo-card w-full max-w-sm p-6 text-center">
        {status === "working" ? (
          <>
            <h1 className="text-xl font-semibold">Confirming…</h1>
            <p className="mt-2 text-sm text-muted-foreground">One moment.</p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold">Link invalid or expired</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <button
              type="button"
              onClick={onResend}
              disabled={resending}
              className="myo-btn mt-4 w-full disabled:opacity-60"
            >
              {resending ? "Sending…" : "Resend verification email"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
