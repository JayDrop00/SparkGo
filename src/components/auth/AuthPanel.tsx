"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { playSfx, type SfxKind } from "@/lib/sfx";
import HudCorners from "../ui/HudCorners";
import Icon from "../ui/Icon";

type AuthMode = "login" | "signup";

function modeHref(mode: AuthMode) {
  return `/auth?mode=${mode}`;
}

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-accent";

const inputClass = `w-full rounded-xl border border-ink-border bg-ink-input px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-500 hover:border-theme-accent/50 focus:border-theme-accent focus:ring-4 focus:ring-theme-accent/10 ${focusRing}`;

const primaryCta = `group flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-br from-theme-accent to-theme-secondary px-4 py-3.5 font-display text-sm font-extrabold uppercase tracking-wider text-ink-base shadow-[0_0_20px_rgb(var(--theme-rgb)/0.3)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgb(var(--theme-rgb)/0.6)] active:translate-y-px ${focusRing}`;

const googleCta = `inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-ink-border bg-ink-card/70 px-4 font-display text-sm font-extrabold uppercase tracking-wider text-slate-200 backdrop-blur transition-colors hover:border-theme-accent hover:bg-ink-border ${focusRing}`;

/** Multicolor Google "G" (Icon.tsx is stroke/currentColor-only). */
function GoogleGlyph({ className = "h-[18px] w-[18px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  );
}

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const param = searchParams.get("mode");
  const mode: AuthMode = param === "signup" ? "signup" : "login";
  const [notice, setNotice] = useState("");
  const isSignup = mode === "signup";

  // Keep the URL explicit: bare or invalid ?mode= always normalizes to ?mode=login.
  useEffect(() => {
    if (param !== "login" && param !== "signup") {
      router.replace(modeHref("login"), { scroll: false });
    }
  }, [param, router]);

  function switchMode(nextMode: AuthMode, sfx: SfxKind = "click") {
    playSfx(sfx);
    setNotice("");
    router.replace(modeHref(nextMode), { scroll: false });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    playSfx("launch");
    setNotice("Your account service isn’t connected yet.");
  }

  function handleGoogle() {
    playSfx("click");
    setNotice("Google sign-in isn’t connected yet.");
  }

  return (
    <main className="relative isolate flex min-h-screen flex-col overflow-hidden bg-ink-base font-ui text-slate-100 selection:bg-theme-accent/40">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[650px] w-[650px] rounded-full bg-theme-accent opacity-25 blur-[120px] transition-colors duration-700" />
        <div className="absolute -bottom-32 -right-32 h-[650px] w-[650px] rounded-full bg-theme-secondary opacity-15 blur-[120px] transition-colors duration-700" />
        <div className="absolute inset-0 bg-[radial-gradient(#1b2d40_1px,transparent_1px)] opacity-25 [background-size:24px_24px]" />
      </div>

      <header className="relative z-10 border-b border-ink-border/70 bg-ink-base/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" aria-label="SparkGo home" className={`flex items-center gap-2.5 rounded-lg sm:gap-3 ${focusRing}`}>
            <Image src="/SparkGo%20Logo.png" alt="" width={570} height={438} priority unoptimized className="h-9 w-auto object-contain" />
            <span className="font-display text-lg font-black tracking-wider text-white">
              Spark
              <span className="bg-linear-to-r from-[#F5710C] to-[#FDC31A] bg-clip-text text-transparent">Go</span>
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-400 sm:inline">{isSignup ? "Already have an account?" : "New to SparkGo?"}</span>
            <button
              type="button"
              onClick={() => switchMode(isSignup ? "login" : "signup", "click")}
              className={`rounded-xl border border-theme-accent/40 bg-theme-accent/10 px-4 py-2 font-semibold text-theme-accent transition-colors hover:bg-theme-accent hover:text-ink-base ${focusRing}`}
            >
              {isSignup ? "Log in" : "Create account"}
            </button>
          </div>
        </div>
      </header>

      <section className="relative z-10 flex flex-1 items-center justify-center px-4 py-9 sm:px-6 sm:py-12">
        <div className="w-full max-w-[460px]">
          <div className="mb-7 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-theme-accent/40 bg-theme-accent/10 px-4 py-1.5 font-data text-xs font-semibold tracking-wide text-theme-accent">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full rounded-full bg-theme-accent opacity-75 motion-safe:animate-ping" />
                <span className="relative h-2 w-2 rounded-full bg-theme-accent" />
              </span>
              TASK MANAGEMENT, SIMPLIFIED
            </span>
            <h1 className="mt-5 font-display text-3xl font-extrabold tracking-wide text-white sm:text-4xl">
              {isSignup ? "Create your account" : "Welcome back"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-300 sm:text-base">
              {isSignup ? "Get your work moving with SparkGo." : "Log in to pick up where your team left off."}
            </p>
          </div>

          <div className="hud-card relative rounded-3xl p-6 sm:p-9">
            <HudCorners />
            <div className="mb-7 grid grid-cols-2 gap-1 rounded-2xl border border-ink-border bg-ink-input/90 p-1" role="tablist" aria-label="Choose authentication mode">
              <button
                type="button"
                role="tab"
                aria-selected={!isSignup}
                onClick={() => switchMode("login", "tab")}
                className={`rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${!isSignup ? "bg-theme-accent text-ink-base shadow-md" : "text-slate-300 hover:text-white"} ${focusRing}`}
              >
                Log in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isSignup}
                onClick={() => switchMode("signup", "tab")}
                className={`rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${isSignup ? "bg-theme-accent text-ink-base shadow-md" : "text-slate-300 hover:text-white"} ${focusRing}`}
              >
                Sign up
              </button>
            </div>

            <form key={mode} onSubmit={handleSubmit} className="space-y-5">
              {isSignup && (
                <label className="block space-y-2 text-sm font-medium text-slate-200">
                  <span>Full name</span>
                  <input name="name" autoComplete="name" required placeholder="Alex Morgan" className={inputClass} />
                </label>
              )}

              <label className="block space-y-2 text-sm font-medium text-slate-200">
                <span>Email address</span>
                <input name="email" type="email" autoComplete="email" required placeholder="you@company.com" className={inputClass} />
              </label>

              <label className="block space-y-2 text-sm font-medium text-slate-200">
                <span className="flex items-center justify-between">
                  <span>Password</span>
                  {!isSignup && (
                    <a
                      href="#forgot-password"
                      onClick={(event) => {
                        event.preventDefault();
                        playSfx("click");
                        setNotice("Password reset isn’t connected yet.");
                      }}
                      className={`text-xs font-semibold text-theme-accent transition hover:text-white ${focusRing}`}
                    >
                      Forgot password?
                    </a>
                  )}
                </span>
                <input name="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} minLength={8} required placeholder={isSignup ? "At least 8 characters" : "Enter your password"} className={inputClass} />
              </label>

              {isSignup && (
                <label className="flex items-start gap-2.5 text-xs leading-5 text-slate-400">
                  <input type="checkbox" required className="mt-1 accent-theme-accent" />
                  <span>
                    I agree to the{" "}
                    <a
                      href="#terms"
                      onClick={(event) => {
                        event.preventDefault();
                        playSfx("click");
                      }}
                      className={`font-semibold text-theme-accent hover:text-white ${focusRing}`}
                    >
                      Terms of Service
                    </a>{" "}
                    and{" "}
                    <a
                      href="#privacy"
                      onClick={(event) => {
                        event.preventDefault();
                        playSfx("click");
                      }}
                      className={`font-semibold text-theme-accent hover:text-white ${focusRing}`}
                    >
                      Privacy Policy
                    </a>
                    .
                  </span>
                </label>
              )}

              <button type="submit" className={primaryCta}>
                <Icon name="rocket" className="h-4 w-4 motion-safe:group-hover:animate-thrust" />
                {isSignup ? "Create your account" : "Log in to SparkGo"}
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
              </button>

              <div className="flex items-center gap-3 py-1" aria-hidden="true">
                <span className="h-px flex-1 bg-ink-border" />
                <span className="font-data text-[11px] uppercase tracking-wider text-slate-500">or</span>
                <span className="h-px flex-1 bg-ink-border" />
              </div>

              <button type="button" onClick={handleGoogle} className={googleCta}>
                <GoogleGlyph />
                Continue with Google
              </button>
              {notice && (
                <p role="status" className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 text-center font-data text-xs text-amber-300">
                  {notice}
                </p>
              )}
            </form>

            <p className="mt-6 text-center text-sm text-slate-400">
              {isSignup ? "Already have an account?" : "Don’t have an account?"}{" "}
              <button
                type="button"
                onClick={() => switchMode(isSignup ? "login" : "signup", "click")}
                className={`font-semibold text-theme-accent hover:text-white ${focusRing}`}
              >
                {isSignup ? "Log in" : "Sign up free"}
              </button>
            </p>
          </div>

          <p className="mt-6 text-center font-data text-xs text-slate-500">By continuing, you agree to use SparkGo responsibly.</p>
        </div>
      </section>

      <footer className="relative z-10 border-t border-ink-border/60 px-4 pb-16 pt-8 text-center text-xs text-slate-400 sm:pb-5">
        © 2026 SparkGo. Built to help your team move forward.
      </footer>
    </main>
  );
}

export default function AuthPanel() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-ink-base">
          <span className="font-data text-sm text-slate-500">Loading…</span>
        </main>
      }
    >
      <AuthContent />
    </Suspense>
  );
}
