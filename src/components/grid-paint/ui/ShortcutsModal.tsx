export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-neutral-800/40" />
      <div
        className="relative bg-neutral-700 rounded-3xl p-6 max-w-md w-full backdrop-blur-[100px] cursor-default brightness-125 mx-4 max-h-[80vh] overflow-y-auto text-white text-sm"
        style={{ overscrollBehavior: "auto", userSelect: "text" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="opacity-50 hover:opacity-100 cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="4" x2="14" y2="14" /><line x1="14" y1="4" x2="4" y2="14" /></svg>
          </button>
        </div>
        <div className="space-y-1.5">
          {[
            ["1 – 7", "Switch pattern"],
            ["X", "Toggle paint / erase"],
            ["H", "Horizontal symmetry"],
            ["V", "Vertical symmetry"],
            ["B", "Both symmetry"],
            ["I", "Invert"],
            ["T", "Tile preview"],
            ["R", "Random shape"],
            ["0", "Fit to content"],
            ["⌫", "Clear canvas"],
            ["⌘ Z", "Undo"],
            ["⌘ ⇧ Z", "Redo"],
            ["⌘ +", "Zoom in"],
            ["⌘ −", "Zoom out"],
            ["⌘ C", "Copy SVG"],
            ["Shift + drag", "Straight line"],
            ["Alt + drag", "Pan canvas"],
            ["Scroll", "Pan canvas"],
            ["Pinch", "Zoom"],
            ["/", "This dialog"],
          ].map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between py-1">
              <span className="opacity-60">{desc}</span>
              <kbd className="bg-white/10 rounded px-2 py-0.5 text-xs font-mono min-w-[2.5rem] text-center">{key}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
