import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export function UnverifiedBanner() {
  const { user, profile } = useAuth();
  const [sending, setSending] = useState(false);

  if (!user) return null;
  // email_confirmed_at is set by Supabase once verified.
  if (user.email_confirmed_at) return null;

  const createdAt = profile?.created_at ? new Date(profile.created_at).getTime() : Date.now();
  const ageDays = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
  const escalated = ageDays >= 7;

  const onResend = async () => {
    if (!user.email) return;
    setSending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: user.email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Verification email sent");
    }
  };

  return (
    <div
      className={
        "w-full border-b px-4 py-2 text-sm " +
        (escalated
          ? "border-destructive/40 bg-destructive/15 text-destructive"
          : "border-accent/30 bg-accent/10 text-foreground")
      }
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2">
        <span>
          {escalated
            ? "Your email still isn't verified. Verify now to enable purchasing and secure your account."
            : "Verify your email to enable purchasing."}
        </span>
        <button
          type="button"
          onClick={onResend}
          disabled={sending}
          className="rounded-md border border-current px-3 py-1 text-xs font-medium hover:bg-current/10 disabled:opacity-60"
        >
          {sending ? "Sending…" : "Resend verification email"}
        </button>
      </div>
    </div>
  );
}
