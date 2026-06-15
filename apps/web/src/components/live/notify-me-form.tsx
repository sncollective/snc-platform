import { useState } from "react";
import type React from "react";

import { authClient } from "../../lib/auth-client.js";
import { useSession } from "../../lib/auth.js";
import { apiMutate } from "../../lib/fetch-utils.js";
import styles from "./notify-me-form.module.css";

type Step = "form" | "otp" | "done";

/**
 * Offline-page "notify me when live" capture. Logged-in users subscribe in one click;
 * anonymous users enter an email, receive an OTP (better-auth email-OTP sign-in, which
 * auto-creates the account), then are subscribed. Consent is explicit and required.
 */
export function NotifyMeForm({
  channelId,
  channelName,
}: {
  readonly channelId: string;
  readonly channelName: string;
}): React.ReactElement {
  const session = useSession();
  const isLoggedIn = session.data?.user != null;

  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subscribe = async (): Promise<void> => {
    // policyVersion is recorded server-side from the canonical constant; the
    // checkbox only conveys consent intent.
    await apiMutate("/api/notify-when-live", {
      body: { channelId, consent: true },
    });
    setStep("done");
  };

  // Logged-in: one-click subscribe.
  const handleOneClick = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await subscribe();
    } catch {
      setError("Couldn't subscribe. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // Anonymous: send the sign-in OTP.
  const handleSendOtp = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: otpError } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "sign-in",
      });
      if (otpError) throw new Error(otpError.message);
      setStep("otp");
    } catch {
      setError("Couldn't send a code. Check the email and try again.");
    } finally {
      setBusy(false);
    }
  };

  // Anonymous: verify OTP (creates+signs in), then subscribe. Distinguish the two
  // failures — once sign-in succeeds the user is authenticated, so a subscribe
  // failure must not look like a bad code (and the now-logged-in one-click path
  // becomes available on retry).
  const handleVerifyOtp = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: signInError } = await authClient.signIn.emailOtp({ email, otp });
    if (signInError) {
      setError("That code didn't work. Please try again.");
      setBusy(false);
      return;
    }
    try {
      await subscribe();
    } catch {
      setError("Signed in, but couldn't subscribe. Please try the button again.");
    } finally {
      setBusy(false);
    }
  };

  if (step === "done") {
    return (
      <p className={styles.success}>
        You're on the list — we'll email you when {channelName} goes live.
      </p>
    );
  }

  if (isLoggedIn) {
    return (
      <div className={styles.form}>
        <button
          type="button"
          className={styles.submit}
          onClick={() => void handleOneClick()}
          disabled={busy}
        >
          {busy ? "…" : `Notify me when ${channelName} is live`}
        </button>
        {error && <p className={styles.error}>{error}</p>}
      </div>
    );
  }

  if (step === "otp") {
    return (
      <form className={styles.form} onSubmit={(e) => void handleVerifyOtp(e)}>
        <label className={styles.label} htmlFor="notify-otp">
          Enter the code we emailed you
        </label>
        <input
          id="notify-otp"
          className={styles.input}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          required
        />
        <button type="submit" className={styles.submit} disabled={busy || otp.length === 0}>
          {busy ? "…" : "Confirm"}
        </button>
        {error && <p className={styles.error}>{error}</p>}
      </form>
    );
  }

  return (
    <form className={styles.form} onSubmit={(e) => void handleSendOtp(e)}>
      <label className={styles.label} htmlFor="notify-email">
        Notify me when {channelName} is live
      </label>
      <input
        id="notify-email"
        className={styles.input}
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <label className={styles.consent}>
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          required
        />
        <span>I agree to receive an email when this channel goes live.</span>
      </label>
      <button type="submit" className={styles.submit} disabled={busy || !consent || email.length === 0}>
        {busy ? "…" : "Notify me"}
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </form>
  );
}
