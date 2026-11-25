import type { Position } from "@/types/canvas";

export function snapCanvasNodeDragOffset(offset: Position, anchor: Position | undefined, gridSize: number, enabled: boolean) {
    if (!enabled || !anchor || !Number.isFinite(gridSize) || gridSize <= 0) return offset;
    return {
        x: Math.round((anchor.x + offset.x) / gridSize) * gridSize - anchor.x,
        y: Math.round((anchor.y + offset.y) / gridSize) * gridSize - anchor.y,
    };
}
