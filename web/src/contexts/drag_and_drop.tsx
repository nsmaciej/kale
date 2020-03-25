import React, { useState, ReactNode, useRef } from "react";
import ReactDOM from "react-dom";
import styled, { useTheme } from "styled-components";

import { ClientOffset } from "geometry";
import { assertSome, assert } from "utils";
import { useDocumentEvent, useContextChecked } from "hooks";
import Clipboard from "contexts/clipboard";
import Expr from "expr";
import layoutExpr from "expr_view/layout";

const Container = styled.div`
    position: absolute;
    background: ${(p) => p.theme.colour.background};
    box-shadow: ${(p) => p.theme.shadow.normal};
    padding: ${(p) => p.theme.exprList.padding.combine(p.theme.highlight.padding).css};
    border-radius: ${(p) => p.theme.exprList.borderRadius}px;
    box-sizing: content-box;
`;

export interface DropListener {
    /** Fires to give a listener an opportunity to show that a drop is accepted. */
    dragUpdate(point: ClientOffset | null): void;
    /** Fires when the dragged object moves. Should return if this listener accepted the drop. If
     * move is returned, the draggedOut listener on the expr that begun the drag is not caleld */
    acceptDrop(point: ClientOffset, expr: Expr): "copy" | "move" | "reject";
}

export interface DragAndDropContext {
    /** Initialise a drag.
     * @param draggedOut Fires if `acceptDrop` returns "move" */
    maybeStartDrag(
        start: ClientOffset,
        exprStart: ClientOffset,
        expr: Expr,
        draggedOut?: () => void,
    ): void;
    addListener(listener: DropListener): void;
    removeListener(listener: DropListener): void;
}

const DragAndDrop = React.createContext<DragAndDropContext | null>(null);
export default DragAndDrop;

interface DraggingState {
    start: ClientOffset; // Where the maybe-drag started.
    delta: ClientOffset | null; // How much to offset the expr when showing the drag.
    exprStart: ClientOffset; // Where is the corner of the xpr.
    draggedOut?: () => void; // Fired when the drag completes.
    expr: Expr;
}

// There are three states to a drag.
// 1. Not dragging - drag and state.position is null.
// 2. Maybe-drag - drag is now initialised, except for delta.
// 3. Drag - Delta is now initialised, state.position follows the mouse.
export function DragAndDropSurface({ children }: { children: ReactNode }) {
    const theme = useTheme();
    const clipboard = useContextChecked(Clipboard);
    const [position, setPosition] = useState<ClientOffset | null>(null);
    const listeners = useRef(new Set<DropListener>()).current;
    const drag = useRef<DraggingState | null>(null);

    useDocumentEvent("mousemove", onMouseMove);

    const contextValue = useRef<DragAndDropContext>({
        maybeStartDrag(start, exprStart, expr, draggedOut) {
            drag.current = { start, expr, exprStart, draggedOut, delta: null };
        },
        addListener(listener) {
            listeners.add(listener);
        },
        removeListener(listener) {
            listeners.delete(listener);
        },
    }).current;

    function dismissDrag() {
        // Note this calls both .drop and then .update on the listeners.
        if (drag.current !== null && drag.current.delta !== null) {
            const exprCorner = assertSome(position).offset(drag.current.delta);
            const expr = drag.current.expr;
            let accepted = false;
            for (const listener of listeners) {
                const status = listener.acceptDrop(exprCorner, expr);
                if (status === "reject") continue;
                if (status === "move") drag.current.draggedOut?.();
                accepted = true;
                break;
            }
            if (!accepted) {
                clipboard.dispatch({ type: "add", entry: { expr, pinned: false } });
                drag.current.draggedOut?.();
            }
        }
        drag.current = null;
        // Premature optimisation. This method is called on every other mouse move.
        if (position !== null) {
            listeners.forEach((f) => f.dragUpdate(null));
            setPosition(null);
        }
    }

    function onMouseMove(event: MouseEvent) {
        event.preventDefault();
        // Ensure left mouse button is held down.
        if (event.buttons !== 1 || drag.current === null) {
            dismissDrag();
            return;
        }

        const DRAG_THRESHOLD = 4; // Based on Windows default, DragHeight registry.
        const nextPosition = ClientOffset.fromClient(event);
        if (drag.current.delta === null) {
            // Consider starting a drag.
            if (drag.current.start.distance(nextPosition) > DRAG_THRESHOLD) {
                drag.current.delta = drag.current.exprStart.difference(nextPosition);
                setPosition(nextPosition);
            }
        } else {
            // Update the drag.
            setPosition(nextPosition);
            const exprCorner = nextPosition.offset(drag.current.delta);
            listeners.forEach((x) => x.dragUpdate(exprCorner));
        }
    }

    function renderExpr() {
        assert(drag.current?.delta != null);
        const pos = assertSome(position).offset(drag.current.delta);
        const { nodes, size } = layoutExpr(theme, drag.current.expr);
        return (
            // Cover the entire page in a div so we can always get the mouseUp event.
            // Bug: Safari doesn't like drawing box-shadows on SVGs (it leaves a ghost trail), it
            // must be drawn on the Container div instead.
            <div
                onMouseUp={dismissDrag}
                style={{ width: "100%", height: "100%", position: "fixed", zIndex: 1000 }}
            >
                <Container style={{ top: pos.y, left: pos.x }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width={size.width} height={size.height}>
                        {nodes}
                    </svg>
                </Container>
            </div>
        );
    }

    let surface: React.ReactNode;
    if (drag.current?.delta != null) {
        surface = ReactDOM.createPortal(renderExpr(), document.body);
    }

    // Declare the global droppable filter here once.
    return (
        <DragAndDrop.Provider value={contextValue}>
            {surface}
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
