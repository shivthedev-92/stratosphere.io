"use client";

import { useMemo } from "react";
import QRCode from "qrcode";

/**
 * A QR code drawn as SVG by React. The `qrcode` package only computes the
 * module grid; nothing is injected as HTML. Always dark on white, whatever
 * the theme, because phone cameras need that contrast.
 */
export function QrCode({ value, size = 168, label }: { value: string; size?: number; label: string }) {
  const { path, count } = useMemo(() => {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
    const quiet = 4; // the blank border scanners need
    let d = "";
    for (let row = 0; row < modules.size; row += 1) {
      for (let col = 0; col < modules.size; col += 1) {
        if (modules.get(row, col)) d += `M${col + quiet} ${row + quiet}h1v1h-1z`;
      }
    }
    return { path: d, count: modules.size + quiet * 2 };
  }, [value]);

  return (
    <svg
      viewBox={`0 0 ${count} ${count}`}
      width={size}
      height={size}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className="rounded-control"
    >
      <rect width={count} height={count} fill="#FFFFFF" />
      <path d={path} fill="#16151F" />
    </svg>
  );
}
