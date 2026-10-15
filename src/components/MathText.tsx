"use client";

import katex from "katex";
import { useMemo } from "react";

/**
 * Renders text with inline math between $...$ and display math between $$...$$.
 * Bangla and English text pass through unchanged. Example: "বেগ $v = u + at$ হলে…"
 */
export function MathText({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => renderMath(text || ""), [text]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function renderMath(text: string): string {
  const parts = text.split(/(\$\$[^$]+\$\$|\$[^$\n]+\$)/g);
  return parts
    .map((part) => {
      const display = part.startsWith("$$") && part.endsWith("$$") && part.length > 4;
      const inline = !display && part.startsWith("$") && part.endsWith("$") && part.length > 2;
      if (!display && !inline) return escapeHtml(part).replace(/\n/g, "<br/>");
      const tex = display ? part.slice(2, -2) : part.slice(1, -1);
      try {
        return katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: "ignore" });
      } catch {
        return escapeHtml(part);
      }
    })
    .join("");
}
