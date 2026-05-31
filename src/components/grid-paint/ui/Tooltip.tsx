export function Tooltip({ label, shortcut, children, side = "bottom", align = "center" }: {
  label: string;
  shortcut?: string;
  children: React.ReactNode;
  side?: "top" | "bottom";
  align?: "start" | "center" | "end";
}) {
  const sideClass = side === "bottom" ? "top-full mt-2" : "bottom-full mb-2";
  const alignClass = align === "start" ? "left-0" : align === "end" ? "right-0" : "left-1/2 -translate-x-1/2";
  return (
    <div className="relative group/tip hover:z-[200]">
      {children}
      <div className={`pointer-events-none absolute ${alignClass} ${sideClass} opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 whitespace-nowrap z-[200]`}>
        <div className="bg-black/80 backdrop-blur-sm text-white text-[10px] rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 shadow-lg">
          <span>{label}</span>
          {shortcut && <kbd className="bg-white/15 rounded px-1.5 py-0.5 text-[9px] font-mono">{shortcut}</kbd>}
        </div>
      </div>
    </div>
  );
}
