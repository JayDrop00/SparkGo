"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { THEMES, getTheme, subscribe, type ThemeName } from "@/lib/prefs";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  label: string | null;
};

const LABELS = ["#Sprint 12", "Due Fri", "Assigned", "Reviewed", "Done", "@team", "PR #84"];
const LINK_DIST = 110;
const MOUSE_RADIUS = 160;

/**
 * Ambient "task network" background. Decorative only:
 * - capped particle count (fewer on small screens), DPR-aware
 * - pauses when the tab is hidden
 * - renders one static frame when the visitor prefers reduced motion
 */
export default function MissionCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorRef = useRef(THEMES.cyan.accent);
  const theme = useSyncExternalStore(subscribe, getTheme, (): ThemeName => "cyan");

  useEffect(() => {
    colorRef.current = THEMES[theme].accent;
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mouse = { x: -1000, y: -1000 };
    let particles: Particle[] = [];
    let w = 0;
    let h = 0;
    let raf = 0;

    const spawn = (): Particle => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      r: Math.random() * 2 + 1.2,
      label: Math.random() > 0.85 ? LABELS[Math.floor(Math.random() * LABELS.length)] : null,
    });

    const draw = () => {
      const color = colorRef.current;
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      ctx.strokeStyle = color;

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK_DIST * LINK_DIST) {
            ctx.globalAlpha = (1 - Math.sqrt(d2) / LINK_DIST) * 0.18;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      ctx.font = "10px ui-monospace, monospace";
      for (const p of particles) {
        if (p.label) {
          ctx.globalAlpha = 0.4;
          ctx.fillStyle = "#ffffff";
          ctx.fillText(p.label, p.x, p.y);
        } else {
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };

    const step = () => {
      for (const p of particles) {
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        // cursor repels nearby nodes
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < MOUSE_RADIUS) {
          const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
          p.x -= (dx / dist) * force * 2;
          p.y -= (dy / dist) * force * 2;
        }

        p.x += p.vx;
        p.y += p.vy;
      }
    };

    const tick = () => {
      step();
      draw();
      raf = requestAnimationFrame(tick);
    };

    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const sync = () => {
      stop();
      if (reduce.matches || document.hidden) {
        draw();
      } else {
        raf = requestAnimationFrame(tick);
      }
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const target = Math.min(Math.floor((w * h) / 18000), w < 768 ? 28 : 60);
      while (particles.length < target) particles.push(spawn());
      particles = particles.slice(0, target);
      draw();
    };

    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const onLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    resize();
    sync();

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", sync);
    reduce.addEventListener("change", sync);

    return () => {
      stop();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", sync);
      reduce.removeEventListener("change", sync);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  );
}