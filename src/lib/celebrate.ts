/**
 * זיקוקים וקונפטי על קנבס, בלי תלות חיצונית.
 *
 * מכבד גם prefers-reduced-motion וגם את מתג "עצירת אנימציות" בכלי הנגישות
 * (html.a11y-reduced-motion) — אחרת האפקט הופך למטרד עבור מי שביקש בלעדיו.
 */

type Particle = {
  x: number; y: number; vx: number; vy: number;
  size: number; color: string; rotation: number; spin: number;
  life: number; maxLife: number; shape: "rect" | "circle";
};

const palette = ["#6d4aff", "#14d9c4", "#ff6b6b", "#f5bf4f", "#5134cc", "#0a9b81", "#ff9fd2"];

export function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  if (document.documentElement.classList.contains("a11y-reduced-motion")) return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

let canvas: HTMLCanvasElement | null = null;
let context: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let frame = 0;

function ensureCanvas() {
  if (canvas && document.body.contains(canvas)) return canvas;
  canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999";
  document.body.appendChild(canvas);
  context = canvas.getContext("2d");
  resize();
  window.addEventListener("resize", resize);
  return canvas;
}

function resize() {
  if (!canvas) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * ratio;
  canvas.height = window.innerHeight * ratio;
  context?.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function tick() {
  if (!context || !canvas) return;
  context.clearRect(0, 0, window.innerWidth, window.innerHeight);

  particles = particles.filter((particle) => {
    particle.life += 1;
    particle.vy += 0.16;          // כבידה
    particle.vx *= 0.995;         // גרר
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.rotation += particle.spin;

    const progress = particle.life / particle.maxLife;
    if (progress >= 1 || particle.y > window.innerHeight + 40) return false;

    context!.save();
    context!.globalAlpha = progress > 0.75 ? 1 - (progress - 0.75) / 0.25 : 1;
    context!.translate(particle.x, particle.y);
    context!.rotate(particle.rotation);
    context!.fillStyle = particle.color;
    if (particle.shape === "circle") {
      context!.beginPath();
      context!.arc(0, 0, particle.size / 2, 0, Math.PI * 2);
      context!.fill();
    } else {
      context!.fillRect(-particle.size / 2, -particle.size / 4, particle.size, particle.size / 2);
    }
    context!.restore();
    return true;
  });

  if (particles.length) {
    frame = requestAnimationFrame(tick);
  } else {
    cancelAnimationFrame(frame);
    frame = 0;
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }
}

function spawn(originX: number, originY: number, count: number, power: number) {
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (0.4 + Math.random()) * power;
    particles.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - power * 0.45,
      size: 6 + Math.random() * 8,
      color: palette[Math.floor(Math.random() * palette.length)],
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.28,
      life: 0,
      maxLife: 90 + Math.random() * 60,
      shape: Math.random() > 0.35 ? "rect" : "circle",
    });
  }
  if (!frame) frame = requestAnimationFrame(tick);
}

/** פיצוץ קונפטי ממרכז אלמנט, או ממרכז המסך אם לא נמסר. */
export function burst(element?: HTMLElement | null, options?: { count?: number; power?: number }) {
  if (typeof window === "undefined" || prefersReducedMotion()) return;
  ensureCanvas();
  const rect = element?.getBoundingClientRect();
  const originX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const originY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
  spawn(originX, originY, options?.count ?? 90, options?.power ?? 9);
}

/** רצף זיקוקים לרגעים הגדולים: פרסום כרטיס, סיום רכישה. */
export function fireworks(options?: { bursts?: number }) {
  if (typeof window === "undefined" || prefersReducedMotion()) return;
  ensureCanvas();
  const total = options?.bursts ?? 5;
  for (let index = 0; index < total; index += 1) {
    window.setTimeout(() => {
      spawn(
        window.innerWidth * (0.2 + Math.random() * 0.6),
        window.innerHeight * (0.2 + Math.random() * 0.35),
        70,
        8 + Math.random() * 4,
      );
    }, index * 260);
  }
}

/** ניקוי מלא — נדרש כשעוזבים עמוד באמצע אנימציה. */
export function clearCelebration() {
  particles = [];
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
  if (canvas?.parentNode) canvas.parentNode.removeChild(canvas);
  canvas = null;
  context = null;
}
