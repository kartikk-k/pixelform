import { useRef, useState, useCallback } from "react";
import { MAX_UNDO } from "../types";

export function useUndoRedo(
  activeCellsRef: React.RefObject<Set<string>>,
  setActiveCells: React.Dispatch<React.SetStateAction<Set<string>>>,
) {
  const undoStack = useRef<Set<string>[]>([]);
  const redoStack = useRef<Set<string>[]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);

  const pushUndo = useCallback((snapshot: Set<string>) => {
    undoStack.current.push(new Set(snapshot));
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
    redoStack.current = [];
    setUndoCount(undoStack.current.length);
    setRedoCount(0);
  }, []);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    redoStack.current.push(new Set(activeCellsRef.current));
    setActiveCells(undoStack.current.pop()!);
    setUndoCount(undoStack.current.length);
    setRedoCount(redoStack.current.length);
  }, [activeCellsRef, setActiveCells]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    undoStack.current.push(new Set(activeCellsRef.current));
    setActiveCells(redoStack.current.pop()!);
    setUndoCount(undoStack.current.length);
    setRedoCount(redoStack.current.length);
  }, [activeCellsRef, setActiveCells]);

  return { pushUndo, undo, redo, undoCount, redoCount };
}
