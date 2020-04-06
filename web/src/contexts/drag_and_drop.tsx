import React, { useState, ReactNode, useRef } from "react";
import ReactDOM from "react-dom";
import styled, { useTheme } from "styled-components";

import { assertSome, map } from "utils";
import { ClientOffset, Offset } from "geometry";
import { useWindowEvent, usePlatformModifierKey, useRefMap } from "hooks";
import Expr from "expr";
import layoutExpr from "expr_view/layout";

const Container = styled.div`
    position: fixed;
    z-index: 1000;
    touch-action: none;
    background: ${(p) => p.theme.colour.background};
    box-shadow: ${(p) => p.theme.shadow.normal};
    border-radius: ${(p) => p.theme.exprList.borderRadius}px;
    box-sizing: content-box;
    padding: ${(p) => p.theme.exprView.widePadding.css};
`;

export interface DropListener {
    /** Fires to give a listener an opportunity to show that a drop is accepted. */
    dragUpdate(point: ClientOffset | null, expr: Expr | null): void;
    /** Fires when the dragged object moves. Should return if this listener accepted the drop. */
    acceptDrop(point: ClientOffset, expr: Expr): boolean;
}

type PointerId = number;

export interface DragData {
    /** Pointer id that started this event. */
    pointerId: PointerId;
    /** What point did the pointer event start at. */
    clientOffset: ClientOffset;
    /** The corner of the to-be-dragged expr, in client space. */
    exprStart: ClientOffset;
    /** Called when the drag status changes. */
    onDragUpdate?(willMove: boolean): void;
    /** Called if the drag is accepted. This is almost always the case except when copying. */
    onDragAccepted?(willMove: boolean): void;
    /** Called when the drag concludes, no matter the acceptance status. */
    onDragEnd?(): void;
    /** The expr to be dragged. */
    expr: Expr;
}

export interface DragAndDropContext {
    /** Possibly start a drag */
    maybeStartDrag(maybeDrag: DragData): void;
    addListener(listener: DropListener): void;
    removeListener(listener: DropListener): void;
}

const DragAndDrop = React.createContext<DragAndDropContext | null>(null);
export default DragAndDrop;

interface DragState {
    /** Callbacks and drag info. */
    data: DragData;
    /** How much to offset the expr when showing the drag. Pretty much always a negative number. */
    delta: Offset | null;
    /** How much to offset the hit-point, accounting for any padding the container has plus some
     * fudge. */
    hitpointDelta: Offset | null;
    /** Where was the the overlay rendered. */
    position: ClientOffset | null;
}

// There are three states to a drag.
// 1. Not dragging - drag and position is null.
// 2. Maybe-drag - draging state is now initialised, but without any deltas,
// 3. Drag - Deltas are now initialised, position follows the mouse.
export function DragAndDropSurface({ children }: { children: ReactNode }) {
    const theme = useTheme();
    const listeners = useRef(new Set<DropListener>()).current;
    const [rendering, setRendering] = useState<Set<PointerId>>(new Set());
    const drags = useRef<Map<PointerId, DragState>>(new Map()).current;
    const overlayRefs = useRefMap<PointerId, HTMLDivElement>(rendering.keys());

    // If user is pressing the platform modifier key, copy expressions instead of moving them.
    const copyMode = usePlatformModifierKey();

    useWindowEvent("pointermove", (e) => onPointerMove(e));
    // This should ideally use pointer capture on the Overlay elements, but Safari doesn't like
    // nested pointer capture elements in Safari 13. See https://bugs.webkit.org/show_bug.cgi?id=203364
    useWindowEvent("pointerup", (e) => completeDrag(e.pointerId));
    useWindowEvent("pointercancel", (e) => dismissDrag(e.pointerId));

    // Since we aren't using ExprView, we add highlight padding on our own.
    const padding = theme.exprList.padding.combine(theme.highlight.padding);

    const contextValue = useRef<DragAndDropContext>({
        maybeStartDrag(data: DragData) {
            drags.set(data.pointerId, { data, delta: null, hitpointDelta: null, position: null });
        },
        addListener(listener) {
            listeners.add(listener);
        },
        removeListener(listener) {
            listeners.delete(listener);
        },
    }).current;

    function dismissDrag(pointerId: number) {
        drags.delete(pointerId);
        markRendering(pointerId, false);
    }

    function completeDrag(pointerId: number) {
        const drag = drags.get(pointerId);
        if (drag === undefined || drag.position === null || drag.hitpointDelta === null) return;
        const exprCorner = drag.position.offset(drag.hitpointDelta);
        const expr = drag.data.expr;
        for (const listener of listeners) {
            if (listener.acceptDrop(exprCorner, expr)) {
                drag.data.onDragAccepted?.(copyMode);
                break;
            }
        }
        // Make sure everyone knows that we completed the drop.
        listeners.forEach((f) => f.dragUpdate(null, null));
        drag.data.onDragEnd?.();
        dismissDrag(pointerId);
    }

    function markRendering(pointerId: PointerId, visible: boolean) {
        let copy;
        if (visible) {
            if (rendering.has(pointerId)) return;
            copy = new Set(rendering);
            copy.add(pointerId);
        } else {
            if (!rendering.has(pointerId)) return;
            copy = new Set(rendering);
            copy.delete(pointerId);
        }
        setRendering(copy);
    }

    function onPointerMove(event: PointerEvent) {
        if (event.buttons !== 1) return;
        const drag = drags.get(event.pointerId);
        if (drag === undefined) return;

        const DRAG_THRESHOLD = 4; // Based on Windows default, DragHeight registry.
        const nextPosition = ClientOffset.fromClient(event);
        if (drag.hitpointDelta === null) {
            // Consider starting a drag.
            if (drag.data.clientOffset.distance(nextPosition) > DRAG_THRESHOLD) {
                drag.delta = drag.data.exprStart.difference(nextPosition);
                drag.hitpointDelta = drag.delta
                    .difference(padding.topLeft)
                    .difference(new Offset(6, 0));
                // Send the initial drag update, reflecting the current modifer state.
                drag.data.onDragUpdate?.(copyMode);
                drag.position = nextPosition;
                markRendering(event.pointerId, true);
            }
        } else if (event.pointerId === drag.data.pointerId) {
            // Update the drag.
            drag.position = nextPosition;
            const overlay = overlayRefs.get(event.pointerId)?.current;
            const pos = nextPosition.offset(assertSome(drag.delta));
            if (overlay !== undefined) {
                // Highly cursed directy dom manipulation, we set drag.position so a full re-render
                // should yield the same result.
                overlay.style.top = pos.y.toString() + "px";
                overlay.style.left = pos.x.toString() + "px";
            }
            const exprCorner = nextPosition.offset(drag.hitpointDelta);
            listeners.forEach((x) => x.dragUpdate(exprCorner, drag.data.expr));
        }
    }

    function renderExpr(pointerId: PointerId) {
        const drag = drags.get(pointerId);
        if (drag === undefined) return;
        const pos = assertSome(drag.position).offset(assertSome(drag.delta));

        const { nodes, size } = layoutExpr(theme, drag.data.expr);
        return (
            // Bug: Safari doesn't like drawing box-shadows on SVGs (it leaves a ghost trail), it
            // must be drawn on the Container div instead.
            <Container
                ref={overlayRefs.get(pointerId)}
                style={{
                    cursor: copyMode ? "copy" : "grabbing",
                    padding: padding.css,
                    top: pos.y,
                    left: pos.x,
                }}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width={size.width}
                    height={size.height}
                    // Prevent weird white-space spacing issues.
                    display="block"
                >
                    {nodes}
                </svg>
            </Container>
        );
    }

    // Declare the global droppable filter here once.
    return (
        <DragAndDrop.Provider value={contextValue}>
            {map(rendering.keys(), (x) => ReactDOM.createPortal(renderExpr(x), document.body))}
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="0"
                height="0"
                style={{ position: "absolute" }}
            >
                <filter id="droppable">
                    <feDropShadow
                        dx="0"
                        dy="0"
                        stdDeviation={theme.droppable.radius / 2}
                        floodColor={theme.droppable.colour}
                    />
                </filter>
            </svg>
            {children}
        </DragAndDrop.Provider>
    );
}
