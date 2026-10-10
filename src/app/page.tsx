import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Testimonials from "@/features/landing/components/Testimonials";
import MissionCanvas from "@/features/landing/components/MissionCanvas";
import HudCorners from "@/components/ui/HudCorners";
import Icon, { type IconName } from "@/components/ui/Icon";
import LaunchLink from "@/components/ui/LaunchLink";

export const metadata: Metadata = {
  title: "SparkGo — Task Manager",
  description:
    "SparkGo keeps your tasks, deadlines, and teammates in one place, so you spend less time managing work and more time getting it done.",
};

const features: { title: string; description: string; icon: IconName }[] = [
  {
    title: "Smart Task Lists",
    description:
      "Organize work into projects and lists, group related tasks together, and keep everything in one place.",
    icon: "list",
  },
  {
    title: "Team Collaboration",
    description:
      "Assign tasks to teammates, leave comments, and keep everyone aligned without switching tools.",
    icon: "users",
  },
  {
    title: "Deadlines & Reminders",
    description:
      "Set due dates and get reminded before anything slips, so every commitment ships on time.",
    icon: "bell",
  },
  {
    title: "Progress Insights",
    description:
      "Track what is done, what is next, and how close you are to finishing with clear progress views.",
    icon: "chart",
  },
];

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-accent";

const primaryCta = `group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-linear-to-br from-theme-accent to-theme-secondary px-7 font-display text-sm font-extrabold uppercase tracking-wider text-ink-base shadow-[0_0_20px_rgb(var(--theme-rgb)/0.3)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgb(var(--theme-rgb)/0.6)] active:translate-y-px ${focusRing}`;

const secondaryCta = `inline-flex h-12 items-center justify-center rounded-xl border border-theme-accent/40 bg-ink-card/70 px-7 font-display text-sm font-extrabold uppercase tracking-wider text-theme-accent backdrop-blur transition-colors hover:border-theme-accent hover:bg-ink-border ${focusRing}`;

export default function Home() {
  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-x-hidden bg-ink-base font-ui text-slate-100 selection:bg-theme-accent/40">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-theme-accent focus:px-4 focus:py-2 focus:font-semibold focus:text-ink-base"
      >
        Skip to content
      </a>

      {/* Ambient glow + dot grid (decorative) */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[650px] w-[650px] rounded-full bg-theme-accent opacity-25 blur-[120px] transition-colors duration-700" />
        <div className="absolute -bottom-32 -right-32 h-[650px] w-[650px] rounded-full bg-theme-secondary opacity-15 blur-[120px] transition-colors duration-700" />
        <div className="absolute inset-0 bg-[radial-gradient(#1b2d40_1px,transparent_1px)] opacity-25 [background-size:24px_24px]" />
      </div>
      <MissionCanvas />

      <header className="sticky top-0 z-20 border-b border-ink-border/70 bg-ink-base/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className={`flex items-center gap-2.5 rounded-lg sm:gap-3 ${focusRing}`}>
            <Image
              className="h-9 w-auto"
              src="/SparkGo%20Logo.png"
              alt="SparkGo logo"
              width={570}
              height={438}
              priority
              unoptimized
            />
            <span className="font-display text-lg font-black tracking-wider">
              Spark
              <span className="bg-linear-to-r from-[#F5710C] to-[#FDC31A] bg-clip-text text-transparent">
                Go
              </span>
            </span>
          </Link>

          <nav aria-label="Main" className="flex items-center gap-2 text-sm font-medium sm:gap-5">
            <a
              href="#features"
              className={`hidden rounded-md text-slate-300 transition-colors hover:text-white sm:inline ${focusRing}`}
            >
              Features
            </a>
            <LaunchLink
              href="/auth?mode=signup"
              className={`rounded-xl border border-theme-accent/40 bg-theme-accent/10 px-4 py-2 font-semibold text-theme-accent transition-colors hover:bg-theme-accent hover:text-ink-base ${focusRing}`}
            >
              Sign Up
            </LaunchLink>
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        {/* Hero */}
        <section className="relative isolate overflow-hidden border-b border-ink-border/60">
          <Image
            src="/SparkGO%20Landing%20Page%20BG.png"
            alt=""
            fill
            priority
            sizes="100vw"
            unoptimized
            className="object-cover opacity-30"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-linear-to-b from-ink-base/60 via-ink-base/30 to-ink-base"
          />

          <div className="relative mx-auto grid min-h-[640px] w-full max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-12">
            <div className="flex flex-col items-start gap-6 lg:col-span-7">
              <span className="inline-flex items-center gap-2 rounded-full border border-theme-accent/40 bg-theme-accent/10 px-4 py-1.5 font-data text-xs font-semibold text-theme-accent">
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-theme-accent opacity-75 motion-safe:animate-ping" />
                  <span className="relative h-2 w-2 rounded-full bg-theme-accent" />
                </span>
                Task management, simplified
              </span>

              <h1 className="max-w-2xl text-balance font-display text-3xl font-extrabold leading-tight tracking-wide text-white sm:text-4xl lg:text-[2.75rem]">
                Plan your work. Track everything. Ship faster.
              </h1>

              <p className="max-w-xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
                SparkGo keeps your tasks, deadlines, and teammates in one place,
                so you spend less time managing work and more time getting it
                done.
              </p>

              <div className="flex flex-col gap-4 sm:flex-row">
                <LaunchLink href="/auth?mode=signup" className={primaryCta}>
                  <Icon name="rocket" className="h-4 w-4 motion-safe:group-hover:animate-thrust" />
                  Sign Up
                </LaunchLink>
                <LaunchLink href="/auth?mode=login" sfx="click" className={secondaryCta}>
                  Log In
                </LaunchLink>
              </div>
            </div>

            <div className="lg:col-span-5">
              <Testimonials />
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-16 border-b border-ink-border/60">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="max-w-2xl text-balance font-display text-2xl font-extrabold tracking-wide text-white sm:text-3xl">
              Everything you need to stay on track
            </h2>
            <p className="mt-3 max-w-xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
              Simple building blocks that cover the full workflow, from the
              first idea to the finished task.
            </p>

            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {features.map((feature) => (
                <article
                  key={feature.title}
                  className="hud-card relative rounded-2xl p-6 transition-colors duration-300 hover:border-theme-accent/50"
                >
                  <HudCorners />
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-theme-accent/30 bg-theme-accent/10 text-theme-accent">
                    <Icon name={feature.icon} />
                  </div>
                  <h3 className="mt-4 font-display text-sm font-bold tracking-wide text-white sm:text-base">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section>
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <div className="hud-card relative overflow-hidden rounded-3xl px-6 py-14 text-center">
              <HudCorners />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-0 h-48 w-96 -translate-x-1/2 rounded-full bg-theme-accent opacity-20 blur-[90px]"
              />
              <div className="relative flex flex-col items-center gap-6">
                <h2 className="max-w-xl text-balance font-display text-2xl font-extrabold tracking-wide text-white sm:text-3xl">
                  Ready to get your work moving?
                </h2>
                <LaunchLink href="/auth?mode=signup" className={primaryCta}>
                  <Icon name="rocket" className="h-4 w-4 motion-safe:group-hover:animate-thrust" />
                  Get Started
                </LaunchLink>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink-border/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 pt-8 pb-20 sm:flex-row sm:px-6 sm:py-8">
          <div className="flex items-center gap-2.5">
            <Image
              className="h-6 w-auto"
              src="/SparkGo%20Logo.png"
              alt="SparkGo logo"
              width={570}
              height={438}
              unoptimized
            />
            <span className="font-display text-sm font-bold tracking-wider text-slate-300">
              SparkGo
            </span>
          </div>
          <p className="text-sm text-slate-400">© 2026 SparkGo. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}