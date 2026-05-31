"use client";

import { useState } from "react";
import { COLLECTION_SHAPES } from "@/data/collection";

export default function Collection() {
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (svg: string, name: string) => {
    navigator.clipboard.writeText(svg.replace(/fill="currentColor"/g, 'fill="black"'));
    setCopied(name);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {COLLECTION_SHAPES.map((shape) => (
        <button
          key={shape.name}
          onClick={() => handleCopy(shape.svg, shape.name)}
          className="bg-[#FDFDFD] group relative aspect-square rounded-4xl cursor-pointer transition-all duration-200 active:scale-95 overflow-hidden flex items-center justify-center p-10"
        >
          <div
            className="w-full h-full text-black/50 group-hover:text-black transition-colors [&>svg]:w-full [&>svg]:h-full"
            dangerouslySetInnerHTML={{ __html: shape.svg.replace(/\s+width="[^"]*"/g, "").replace(/\s+height="[^"]*"/g, "") }}
          />

          {/* Hover overlay */}
          <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/80 transition-colors flex items-center justify-center">
            <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 uppercase tracking-wider">
              {copied === shape.name ? "Copied!" : "Click to copy"}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
