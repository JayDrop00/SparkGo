"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import type { TeamTaskActivityDto, TeamTaskDto, TeamTaskMemberDto } from "../dto/team-task.dto";
import type { BoardFilter } from "./TeamTaskToolbar";

type ActivityPeriod = "today" | "week" | "all";

function useCountUp(target: number, duration = 600) {
  const [current, setCurrent] = useState(target);
  const prevRef = useRef(target);

  useEffect(() => {
    const isReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isReduced) {
      setCurrent(target);
      prevRef.current = target;
      return;
    }

    const startVal = prevRef.current;
    const diff = target - startVal;
    if (diff === 0) return;

    let startTime: number | null = null;
    let animId: number;

    function step(timestamp: number) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(startVal + diff * ease));

      if (progress < 1) {
        animId = requestAnimationFrame(step);
      } else {
        prevRef.current = target;
      }
    }

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [target, duration]);

  return current;
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const width = 56;
  const height = 20;
  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  const fillPoints = `${points} ${width},${height} 0,${height}`;
  const gradId = `spark-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill={`url(#${gradId})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ConfettiCanvas({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const isReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isReduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const colors = ["#06b6d4", "#3b82f6", "#22c55e", "#ec4899", "#eab308"];
    const particles = Array.from({ length: 42 }, () => ({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.7) * 7,
      size: Math.random() * 4 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      rotation: Math.random() * 360,
      dr: (Math.random() - 0.5) * 10,
    }));

    let animId: number;
    function render() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles) {
        if (p.alpha <= 0) continue;
        alive = true;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // gravity
        p.alpha -= 0.018;
        p.rotation += p.dr;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
      if (alive) {
        animId = requestAnimationFrame(render);
      }
    }

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [active]);

  if (!active) return null;
  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-20 h-full w-full"
      aria-hidden="true"
    />
  );
}

function formatRelativeTime(dateString: string, now: number) {
  const diff = Math.max(0, now - new Date(dateString).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function TeamTaskStats({
  tasks,
  now,
  activityPeriod,
  onActivityPeriodChange,
  activityMetrics,
  activityLoading,
  activityError,
  onRetryActivity,
  members,
  onSelectFilter,
  onCreateTask,
}: {
  tasks: TeamTaskDto[];
  now: number;
  activityPeriod: ActivityPeriod;
  onActivityPeriodChange: (p: ActivityPeriod) => void;
  activityMetrics: TeamTaskActivityDto | null;
  activityLoading: boolean;
  activityError: string | null;
  onRetryActivity: () => void;
  members: TeamTaskMemberDto[];
  onSelectFilter: (filter: BoardFilter) => void;
  onCreateTask: () => void;
}) {
  const [activityOpen, setActivityOpen] = useState(false);
  const [isSticky, setIsSticky] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const hasTriggeredConfetti = useRef(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Stats computation
  const stats = useMemo(() => {
    const eligible = tasks.filter((t) => !t.archivedAt);
    const completed = eligible.filter((t) => t.status === "done").length;
    const inProgress = eligible.filter(
      (t) => t.status === "in_progress" && t.latestRequest?.status !== "pending",
    ).length;
    const inReview = eligible.filter(
      (t) => t.latestRequest?.status === "pending",
    ).length;
    const todo = eligible.filter(
      (t) => t.status === "todo" && t.latestRequest?.status !== "pending",
    ).length;
    const overdue = eligible.filter(
      (t) => t.status !== "done" && t.dueAt && new Date(t.dueAt).getTime() < now,
    ).length;
    const total = eligible.length;
    const rate = total ? Math.round((completed / total) * 100) : 0;

    return { total, completed, inProgress, inReview, todo, overdue, rate };
  }, [tasks, now]);

  // Animated values
  const animatedTotal = useCountUp(stats.total);
  const animatedCompleted = useCountUp(stats.completed);
  const animatedInProgress = useCountUp(stats.inProgress);
  const animatedOverdue = useCountUp(stats.overdue);
  const animatedRate = useCountUp(stats.rate);

  // Confetti when 100% completed
  useEffect(() => {
    if (stats.rate === 100 && stats.total > 0 && !hasTriggeredConfetti.current) {
      hasTriggeredConfetti.current = true;
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [stats.rate, stats.total]);

  // Sticky-collapsible bar observer
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSticky(!entry.isIntersecting);
      },
      { threshold: 0.05 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // One-line friendly message
  const completionMessage = useMemo(() => {
    if (stats.total === 0) return "No tasks yet. Create your first one to get started.";
    if (stats.rate === 0) return "Ready to roll. Start your first task!";
    if (stats.rate === 100) return "All caught up 🎉";
    const remaining = stats.total - stats.completed;
    return `Nice momentum, ${remaining} to go.`;
  }, [stats]);

  // Ring dimensions
  const ringSize = 160;
  const strokeWidth = 12;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (stats.rate / 100) * circumference;

  // Fake sparklines for 7-day trend based on metrics
  const totalTrend = [stats.total - 3, stats.total - 2, stats.total - 1, stats.total - 1, stats.total, stats.total, stats.total];
  const inProgressTrend = [stats.inProgress, stats.inProgress + 1, stats.inProgress, stats.inProgress - 1, stats.inProgress, stats.inProgress, stats.inProgress];
  const completedTrend = [Math.max(0, stats.completed - 4), Math.max(0, stats.completed - 3), Math.max(0, stats.completed - 2), Math.max(0, stats.completed - 1), stats.completed, stats.completed, stats.completed];
  const overdueTrend = [stats.overdue, stats.overdue + 1, stats.overdue, stats.overdue, stats.overdue, stats.overdue, stats.overdue];

  // Recent activity events built from tasks
  const recentEvents = useMemo(() => {
    const events: Array<{ id: string; user: string; text: string; time: string; date: string }> = [];
    tasks.forEach((t) => {
      if (t.completedAt) {
        events.push({
          id: `done-${t.id}`,
          user: "Teammate",
          text: `completed "${t.name}"`,
          time: formatRelativeTime(t.completedAt, now),
          date: t.completedAt,
        });
      } else if (t.startedAt) {
        events.push({
          id: `start-${t.id}`,
          user: "Teammate",
          text: `started "${t.name}"`,
          time: formatRelativeTime(t.startedAt, now),
          date: t.startedAt,
        });
      }
      t.helpRequests.forEach((h) => {
        events.push({
          id: `help-${h.id}`,
          user: h.requesterName || "Teammate",
          text: `requested help on "${t.name}"`,
          time: formatRelativeTime(h.createdAt, now),
          date: h.createdAt,
        });
      });
    });
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  }, [tasks, now]);

  // 7-day contribution strip (last 7 days completed tasks)
  const contributionDays = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + 86400000;
      const count = tasks.filter((t) => {
        if (!t.completedAt) return false;
        const time = new Date(t.completedAt).getTime();
        return time >= dayStart && time < dayEnd;
      }).length;
      days.push({
        label: d.toLocaleDateString(undefined, { weekday: "short" }),
        count,
      });
    }
    return days;
  }, [tasks, now]);

  function scrollToBoard() {
    const boardEl = document.getElementById("team-task-kanban-board");
    if (boardEl) {
      boardEl.scrollIntoView({ behavior: "smooth" });
    }
  }

  function handleFilterClick(filter: BoardFilter) {
    onSelectFilter(filter);
    scrollToBoard();
  }

  return (
    <>
      {/* Sticky-collapsible bar: appears on scroll */}
      <div
        className={`fixed top-0 left-0 right-0 z-40 border-b border-ink-border bg-ink-base/90 px-6 py-2.5 backdrop-blur-xl transition-all duration-300 ${
          isSticky ? "translate-y-0 opacity-100 shadow-xl" : "-translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-white">Team Pulse</span>
            <span className="text-slate-500">·</span>
            <span className="text-theme-accent font-bold">{stats.rate}% completed</span>
            <span className="text-slate-400">
              ({stats.completed}/{stats.total} tasks)
            </span>
            {stats.overdue > 0 && (
              <span className="rounded-full bg-rose-500/15 px-2 py-0.5 font-semibold text-rose-300">
                {stats.overdue} overdue
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={scrollToBoard}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-theme-accent hover:bg-theme-accent/10 transition-colors"
          >
            Jump to board ↓
          </button>
        </div>
      </div>

      <div ref={headerRef} className="space-y-4">
        {/* TWO-ZONE HEADER CARD (Desktop: Left ~30%, Right ~70%) */}
        <section
          aria-label="Team Pulse Overview"
          className="hud-card relative overflow-hidden rounded-2xl p-5 sm:p-6"
        >
          <ConfettiCanvas active={showConfetti} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8 items-center">
            {/* LEFT ZONE (~30% / 4 columns): Overall completion */}
            <div className="flex flex-col items-center justify-center text-center lg:col-span-4 lg:border-r lg:border-ink-border lg:pr-6">
              <span className="font-data text-[11px] font-bold uppercase tracking-widest text-slate-500">
                Overall completion
              </span>

              {/* Large circular progress ring */}
              <div className="relative mt-3 flex items-center justify-center">
                <svg
                  width={ringSize}
                  height={ringSize}
                  viewBox={`0 0 ${ringSize} ${ringSize}`}
                  className="-rotate-90 transform"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style={{ stopColor: "var(--theme-accent)" }} />
                      <stop offset="100%" style={{ stopColor: "var(--theme-secondary)" }} />
                    </linearGradient>
                  </defs>
                  {/* Track ring */}
                  <circle
                    cx={ringSize / 2}
                    cy={ringSize / 2}
                    r={radius}
                    stroke="rgb(var(--theme-rgb) / 0.12)"
                    strokeWidth={strokeWidth}
                    fill="none"
                  />
                  {/* Progress ring */}
                  <circle
                    cx={ringSize / 2}
                    cy={ringSize / 2}
                    r={radius}
                    stroke="url(#ringGradient)"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="none"
                    className="transition-[stroke-dashoffset] duration-700 ease-out"
                  />
                </svg>

                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-4xl font-extrabold text-white tabular-nums tracking-tight">
                    {animatedRate}%
                  </span>
                  <span className="mt-0.5 text-[11px] text-slate-400">
                    {animatedCompleted} of {animatedTotal}
                  </span>
                </div>
              </div>

              {/* Friendly message under the ring */}
              <p className="mt-3 text-xs font-medium text-slate-400 max-w-xs">
                {completionMessage}
              </p>
            </div>

            {/* RIGHT ZONE (~70% / 8 columns): 4 KPI tiles + Segmented status bar */}
            <div className="flex flex-col justify-between space-y-5 lg:col-span-8">
              {/* 4 KPI TILES (Clickable filters) */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {/* 1. Total */}
                <button
                  type="button"
                  onClick={() => handleFilterClick({ type: "none" })}
                  className="group/tile relative flex flex-col justify-between rounded-xl border border-ink-border bg-ink-card p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-theme-accent/40 hover:shadow-[0_8px_20px_rgba(0,0,0,0.3)] cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink-border/70 text-slate-400">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                      </svg>
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500">
                      ▲ 2 vs lw
                    </span>
                  </div>

                  <div className="mt-2.5">
                    <p className="font-data text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Total tasks
                    </p>
                    <p className="mt-0.5 font-display text-2xl font-bold tabular-nums text-white">
                      {animatedTotal}
                    </p>
                  </div>

                  <div className="mt-2 hidden sm:block">
                    <Sparkline data={totalTrend} color="#94a3b8" />
                  </div>
                </button>

                {/* 2. In progress */}
                <button
                  type="button"
                  onClick={() =>
                    handleFilterClick({
                      type: "status",
                      value: "in_progress",
                      label: "In progress",
                    })
                  }
                  className="group/tile relative flex flex-col justify-between rounded-xl border border-ink-border bg-ink-card p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-blue-400/40 hover:shadow-[0_8px_20px_rgba(0,0,0,0.3)] cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </span>
                    <span className="text-[10px] font-semibold text-blue-400">
                      Active
                    </span>
                  </div>

                  <div className="mt-2.5">
                    <p className="font-data text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      In progress
                    </p>
                    <p className="mt-0.5 font-display text-2xl font-bold tabular-nums text-blue-300">
                      {animatedInProgress}
                    </p>
                  </div>

                  <div className="mt-2 hidden sm:block">
                    <Sparkline data={inProgressTrend} color="#3b82f6" />
                  </div>
                </button>

                {/* 3. Completed */}
                <button
                  type="button"
                  onClick={() =>
                    handleFilterClick({
                      type: "status",
                      value: "done",
                      label: "Completed",
                    })
                  }
                  className="group/tile relative flex flex-col justify-between rounded-xl border border-ink-border bg-ink-card p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-emerald-400/40 hover:shadow-[0_8px_20px_rgba(0,0,0,0.3)] cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-400">
                      Done
                    </span>
                  </div>

                  <div className="mt-2.5">
                    <p className="font-data text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Completed
                    </p>
                    <p className="mt-0.5 font-display text-2xl font-bold tabular-nums text-emerald-300">
                      {animatedCompleted}
                    </p>
                  </div>

                  <div className="mt-2 hidden sm:block">
                    <Sparkline data={completedTrend} color="#22c55e" />
                  </div>
                </button>

                {/* 4. Overdue */}
                <button
                  type="button"
                  onClick={() =>
                    handleFilterClick({
                      type: "overdue",
                      label: "Overdue tasks",
                    })
                  }
                  className={`group/tile relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(0,0,0,0.3)] cursor-pointer ${
                    stats.overdue > 0
                      ? "border-rose-500/40 bg-rose-500/[0.08] hover:border-rose-400"
                      : "border-ink-border bg-ink-card hover:border-theme-accent/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                        stats.overdue > 0
                          ? "bg-rose-500/25 text-rose-300"
                          : "bg-ink-border/70 text-slate-400"
                      }`}
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    </span>
                    <span
                      className={`text-[10px] font-semibold ${
                        stats.overdue > 0 ? "text-rose-400" : "text-slate-500"
                      }`}
                    >
                      {stats.overdue > 0 ? "Attention" : "👌"}
                    </span>
                  </div>

                  <div className="mt-2.5">
                    <p className="font-data text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Overdue
                    </p>
                    <p
                      className={`mt-0.5 font-display text-2xl font-bold tabular-nums ${
                        stats.overdue > 0 ? "text-rose-400 animate-pulse" : "text-slate-400"
                      }`}
                    >
                      {animatedOverdue}
                    </p>
                  </div>

                  <div className="mt-2 hidden sm:block">
                    {stats.overdue === 0 ? (
                      <p className="text-[11px] text-slate-500 truncate">Nothing overdue 👌</p>
                    ) : (
                      <Sparkline data={overdueTrend} color="#f43f5e" />
                    )}
                  </div>
                </button>
              </div>

              {/* SEGMENTED STATUS BAR (Proportional: To do / In progress / Review / Done) */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-slate-400">Status distribution</span>
                  <span>{stats.total} total active tasks</span>
                </div>

                {/* The 8px high segmented bar */}
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-ink-border/70">
                  {stats.total === 0 ? (
                    <div className="h-full w-full bg-ink-border" />
                  ) : (
                    <>
                      {/* Todo */}
                      <button
                        type="button"
                        onClick={() =>
                          handleFilterClick({
                            type: "status",
                            value: "todo",
                            label: "To do",
                          })
                        }
                        title={`To do: ${stats.todo} (${Math.round((stats.todo / stats.total) * 100)}%)`}
                        style={{ width: `${(stats.todo / stats.total) * 100}%` }}
                        className="h-full bg-slate-400 transition-all hover:brightness-125 focus:outline-none"
                      />
                      {/* In progress */}
                      <button
                        type="button"
                        onClick={() =>
                          handleFilterClick({
                            type: "status",
                            value: "in_progress",
                            label: "In progress",
                          })
                        }
                        title={`In progress: ${stats.inProgress} (${Math.round((stats.inProgress / stats.total) * 100)}%)`}
                        style={{ width: `${(stats.inProgress / stats.total) * 100}%` }}
                        className="h-full bg-blue-500 transition-all hover:brightness-125 focus:outline-none"
                      />
                      {/* In review */}
                      <button
                        type="button"
                        onClick={() =>
                          handleFilterClick({
                            type: "status",
                            value: "in_review",
                            label: "In review",
                          })
                        }
                        title={`In review: ${stats.inReview} (${Math.round((stats.inReview / stats.total) * 100)}%)`}
                        style={{ width: `${(stats.inReview / stats.total) * 100}%` }}
                        className="h-full bg-purple-500 transition-all hover:brightness-125 focus:outline-none"
                      />
                      {/* Done */}
                      <button
                        type="button"
                        onClick={() =>
                          handleFilterClick({
                            type: "status",
                            value: "done",
                            label: "Done",
                          })
                        }
                        title={`Done: ${stats.completed} (${Math.round((stats.completed / stats.total) * 100)}%)`}
                        style={{ width: `${(stats.completed / stats.total) * 100}%` }}
                        className="h-full bg-green-500 transition-all hover:brightness-125 focus:outline-none"
                      />
                    </>
                  )}
                </div>

                {/* Legend with counts */}
                <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
                  <button
                    type="button"
                    onClick={() =>
                      handleFilterClick({
                        type: "status",
                        value: "todo",
                        label: "To do",
                      })
                    }
                    className="flex items-center gap-1.5 hover:text-white"
                  >
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                    <span>To do ({stats.todo})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleFilterClick({
                        type: "status",
                        value: "in_progress",
                        label: "In progress",
                      })
                    }
                    className="flex items-center gap-1.5 hover:text-white"
                  >
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    <span>In progress ({stats.inProgress})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleFilterClick({
                        type: "status",
                        value: "in_review",
                        label: "In review",
                      })
                    }
                    className="flex items-center gap-1.5 hover:text-white"
                  >
                    <span className="h-2 w-2 rounded-full bg-purple-500" />
                    <span>Review ({stats.inReview})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleFilterClick({
                        type: "status",
                        value: "done",
                        label: "Done",
                      })
                    }
                    className="flex items-center gap-1.5 hover:text-white"
                  >
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    <span>Done ({stats.completed})</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TEAM ACTIVITY SECTION (Collapsible) */}
        <section
          aria-labelledby="team-activity-header"
          className="hud-card rounded-2xl p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              id="team-activity-header"
              onClick={() => setActivityOpen((v) => !v)}
              className="flex items-center gap-2 text-left cursor-pointer group"
            >
              <h3 className="font-display text-sm font-bold text-white group-hover:text-theme-accent transition-colors">
                Team Activity & Momentum
              </h3>
              <svg
                className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${
                  activityOpen ? "rotate-180" : ""
                }`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Segmented control: Today / This week / All time */}
            <div
              role="group"
              aria-label="Activity period"
              className="flex items-center rounded-lg border border-ink-border bg-ink-input p-0.5 text-xs"
            >
              {(
                [
                  { id: "today", label: "Today" },
                  { id: "week", label: "This week" },
                  { id: "all", label: "All time" },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={activityPeriod === p.id}
                  onClick={() => onActivityPeriodChange(p.id)}
                  className={`rounded-md px-3 py-1 font-semibold transition-all ${
                    activityPeriod === p.id
                      ? "bg-theme-accent/10 text-theme-accent shadow-xs"
                      : "text-slate-500 hover:text-white"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Activity Content (Visible when expanded or on desktop) */}
          {activityOpen && (
            <div className="mt-4 space-y-4 pt-3 border-t border-ink-border">
              {/* Row of compact mini-stats */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <div className="rounded-lg border border-ink-border bg-ink-surface p-3">
                  <span className="font-data text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Tasks created
                  </span>
                  <p className="mt-1 font-display text-lg font-bold text-white">
                    {activityLoading ? "…" : activityMetrics?.tasksCreated ?? 0}
                  </p>
                </div>

                <div className="rounded-lg border border-ink-border bg-ink-surface p-3">
                  <span className="font-data text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Tasks completed
                  </span>
                  <p className="mt-1 font-display text-lg font-bold text-emerald-300">
                    {activityLoading ? "…" : activityMetrics?.tasksCompleted ?? 0}
                  </p>
                </div>

                <div className="rounded-lg border border-ink-border bg-ink-surface p-3">
                  <span className="font-data text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Tasks started
                  </span>
                  <p className="mt-1 font-display text-lg font-bold text-blue-300">
                    {activityLoading ? "…" : activityMetrics?.tasksStarted ?? 0}
                  </p>
                </div>

                {/* Help requests with highlighted state (amber dot) when > 0 */}
                <button
                  type="button"
                  onClick={() =>
                    handleFilterClick({
                      type: "help",
                      label: "Help requested",
                    })
                  }
                  className={`rounded-lg border p-3 text-left transition-colors cursor-pointer ${
                    (activityMetrics?.helpRequests ?? 0) > 0
                      ? "border-amber-400/40 bg-amber-500/[0.08] hover:border-amber-300"
                      : "border-ink-border bg-ink-surface"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-data text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Help requests
                    </span>
                    {(activityMetrics?.helpRequests ?? 0) > 0 && (
                      <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                    )}
                  </div>
                  <p className="mt-1 font-display text-lg font-bold text-amber-300">
                    {activityLoading ? "…" : activityMetrics?.helpRequests ?? 0}
                  </p>
                </button>
              </div>

              {activityError && (
                <div className="flex items-center justify-between rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                  <span>{activityError}</span>
                  <button
                    type="button"
                    onClick={onRetryActivity}
                    className="font-bold underline"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* 7-day contribution strip + Recent activity feed */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12 items-start">
                {/* 7-day contribution strip (5 cols) */}
                <div className="md:col-span-5 rounded-xl border border-ink-border bg-ink-surface p-3.5">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2.5">
                    <span className="font-semibold">7-Day Completion Velocity</span>
                    <span className="font-data text-[11px] text-slate-500">Daily outputs</span>
                  </div>
                  <div className="flex items-center justify-between gap-1.5">
                    {contributionDays.map((d, i) => {
                      const intensity =
                        d.count === 0
                          ? "bg-ink-border/60"
                          : d.count === 1
                          ? "bg-theme-accent/30"
                          : d.count <= 3
                          ? "bg-theme-accent/60"
                          : "bg-theme-accent";
                      return (
                        <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
                          <div
                            className={`h-7 w-full rounded-md ${intensity} transition-transform hover:scale-110`}
                            title={`${d.label}: ${d.count} task${d.count === 1 ? "" : "s"} done`}
                          />
                          <span className="font-data text-[10px] text-slate-500">{d.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Recent Activity Feed (7 cols) */}
                <div className="md:col-span-7 rounded-xl border border-ink-border bg-ink-surface p-3.5">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span className="font-semibold">Recent Team Activity</span>
                    <span className="font-data text-[11px] text-slate-500">Live events</span>
                  </div>

                  {recentEvents.length === 0 ? (
                    <div className="py-4 text-center text-xs text-slate-500">
                      No activity yet this week. Start or complete a task to build momentum!
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {recentEvents.map((event) => (
                        <li
                          key={event.id}
                          className="flex items-center justify-between text-xs text-slate-400 border-b border-ink-border/60 pb-1.5 last:border-none last:pb-0"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-theme-accent/15 text-[9px] font-bold text-theme-accent">
                              {event.user[0]}
                            </span>
                            <span className="truncate">
                              <strong className="text-white font-medium">{event.user}</strong>{" "}
                              {event.text}
                            </span>
                          </div>
                          <span className="shrink-0 font-data text-[10px] text-slate-500 pl-2">
                            {event.time}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

