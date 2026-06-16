import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import type React from "react";

import type { JoinPagePayload } from "@snc/shared";

import { RouteErrorBoundary } from "../../components/error/route-error-boundary.js";
import { fetchApiServer } from "../../lib/api-server.js";
import { authClient } from "../../lib/auth-client.js";
import { useSession } from "../../lib/auth.js";
import { apiMutate } from "../../lib/fetch-utils.js";
import { useCheckout } from "../../hooks/use-checkout.js";
import styles from "./join.module.css";

export const Route = createFileRoute("/join/$handle")({
  loader: async ({ params }): Promise<JoinPagePayload> => {
    return (await fetchApiServer({
      data: `/api/join/${params.handle}`,
    })) as JoinPagePayload;
  },
  errorComponent: RouteErrorBoundary,
  component: JoinPage,
});

type Step = "capture" | "code" | "welcome" | "preferences" | "explainer" | "done";

function JoinPage(): React.ReactElement {
  const payload = Route.useLoaderData();
  const session = useSession();
  const isLoggedIn = session.data?.user != null;
  // useSession resolves AFTER mount (no SSR priming), so derive the entry branch
  // live during render — never seed it into useState, or a logged-in fan whose
  // session resolves post-mount gets stranded on a stale initial step.
  const sessionPending = session.isPending === true;

  // `step` tracks progression WITHIN a flow only; the capture/authed entry is
  // render-derived from isLoggedIn below.
  const [step, setStep] = useState<Step>("capture");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { creator, config } = payload;

  // The follow + consent server action.
  const completeJoin = async (): Promise<void> => {
    await apiMutate(`/api/join/${creator.id}/complete`, { body: { consent: true } });
  };

  // Step 1 → send OTP.
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
      setStep("code");
    } catch {
      setError("Couldn't send a code. Check the email and try again.");
    } finally {
      setBusy(false);
    }
  };

  // Step 2 → verify OTP, set name, follow + consent.
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
      await authClient.updateUser({ name });
      await completeJoin();
      setStep("welcome");
    } catch {
      setError("Signed in, but couldn't finish. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // Authed short-circuit → one-tap follow + consent.
  const handleOneTapJoin = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await completeJoin();
      setStep("preferences");
    } catch {
      setError("Couldn't follow. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const advanceFromWelcome = (): void => setStep("preferences");
  const advanceFromPreferences = (): void => {
    setStep(config.showSncExplainer || config.showSubscribeCta ? "explainer" : "done");
  };

  // At entry (step hasn't advanced), the path is render-derived from the live
  // session state — never from a stale initial useState.
  const atEntry = step === "capture";

  return (
    <main className={styles.page}>
      <BandHeader creator={creator} />

      {atEntry && sessionPending && <p className={styles.lead}>Loading…</p>}

      {atEntry && !sessionPending && isLoggedIn && (
        <AuthedJoinStep
          displayName={creator.displayName}
          busy={busy}
          error={error}
          onJoin={handleOneTapJoin}
        />
      )}

      {atEntry && !sessionPending && !isLoggedIn && (
        <CaptureStep
          name={name}
          email={email}
          consent={consent}
          incentiveText={config.incentiveText}
          busy={busy}
          error={error}
          onName={setName}
          onEmail={setEmail}
          onConsent={setConsent}
          onSubmit={handleSendOtp}
        />
      )}

      {step === "code" && (
        <CodeStep otp={otp} busy={busy} error={error} onOtp={setOtp} onSubmit={handleVerifyOtp} />
      )}

      {step === "welcome" && (
        <WelcomeStep
          displayName={creator.displayName}
          incentiveText={config.incentiveText}
          onNext={advanceFromWelcome}
        />
      )}

      {step === "preferences" && (
        <PreferencesStep onNext={advanceFromPreferences} />
      )}

      {step === "explainer" && (
        <ExplainerStep
          payload={payload}
          onDone={() => setStep("done")}
        />
      )}

      {step === "done" && (
        <p className={styles.done}>You're all set — thanks for joining {creator.displayName}.</p>
      )}
    </main>
  );
}

// ── Steps ──

function BandHeader({ creator }: { creator: JoinPagePayload["creator"] }): React.ReactElement {
  return (
    <header className={styles.bandHeader}>
      {creator.avatar && (
        <img
          className={styles.bandAvatar}
          src={creator.avatar.src}
          srcSet={creator.avatar.srcSet ?? undefined}
          alt=""
        />
      )}
      <h1 className={styles.bandName}>Join {creator.displayName}</h1>
    </header>
  );
}

function CaptureStep({
  name, email, consent, incentiveText, busy, error,
  onName, onEmail, onConsent, onSubmit,
}: {
  name: string; email: string; consent: boolean; incentiveText: string | null;
  busy: boolean; error: string | null;
  onName: (v: string) => void; onEmail: (v: string) => void;
  onConsent: (v: boolean) => void; onSubmit: (e: React.FormEvent) => void;
}): React.ReactElement {
  return (
    <form className={styles.step} onSubmit={onSubmit}>
      {incentiveText && <p className={styles.incentive}>{incentiveText}</p>}
      <label className={styles.label} htmlFor="join-name">Your name</label>
      <input id="join-name" className={styles.input} value={name} onChange={(e) => onName(e.target.value)} required />
      <label className={styles.label} htmlFor="join-email">Email</label>
      <input id="join-email" className={styles.input} type="email" value={email} onChange={(e) => onEmail(e.target.value)} required />
      <label className={styles.consent}>
        <input type="checkbox" checked={consent} onChange={(e) => onConsent(e.target.checked)} required />
        <span>
          I agree to be contacted by email. See our{" "}
          <a href="/privacy" target="_blank" rel="noreferrer">privacy policy</a>.
        </span>
      </label>
      <button type="submit" className={styles.submit} disabled={busy || !consent || !name || !email}>
        {busy ? "…" : "Continue"}
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </form>
  );
}

function CodeStep({
  otp, busy, error, onOtp, onSubmit,
}: {
  otp: string; busy: boolean; error: string | null;
  onOtp: (v: string) => void; onSubmit: (e: React.FormEvent) => void;
}): React.ReactElement {
  return (
    <form className={styles.step} onSubmit={onSubmit}>
      <label className={styles.label} htmlFor="join-otp">Enter the code we emailed you</label>
      <input
        id="join-otp" className={styles.input} type="text" inputMode="numeric"
        autoComplete="one-time-code" value={otp} onChange={(e) => onOtp(e.target.value)} required
      />
      <button type="submit" className={styles.submit} disabled={busy || otp.length === 0}>
        {busy ? "…" : "Confirm"}
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </form>
  );
}

function AuthedJoinStep({
  displayName, busy, error, onJoin,
}: {
  displayName: string; busy: boolean; error: string | null; onJoin: () => void;
}): React.ReactElement {
  return (
    <div className={styles.step}>
      <p className={styles.lead}>Follow {displayName} and we'll keep you in the loop.</p>
      <button type="button" className={styles.submit} onClick={onJoin} disabled={busy}>
        {busy ? "…" : `Follow ${displayName}`}
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

function WelcomeStep({
  displayName, incentiveText, onNext,
}: {
  displayName: string; incentiveText: string | null; onNext: () => void;
}): React.ReactElement {
  return (
    <div className={styles.step}>
      <h2 className={styles.welcomeHeading}>You're in! 🎉</h2>
      <p className={styles.lead}>
        You're now following {displayName}. We'll let you know when there's something new.
      </p>
      {incentiveText && (
        <p className={styles.incentiveCallout}>
          Show this screen at the merch desk: <strong>{incentiveText}</strong>
        </p>
      )}
      <button type="button" className={styles.submit} onClick={onNext}>Next</button>
    </div>
  );
}

function PreferencesStep({ onNext }: { onNext: () => void }): React.ReactElement {
  const [busy, setBusy] = useState(false);
  const [goLive, setGoLive] = useState(true);
  const [newContent, setNewContent] = useState(true);

  const save = async (): Promise<void> => {
    setBusy(true);
    try {
      await apiMutate("/api/me/notifications", {
        method: "PUT",
        body: { eventType: "go_live", channel: "email", enabled: goLive },
      });
      await apiMutate("/api/me/notifications", {
        method: "PUT",
        body: { eventType: "new_content", channel: "email", enabled: newContent },
      });
    } finally {
      setBusy(false);
      onNext();
    }
  };

  return (
    <div className={styles.step}>
      <h2 className={styles.welcomeHeading}>How should we reach you?</h2>
      <label className={styles.consent}>
        <input type="checkbox" checked={goLive} onChange={(e) => setGoLive(e.target.checked)} />
        <span>Email me when the band goes live</span>
      </label>
      <label className={styles.consent}>
        <input type="checkbox" checked={newContent} onChange={(e) => setNewContent(e.target.checked)} />
        <span>Email me about new releases</span>
      </label>
      <button type="button" className={styles.submit} onClick={() => void save()} disabled={busy}>
        {busy ? "…" : "Save & continue"}
      </button>
    </div>
  );
}

function ExplainerStep({
  payload, onDone,
}: {
  payload: JoinPagePayload; onDone: () => void;
}): React.ReactElement {
  const { config, creatorPlans } = payload;
  const { checkoutLoading, handleCheckout } = useCheckout();

  return (
    <div className={styles.explainer}>
      {config.showSncExplainer && (
        <section className={styles.sncBlock}>
          <h2 className={styles.sncHeading}>What is S/NC?</h2>
          <p className={styles.sncText}>
            This band publishes on S/NC, a cooperative platform. Subscribing lets S/NC pick up
            artists like this one as a label and help produce their work — you support the band
            through the co-op.
          </p>
        </section>
      )}
      {config.showSubscribeCta && creatorPlans.length > 0 && (
        <section className={styles.plans}>
          {creatorPlans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              className={styles.planCard}
              onClick={() => void handleCheckout(plan.id)}
              disabled={checkoutLoading}
            >
              <span className={styles.planName}>{plan.name}</span>
              <span className={styles.planPrice}>
                ${(plan.price / 100).toFixed(2)}/{plan.interval}
              </span>
            </button>
          ))}
        </section>
      )}
      <button type="button" className={styles.skip} onClick={onDone}>
        Done / maybe later
      </button>
    </div>
  );
}
