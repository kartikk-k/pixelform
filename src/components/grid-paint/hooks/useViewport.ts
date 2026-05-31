import { useRef, useState, useCallback, useEffect } from "react";
import { ZOOM_MIN, ZOOM_MAX } from "../types";

export function useViewport(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [animateTransform, setAnimateTransform] = useState(false);
  const animateTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  panRef.current = pan;
  zoomRef.current = zoom;

  const triggerAnimatedTransform = useCallback(() => {
    setAnimateTransform(true);
    if (animateTimeout.current) clearTimeout(animateTimeout.current);
    animateTimeout.current = setTimeout(() => setAnimateTransform(false), 200);
  }, []);

  // Resize
  useEffect(() => {
    function updateSize() { setDimensions({ width: window.innerWidth, height: window.innerHeight }); }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Gestures / wheel
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const preventGesture = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", preventGesture, { passive: false });
    document.addEventListener("gesturechange", preventGesture, { passive: false });
    document.addEventListener("gestureend", preventGesture, { passive: false });

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (e.ctrlKey) {
        const zoomDelta = -e.deltaY * 0.01;
        setZoom((prev) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prev * (1 + zoomDelta))));
        setPan((prev) => {
          const factor = 1 + zoomDelta;
          return { x: e.clientX - (e.clientX - prev.x) * factor, y: e.clientY - (e.clientY - prev.y) * factor };
        });
        return;
      }
      setPan((prev) => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
    };
    container.addEventListener("wheel", handleWheel, { passive: false });

    const blockOverscroll = (e: WheelEvent) => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) e.preventDefault(); };
    document.addEventListener("wheel", blockOverscroll, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("gestureend", preventGesture);
      container.removeEventListener("wheel", handleWheel);
      document.removeEventListener("wheel", blockOverscroll);
    };
  }, [containerRef]);

  // Touch pinch/pan
  const touchStateRef = useRef<{ lastCenter: { x: number; y: number } | null; lastDist: number | null }>({ lastCenter: null, lastDist: null });
  const isPaintingRef = useRef(false); // Will be set by painting hook

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    function getTouchDist(e: TouchEvent) { return Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); }
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault();
        isPaintingRef.current = false;
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2, cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        touchStateRef.current = { lastCenter: { x: cx, y: cy }, lastDist: getTouchDist(e) };
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault();
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2, cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const dist = getTouchDist(e);
        const { lastCenter, lastDist } = touchStateRef.current;
        if (lastCenter) setPan((prev) => ({ x: prev.x + cx - lastCenter.x, y: prev.y + cy - lastCenter.y }));
        if (lastDist && lastDist > 0) {
          const scale = dist / lastDist;
          setZoom((prev) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prev * scale)));
          setPan((prev) => ({ x: cx - (cx - prev.x) * scale, y: cy - (cy - prev.y) * scale }));
        }
        touchStateRef.current = { lastCenter: { x: cx, y: cy }, lastDist: dist };
      }
    };
    const handleTouchEnd = (e: TouchEvent) => { if (e.touches.length < 2) touchStateRef.current = { lastCenter: null, lastDist: null }; };
    container.addEventListener("touchstart", handleTouchStart, { passive: false });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd);
    return () => { container.removeEventListener("touchstart", handleTouchStart); container.removeEventListener("touchmove", handleTouchMove); container.removeEventListener("touchend", handleTouchEnd); };
  }, [containerRef]);

  return {
    pan, setPan, panRef,
    zoom, setZoom, zoomRef,
    dimensions,
    animateTransform,
    triggerAnimatedTransform,
    isPaintingRef,
  };
}
