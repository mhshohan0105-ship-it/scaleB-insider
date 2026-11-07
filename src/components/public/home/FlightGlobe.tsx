"use client";

import { useEffect, useRef } from "react";

/** [name, latitude, longitude]: routes flown from Dhaka. */
const DHAKA: [string, number, number] = ["DAC", 23.84, 90.4];
const CITIES: [string, number, number][] = [
  ["DXB", 25.25, 55.36],
  ["JED", 21.68, 39.15],
  ["MED", 24.55, 39.7],
  ["DOH", 25.27, 51.6],
  ["KUL", 2.74, 101.7],
  ["SIN", 1.36, 103.99],
  ["BKK", 13.69, 100.75],
  ["LHR", 51.47, -0.45],
  ["YYZ", 43.68, -79.63],
  ["IST", 41.27, 28.75],
  ["CAN", 23.39, 113.3],
];

const RAD = Math.PI / 180;
type V3 = [number, number, number];

function toVec(lat: number, lon: number): V3 {
  const la = lat * RAD;
  const lo = lon * RAD;
  return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
}

/** Point on the great circle from a to b at t, lifted off the surface in the middle. */
function arcPoint(a: V3, b: V3, t: number): V3 {
  const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const om = Math.acos(dot);
  const s = Math.sin(om) || 1;
  const k1 = Math.sin((1 - t) * om) / s;
  const k2 = Math.sin(t * om) / s;
  const lift = 1 + Math.sin(Math.PI * t) * 0.18 * om;
  return [
    (a[0] * k1 + b[0] * k2) * lift,
    (a[1] * k1 + b[1] * k2) * lift,
    (a[2] * k1 + b[2] * k2) * lift,
  ];
}

/** Evenly spread points on a sphere (Fibonacci lattice). */
function lattice(n: number): V3[] {
  const pts: V3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    pts.push([Math.cos(th) * r, y, Math.sin(th) * r]);
  }
  return pts;
}

/**
 * A slowly turning dotted globe with flights leaving Dhaka. Drag to spin it.
 * Drawn on a canvas, paused while off screen, still for reduced motion.
 */
export function FlightGlobe({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dots = lattice(1400);
    const home = toVec(DHAKA[1], DHAKA[2]);
    const routes = CITIES.map(([code, la, lo], i) => ({
      code,
      to: toVec(la, lo),
      offset: i / CITIES.length,
      speed: 0.06 + (i % 4) * 0.012,
    }));

    let w = 0;
    let h = 0;
    let dpr = 1;
    // Start with Dhaka facing the viewer, the globe tipped a little.
    let rotY = -90 * RAD + 0.25;
    const tilt = 0.3;
    let spin = 0.0012;
    let drag: { x: number; rot: number } | null = null;
    let visible = true;
    let raf = 0;
    let last = performance.now();
    let time = 0;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const project = (p: V3, R: number, cx: number, cy: number) => {
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const x1 = p[0] * cosY + p[2] * sinY;
      const z1 = -p[0] * sinY + p[2] * cosY;
      const cosX = Math.cos(tilt);
      const sinX = Math.sin(tilt);
      const y2 = p[1] * cosX - z1 * sinX;
      const z2 = p[1] * sinX + z1 * cosX;
      return { x: cx + x1 * R, y: cy - y2 * R, z: z2 };
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const R = Math.min(w, h) * 0.42;
      const cx = w / 2;
      const cy = h / 2;

      // Halo behind the globe.
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.04, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(15, 107, 92, 0.18)";
      ctx.fill();

      for (const d of dots) {
        const p = project(d, R, cx, cy);
        if (p.z < -0.05) continue;
        ctx.globalAlpha = 0.15 + p.z * 0.75;
        ctx.fillStyle = "#9fd4c6";
        ctx.fillRect(p.x - 0.9, p.y - 0.9, 1.8, 1.8);
      }
      ctx.globalAlpha = 1;

      for (const r of routes) {
        // The route line, front half only.
        ctx.beginPath();
        let open = false;
        for (let i = 0; i <= 48; i++) {
          const p = project(arcPoint(home, r.to, i / 48), R, cx, cy);
          if (p.z < 0) {
            open = false;
            continue;
          }
          if (open) ctx.lineTo(p.x, p.y);
          else ctx.moveTo(p.x, p.y);
          open = true;
        }
        ctx.strokeStyle = "rgba(242, 173, 46, 0.55)";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([2, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        // The plane flying it.
        const t = (time * r.speed + r.offset) % 1;
        const p = project(arcPoint(home, r.to, t), R, cx, cy);
        const q = project(arcPoint(home, r.to, Math.min(1, t + 0.01)), R, cx, cy);
        if (p.z > 0) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.atan2(q.y - p.y, q.x - p.x));
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.moveTo(7, 0);
          ctx.lineTo(-5, -4.5);
          ctx.lineTo(-2.5, 0);
          ctx.lineTo(-5, 4.5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        const end = project(r.to, R, cx, cy);
        if (end.z > 0) {
          ctx.fillStyle = "#f2ad2e";
          ctx.beginPath();
          ctx.arc(end.x, end.y, 2.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = "600 10px var(--font-inter), system-ui, sans-serif";
          ctx.fillStyle = `rgba(230, 244, 241, ${0.35 + end.z * 0.6})`;
          ctx.fillText(r.code, end.x + 5, end.y - 4);
        }
      }

      // Dhaka, pulsing.
      const dk = project(home, R, cx, cy);
      if (dk.z > 0) {
        const pulse = (time * 0.6) % 1;
        ctx.strokeStyle = `rgba(242, 173, 46, ${1 - pulse})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(dk.x, dk.y, 4 + pulse * 16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#f2ad2e";
        ctx.beginPath();
        ctx.arc(dk.x, dk.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "700 12px var(--font-inter), system-ui, sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.fillText("Dhaka", dk.x + 9, dk.y + 4);
      }
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!drag) {
        rotY += spin * dt * 60;
        spin += (0.0012 - spin) * 0.02; // settle back to the cruise speed after a flick
      }
      time += dt;
      draw();
      if (visible) raf = requestAnimationFrame(frame);
    };

    const onDown = (e: PointerEvent) => {
      drag = { x: e.clientX, rot: rotY };
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      const next = drag.rot + (e.clientX - drag.x) * 0.008;
      spin = (next - rotY) * 0.5;
      rotY = next;
      if (reduced) draw();
    };
    const onUp = () => {
      drag = null;
    };

    resize();
    draw();
    const io = new IntersectionObserver(([e]) => {
      visible = Boolean(e?.isIntersecting);
      if (visible && !reduced) {
        last = performance.now();
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(frame);
      }
    });
    io.observe(canvas);
    const ro = new ResizeObserver(() => {
      resize();
      draw();
    });
    ro.observe(canvas);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className={className}
      role="img"
      aria-label="A turning globe with flights from Dhaka to Dubai, Jeddah, Kuala Lumpur, London and other cities"
    />
  );
}
