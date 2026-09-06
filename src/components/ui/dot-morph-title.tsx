"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./background-paths.module.css";

type Point = { x: number; y: number };
type ButterflyPart = "antenna" | "wing" | "body" | "tail";
type ButterflyTarget = Point & { part: ButterflyPart };
type Particle = Point & {
  color: string;
  depth: number;
  part: ButterflyPart;
  target: Point;
  targetColor: string;
};

const TITLE_COLORS = ["#214c3f", "#2f6f55", "#c2410c", "#6fa877"];
const ANIMATION_MS = 1900;
const FORMATION_MS = 260;
const PART_DELAYS: Record<ButterflyPart, number> = {
  antenna: 0,
  wing: 0.22,
  body: 0.42,
  tail: 0.58,
};
const WING_SHAPES = [
  "M79 61C62 22 25 10 12 35C-1 61 22 87 76 70Z",
  "M88 61C108 29 148 25 157 52C166 78 134 94 91 70Z",
  "M76 70C49 72 23 89 25 108C43 109 67 93 83 74Z",
  "M91 70C119 76 137 94 128 116C108 108 94 89 85 75Z",
];
const BODY_SHAPE = "M80 56C88 51 96 55 96 67C96 87 85 106 75 112C72 91 74 71 80 56Z";

function collectPoints(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  gap: number,
) {
  const pixels = context.getImageData(0, 0, width, height).data;
  const points: Point[] = [];
  const sampleRadius = Math.max(1, Math.floor(gap / 3));

  for (let y = 0; y < height; y += gap) {
    for (let x = 0; x < width; x += gap) {
      let visible = false;
      for (let sampleY = Math.max(0, y - sampleRadius); sampleY <= Math.min(height - 1, y + sampleRadius) && !visible; sampleY += 1) {
        for (let sampleX = Math.max(0, x - sampleRadius); sampleX <= Math.min(width - 1, x + sampleRadius); sampleX += 1) {
          if (pixels[(sampleY * width + sampleX) * 4 + 3] > 80) {
            visible = true;
            break;
          }
        }
      }
      if (visible) points.push({ x, y });
    }
  }

  return points;
}

function drawButterflyPartMask(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  width: number,
  part: "antenna" | "wing" | "body",
) {
  const scale = width / 170;
  context.save();
  context.translate(centerX - 85 * scale, centerY - 66 * scale);
  context.scale(scale, scale);
  context.fillStyle = "#000";

  if (part === "wing") {
    for (const shape of WING_SHAPES) context.fill(new Path2D(shape));
  } else if (part === "body") {
    context.fill(new Path2D(BODY_SHAPE));
  } else {
    context.lineCap = "round";
    context.lineWidth = 3;
    context.strokeStyle = "#000";
    context.stroke(new Path2D("M84 57C80 34 70 16 62 -1"));
    context.stroke(new Path2D("M91 57C100 34 116 13 132 -4"));
    context.beginPath();
    context.arc(61, -3, 3, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(134, -5, 3, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function collectButterflyTargets(
  context: CanvasRenderingContext2D,
  center: Point,
  width: number,
  height: number,
  butterflyWidth: number,
  gap: number,
) {
  const targets: ButterflyTarget[] = [];
  const bodyTailStart = center.y + (butterflyWidth / 170) * 18;

  for (const part of ["antenna", "wing", "body"] as const) {
    context.clearRect(0, 0, width, height);
    drawButterflyPartMask(context, center.x, center.y, butterflyWidth, part);
    for (const point of collectPoints(context, width, height, gap)) {
      targets.push({
        ...point,
        part: part === "body" && point.y > bodyTailStart ? "tail" : part,
      });
    }
  }

  context.clearRect(0, 0, width, height);
  return targets;
}

function faceRight(point: Point, center: Point): Point {
  return {
    x: center.x - (point.y - center.y),
    y: center.y + (point.x - center.x),
  };
}

function butterflyColor(point: Point, center: Point) {
  if (Math.abs(point.x - center.x) < 24) return "#213b34";
  if (point.y > center.y + 12) return "#c2410c";
  return point.x < center.x ? "#2f6f55" : "#9bcf9f";
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function mixChannel(from: number, to: number, progress: number) {
  return Math.round(from + (to - from) * progress);
}

function mixColor(from: string, to: string, progress: number) {
  const source = [1, 3, 5].map((index) => Number.parseInt(from.slice(index, index + 2), 16));
  const target = [1, 3, 5].map((index) => Number.parseInt(to.slice(index, index + 2), 16));
  return `rgb(${mixChannel(source[0], target[0], progress)} ${mixChannel(source[1], target[1], progress)} ${mixChannel(source[2], target[2], progress)})`;
}

function buildParticles(
  canvas: HTMLCanvasElement,
  titleElement: HTMLElement,
  title: string,
) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const mask = document.createElement("canvas");
  mask.width = width;
  mask.height = height;
  const maskContext = mask.getContext("2d", { willReadFrequently: true });
  if (!maskContext) return null;

  const bounds = titleElement.getBoundingClientRect();
  const maximumFontSize = bounds.height * 0.78;
  maskContext.font = `600 ${maximumFontSize}px Georgia, 'Times New Roman', serif`;
  const measuredWidth = maskContext.measureText(title).width;
  const fontSize = measuredWidth > bounds.width
    ? maximumFontSize * (bounds.width / measuredWidth) * 0.94
    : maximumFontSize;
  maskContext.fillStyle = "#000";
  maskContext.font = `600 ${fontSize}px Georgia, 'Times New Roman', serif`;
  maskContext.textAlign = "center";
  maskContext.textBaseline = "middle";
  maskContext.fillText(title, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);

  const gap = Math.max(4, Math.min(6, Math.round(width / 165)));
  const titlePoints = collectPoints(maskContext, width, height, gap);
  maskContext.clearRect(0, 0, width, height);

  const center = {
    x: bounds.left + bounds.width / 2,
    y: bounds.top + bounds.height / 2,
  };
  const butterflyWidth = Math.min(width * 0.56, height * 0.78, 620);
  const targetPoints = collectButterflyTargets(
    maskContext,
    center,
    width,
    height,
    butterflyWidth,
    gap,
  );
  if (!titlePoints.length || !targetPoints.length) return null;

  const rightFacingTargets = targetPoints
    .map((point) => ({ point, target: faceRight(point, center) }))
    .sort((first, second) => first.target.y - second.target.y || first.target.x - second.target.x);

  const particles = titlePoints.map((point, index): Particle => {
    const targetIndex = Math.floor((index / titlePoints.length) * rightFacingTargets.length);
    const butterflyTarget = rightFacingTargets[Math.min(targetIndex, rightFacingTargets.length - 1)];
    return {
      ...point,
      color: TITLE_COLORS[index % TITLE_COLORS.length],
      depth: Math.max(-1, Math.min(1, (butterflyTarget.point.x - center.x) / (butterflyWidth / 2))),
      part: butterflyTarget.point.part,
      target: butterflyTarget.target,
      targetColor: butterflyColor(butterflyTarget.point, center),
    };
  });

  return { center, gap, height, particles, ratio, width };
}

export function DotMorphTitle({
  destination,
  title,
}: {
  destination: string;
  title: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const particlesRef = useRef<ReturnType<typeof buildParticles>>(null);
  const frameRef = useRef<number | null>(null);
  const animatingRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [animating, setAnimating] = useState(false);
  const router = useRouter();

  const draw = useCallback((formation = 0, fly = 0) => {
    const canvas = canvasRef.current;
    const scene = particlesRef.current;
    if (!canvas || !scene) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.setTransform(scene.ratio, 0, 0, scene.ratio, 0, 0);
    context.clearRect(0, 0, scene.width, scene.height);

    const flightX = fly * scene.width * 0.78;
    const flightY = Math.sin(fly * Math.PI) * -scene.height * 0.035
      + Math.sin(fly * Math.PI * 2) * scene.height * 0.008;
    const flightScale = 1 + fly * 0.08;
    const opacity = fly < 0.82 ? 1 : 1 - (fly - 0.82) / 0.18;
    const wingPulse = 1 - Math.abs(Math.sin(fly * Math.PI * 5)) * 0.07;
    const tangentX = scene.width * 0.78;
    const tangentY = -Math.cos(fly * Math.PI) * Math.PI * scene.height * 0.035
      + Math.cos(fly * Math.PI * 2) * Math.PI * 2 * scene.height * 0.008;
    const flightTilt = Math.atan2(tangentY, tangentX)
      * easeOutCubic(clamp01(formation / 0.32));
    const rotationCosine = Math.cos(flightTilt);
    const rotationSine = Math.sin(flightTilt);
    context.globalAlpha = opacity;

    for (const particle of scene.particles) {
      const delay = PART_DELAYS[particle.part];
      const morph = easeOutCubic(clamp01((formation - delay) / (1 - delay)));
      const x = particle.x + (particle.target.x - particle.x) * morph;
      const y = particle.y + (particle.target.y - particle.y) * morph;
      const butterflyY = scene.center.y
        + (y - scene.center.y) * (1 - (1 - wingPulse) * morph);
      const localX = (x - scene.center.x) * flightScale;
      const localY = (butterflyY - scene.center.y) * flightScale;
      const drawnX = scene.center.x + localX * rotationCosine - localY * rotationSine + flightX;
      const drawnY = scene.center.y + localX * rotationSine + localY * rotationCosine + flightY;
      const radius = Math.max(2.1, scene.gap * 0.4) * (1 + particle.depth * morph * 0.14);
      const shadowOffset = 0.7 + morph * 1.1;

      context.beginPath();
      context.globalAlpha = opacity * (0.12 + morph * 0.18);
      context.fillStyle = "#102e28";
      context.arc(drawnX + shadowOffset, drawnY + shadowOffset, radius * 1.04, 0, Math.PI * 2);
      context.fill();

      context.beginPath();
      context.globalAlpha = opacity;
      context.fillStyle = mixColor(particle.color, particle.targetColor, morph);
      context.arc(drawnX, drawnY, radius, 0, Math.PI * 2);
      context.fill();

      if (morph > 0.08) {
        context.beginPath();
        context.globalAlpha = opacity * morph * 0.42;
        context.fillStyle = "#fff";
        context.arc(
          drawnX - radius * 0.3,
          drawnY - radius * 0.34,
          radius * 0.28,
          0,
          Math.PI * 2,
        );
        context.fill();
      }
    }

    context.globalAlpha = 1;
  }, []);

  const rebuild = useCallback(() => {
    if (animatingRef.current || !canvasRef.current || !titleRef.current) return;
    particlesRef.current = buildParticles(canvasRef.current, titleRef.current, title);
    draw();
    setReady(Boolean(particlesRef.current));
  }, [draw, title]);

  useEffect(() => {
    const firstFrame = window.requestAnimationFrame(rebuild);
    window.addEventListener("resize", rebuild);
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.removeEventListener("resize", rebuild);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, [rebuild]);

  function activate() {
    if (animatingRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      router.push(destination);
      return;
    }

    animatingRef.current = true;
    setAnimating(true);
    const startedAt = performance.now();

    function animate(now: number) {
      const elapsedMs = now - startedAt;
      const progress = Math.min(elapsedMs / ANIMATION_MS, 1);
      const formation = Math.min(elapsedMs / FORMATION_MS, 1);
      const flight = progress * progress * (3 - 2 * progress);
      draw(formation, flight);

      if (progress < 1) {
        frameRef.current = window.requestAnimationFrame(animate);
      } else {
        router.push(destination);
      }
    }

    frameRef.current = window.requestAnimationFrame(animate);
  }

  return (
    <>
      <canvas aria-hidden="true" className={styles.dotCanvas} ref={canvasRef} />
      <h1 className={styles.title}>
        <span
          aria-label={title}
          className={`${styles.dotTitleAnchor} ${ready ? styles.dotTitleReady : ""}`}
          ref={titleRef}
        >
          <span aria-hidden="true" className={styles.dottedTitleFallback}>{title}</span>
        </span>
      </h1>
      <button
        aria-label="Let's help more women now. Continue"
        className={styles.cta}
        disabled={animating}
        onClick={activate}
        type="button"
      >
        <span>Let's help more women now.</span>
        <span aria-hidden="true" className={styles.arrow}>→</span>
      </button>
    </>
  );
}
