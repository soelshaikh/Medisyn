"use client";

import { useId } from "react";

type Size  = "xs" | "sm" | "md" | "lg";
type Color = "primary" | "white" | "current";

interface SpinnerProps {
  size?:      Size;
  color?:     Color;
  className?: string;
}

const PALETTE: Record<Color, [fill: string, tint: string]> = {
  primary: ["var(--color-primary)", "var(--color-primary-light)"],
  white:   ["#ffffff",              "rgba(255,255,255,0.22)"    ],
  current: ["currentColor",         "currentColor"              ],
};

export function Spinner({ size = "md", color = "primary", className = "" }: SpinnerProps) {
  const uid         = useId().replace(/:/g, "");
  const [fill, tint] = PALETTE[color];

  /* ── xs / sm ── single rotating capsule pill ── */
  if (size === "xs" || size === "sm") {
    const h  = size === "xs" ? 8 : 12;
    const w  = Math.round(h * 2.3);
    const r  = h / 2;
    const sw = Math.max(1, h / 9);
    const cid = `${uid}c`;

    return (
      <svg
        role="status" aria-label="Loading"
        width={w} height={h}
        viewBox={`0 0 ${w} ${h}`}
        fill="none"
        className={className}
        style={{ display: "block" }}
      >
        <defs>
          <clipPath id={cid}>
            <rect x={w / 2} y={0} width={w / 2} height={h} />
          </clipPath>
          <style>{`@keyframes ms-spin-${uid}{to{transform:rotate(360deg)}}`}</style>
        </defs>

        {/* Rotating group — origin set to pill centre */}
        <g style={{
          transformBox:    "fill-box",
          transformOrigin: "center",
          animation:       `ms-spin-${uid} 0.85s linear infinite`,
        }}>
          <rect width={w} height={h} rx={r} fill={tint} />
          <rect width={w} height={h} rx={r} fill={fill} clipPath={`url(#${cid})`} opacity={0.92} />
          <rect
            x={sw / 2} y={sw / 2} width={w - sw} height={h - sw}
            rx={r} stroke={fill} strokeWidth={sw} fill="none" opacity={0.45}
          />
          {/* Centre seam line */}
          <line
            x1={w / 2} y1={sw} x2={w / 2} y2={h - sw}
            stroke={fill} strokeWidth={sw * 0.8} opacity={0.25}
          />
        </g>
      </svg>
    );
  }

  /* ── md / lg ── three bouncing capsule pills ── */
  const ph     = size === "md" ? 11 : 15;
  const pw     = Math.round(ph * 2.3);
  const gap    = Math.round(ph * 0.6);
  const bumpH  = Math.round(ph * 1.15);
  const totalW = pw * 3 + gap * 2;
  const svgH   = ph + bumpH + 2;
  const r      = ph / 2;
  const sw     = Math.max(1.5, ph / 9);

  return (
    <svg
      role="status" aria-label="Loading"
      width={totalW} height={svgH}
      viewBox={`0 0 ${totalW} ${svgH}`}
      fill="none"
      className={className}
      style={{ display: "block" }}
    >
      <defs>
        {[0, 1, 2].map((i) => (
          <clipPath key={i} id={`${uid}c${i}`}>
            <rect x={pw / 2} y={0} width={pw / 2} height={ph} />
          </clipPath>
        ))}
        <style>{`
          @keyframes ms-bounce-${uid} {
            0%,75%,100% { transform: translateY(0px);       }
            38%          { transform: translateY(-${bumpH}px); }
          }
        `}</style>
      </defs>

      {[0, 1, 2].map((i) => {
        const x = i * (pw + gap);
        return (
          /* Outer g: SVG-transform positions pill at resting X,Y  */
          <g key={i} transform={`translate(${x},${bumpH})`}>
            {/* Inner g: CSS-animation bounces only in Y  */}
            <g style={{ animation: `ms-bounce-${uid} 1s ease-in-out ${i * 0.2}s infinite` }}>
              {/* Tint (left half + base) */}
              <rect width={pw} height={ph} rx={r} fill={tint} />
              {/* Fill (right half overlay) */}
              <rect width={pw} height={ph} rx={r} fill={fill} clipPath={`url(#${uid}c${i})`} opacity={0.9} />
              {/* Border */}
              <rect
                x={sw / 2} y={sw / 2} width={pw - sw} height={ph - sw}
                rx={r} stroke={fill} strokeWidth={sw} fill="none" opacity={0.4}
              />
              {/* Centre seam */}
              <line
                x1={pw / 2} y1={sw} x2={pw / 2} y2={ph - sw}
                stroke={fill} strokeWidth={sw * 0.8} opacity={0.2}
              />
            </g>
          </g>
        );
      })}
    </svg>
  );
}
