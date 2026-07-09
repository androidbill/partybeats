import React, { useEffect, useRef } from "react";

/*
  Party motion, rebuilt for phones.

  One full-screen canvas behind the room: two drifting stage-light glows,
  rising marquee embers, and an occasional thin light sweep. Compared to v1:

  - 24fps cap (was 30) and ~48 particles (was 118)
  - render buffer capped at a 640px long edge / 1.25 dpr — CSS scales it up,
    gradients and glows don't need more
  - the loop fully stops when the tab/app is backgrounded (visibilitychange),
    so it costs nothing while someone is off in YouTube Music
  - prefers-reduced-motion renders a single static frame — no loop at all
  - colors come from the active theme's CSS variables and follow theme changes
*/

const FRAME_MS = 1000 / 24;
const MAX_LONG_EDGE = 640;
const EMBER_COUNT = 48;

export default function PartyMotion() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: true });
    if (!ctx) return undefined;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    let frame = 0;
    let lastFrameAt = 0;
    let width = 1;
    let height = 1;

    const readColor = (name, fallback) => {
      const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
    };
    let gold = readColor("--accent", "#f5c86b");
    let violet = readColor("--accent-2", "#7c5cff");
    let hot = readColor("--hot", "#ff5c8a");
    const themeObserver = new MutationObserver(() => {
      gold = readColor("--accent", "#f5c86b");
      violet = readColor("--accent-2", "#7c5cff");
      hot = readColor("--hot", "#ff5c8a");
      if (reducedMotion) drawFrame(0);
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const embers = Array.from({ length: EMBER_COUNT }, (_, index) => ({
      seed: index * 87.3,
      x: Math.random(),
      radius: 1 + Math.random() * 3.4,
      speed: 0.35 + Math.random() * 0.9,
      sway: (Math.random() - 0.5) * 46,
      alpha: 0.35 + Math.random() * 0.5
    }));

    function resize() {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      const rawDpr = Math.min(1.25, window.devicePixelRatio || 1);
      const longEdge = Math.max(width, height) * rawDpr;
      const dpr = longEdge > MAX_LONG_EDGE ? MAX_LONG_EDGE / Math.max(width, height) : rawDpr;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reducedMotion) drawFrame(0);
    }

    function glow(x, y, radius, color, coreAlphaHex) {
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `${color}${coreAlphaHex}`);
      gradient.addColorStop(0.6, `${color}14`);
      gradient.addColorStop(1, `${color}00`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawFrame(timestamp) {
      const t = timestamp / 1000;
      const pulse = 1 + Math.sin(t * 1.7) * 0.08;
      const base = Math.min(width, height);
      ctx.clearRect(0, 0, width, height);

      // Stage lights.
      glow(
        width * (0.22 + Math.sin(t * 0.32) * 0.1),
        height * (0.24 + Math.cos(t * 0.26) * 0.07),
        base * 0.62 * pulse, violet, "3a"
      );
      glow(
        width * (0.8 + Math.cos(t * 0.28) * 0.1),
        height * (0.74 + Math.sin(t * 0.24) * 0.08),
        base * 0.54 * pulse, gold, "30"
      );
      glow(width * 0.5, height * 1.05, base * 0.5, hot, "1c");

      // Rising marquee embers, batched into two fill passes.
      for (const [pick, color] of [[0, gold], [1, violet]]) {
        ctx.fillStyle = color;
        ctx.beginPath();
        for (let i = pick; i < embers.length; i += 2) {
          const ember = embers[i];
          const travel = reducedMotion ? ember.seed : t * ember.speed * 46 + ember.seed;
          const y = height + 30 - (travel % (height + 60));
          const x = width * ember.x + Math.sin(t * 0.9 + ember.seed) * ember.sway;
          const fade = Math.min(1, (height + 30 - y) / (height * 0.35)) * ember.alpha;
          ctx.globalAlpha = Math.max(0.05, fade * 0.7);
          ctx.moveTo(x + ember.radius, y);
          ctx.arc(x, y, ember.radius, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // A single thin light sweep every ~7 seconds.
      if (!reducedMotion) {
        const cycle = (t % 7) / 7;
        if (cycle < 0.32) {
          const progress = cycle / 0.32;
          const x = -width * 0.3 + progress * width * 1.6;
          const y = height * (0.2 + (Math.floor(t / 7) % 3) * 0.22);
          const beam = ctx.createLinearGradient(x, y, x + width * 0.3, y + height * 0.07);
          const strength = Math.sin(progress * Math.PI);
          beam.addColorStop(0, `${gold}00`);
          beam.addColorStop(0.5, `${gold}${strength > 0.5 ? "66" : "33"}`);
          beam.addColorStop(1, `${gold}00`);
          ctx.strokeStyle = beam;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + width * 0.34, y + height * 0.07);
          ctx.stroke();
        }
      }
    }

    function loop(timestamp = 0) {
      frame = window.requestAnimationFrame(loop);
      if (timestamp - lastFrameAt < FRAME_MS) return;
      lastFrameAt = timestamp - ((timestamp - lastFrameAt) % FRAME_MS);
      drawFrame(timestamp);
    }

    function start() {
      if (frame || reducedMotion) return;
      lastFrameAt = 0;
      frame = window.requestAnimationFrame(loop);
    }
    function stop() {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    }
    function onVisibility() {
      if (document.visibilityState === "visible") start();
      else stop();
    }

    resize();
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    resizeObserver?.observe(canvas);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    if (reducedMotion) drawFrame(0);
    else start();

    return () => {
      stop();
      resizeObserver?.disconnect();
      themeObserver.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="party-motion" aria-hidden="true" />;
}
