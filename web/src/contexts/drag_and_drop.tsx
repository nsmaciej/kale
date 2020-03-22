import React, { Component, useEffect, useContext, useState } from "react";
import ReactDOM from "react-dom";
import styled, { ThemeConsumer } from "styled-components";

import { ClientOffset, Rect } from "geometry";
import { KaleTheme } from "theme";
import { Optional, assertSome, assert } from "utils";
import Expr from "expr";
import layoutExpr from "expr_view/layout";

const Container = styled.div`
    position: absolute;
    background: ${p => p.theme.colour.background};
    box-shadow: ${p => p.theme.shadow.normal};
    padding: ${p => p.theme.exprList.padding.combine(p.theme.highlight.padding).css};
    border-radius: ${p => p.theme.exprList.borderRadius}px;
    box-sizing: content-box;
    z-index: 1000;
`;

export interface DropListener {
    /** Fires to give a listener an opportunity to show that a drop is accepted. */
    dragUpdate(point: ClientOffset | null): void;
    /** Fires when the dragged object moves. Should return if this listener accepted the drop. If
     * move is returned, the draggedOut listener on the expr that begun the drag is not caleld */
    acceptDrop(point: ClientOffset, expr: Expr): "copy" | "move" | "reject";
}

export interface DragAndDropValue {
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

interface DragAndDropSurfaceState {
    position: Optional<ClientOffset>;
}

export const DragAndDrop = React.createContext<Optional<DragAndDropValue>>(null);

// There are three states to a drag.
// 1. Not dragging - drag and state.position is null.
// 2. Maybe-drag - drag is now initialised, except for delta.
// 3. Drag - Delta is now initialised, state.position follows the mouse.
export default class DragAndDropSurface extends Component<{}, DragAndDropSurfaceState> {
    state: DragAndDropSurfaceState = { position: null };

    private drag: Optional<{
        start: ClientOffset; // Where the maybe-drag started.
        delta: Optional<ClientOffset>; // How much to offset the expr when showing the drag.
        exprStart: ClientOffset; // Where is the corner of the xpr.
        draggedOut?: () => void; // Fired when the drag completes.
        expr: Expr;
    }>;

    private readonly listeners = new Set<DropListener>();

    private readonly dismissDrag = () => {
        // Note this calls both .drop and then .update on the listeners.

        if (this.drag?.delta != null) {
            const exprCorner = assertSome(this.state.position).offset(this.drag.delta);
            const expr = this.drag.expr;
            for (const listener of this.listeners) {
                const status = listener.acceptDrop(exprCorner, expr);
                if (status === "reject") continue;
                if (status === "move") this.drag.draggedOut?.();
                break;
            }
        }
        this.drag = null;
        // Premature optimisation. This method is called on every other mouse move.
        if (this.state.position != null) {
            this.listeners.forEach(f => f.dragUpdate(null));
            this.setState({ position: null });
        }
    };

    private readonly onMouseMove = (event: MouseEvent) => {
        event.preventDefault();
        // Ensure left mouse button is held down.
        if (event.buttons !== 1 || this.drag == null) {
            this.dismissDrag();
            return;
        }

        const DRAG_THRESHOLD = 4; // Based on Windows default, DragHeight registry.
        const position = ClientOffset.fromClient(event);
        if (this.drag.delta == null) {
            // Consider starting a drag.
            if (this.drag.start.distance(position) > DRAG_THRESHOLD) {
                this.drag.delta = this.drag.exprStart.difference(position);
                this.setState({ position });
            }
        } else {
            // Update the drag.
            this.setState({ position });
            const exprCorner = position.offset(this.drag.delta);
            this.listeners.forEach(x => x.dragUpdate(exprCorner));
        }
    };

    componentDidMount() {
        document.addEventListener("mousemove", this.onMouseMove);
    }
    componentWillUnmount() {
        document.removeEventListener("mousemove", this.onMouseMove);
    }

    private readonly contextValue: DragAndDropValue = {
        maybeStartDrag: (start, exprStart, expr, draggedOut) => {
            this.drag = { start, expr, exprStart, draggedOut, delta: null };
        },
        addListener: listener => {
            this.listeners.add(listener);
        },
        removeListener: listener => {
            this.listeners.delete(listener);
        },
    };

    private renderExpr(theme: KaleTheme) {
        assert(this.drag?.delta != null);
        const pos = assertSome(this.state.position).offset(this.drag.delta);
        const { nodes, size } = layoutExpr(theme, this.drag.expr);
        return (
            // Cover the entire page in a div so we can always get the mouseUp event.
            // Bug: Safari doesn't like drawing box-shadows on SVGs (it leaves a ghost trail), it
            // must be drawn on the Container div instead.
            <div
                onMouseUp={this.dismissDrag}
                style={{ width: "100%", height: "100%", position: "fixed" }}
            >
                <Container style={{ top: pos.y, left: pos.x }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width={size.width} height={size.height}>
                        {nodes}
                    </svg>
                </Container>
            </div>
        );
    }

    render() {
        let surface: React.ReactNode;

        if (this.drag?.delta != null) {
            surface = ReactDOM.createPortal(
                <ThemeConsumer>{theme => this.renderExpr(theme)}</ThemeConsumer>,
                document.body,
            );
        }

        return (
            <DragAndDrop.Provider value={this.contextValue}>
                {surface}
                {this.props.children}
            </DragAndDrop.Provider>
        );
    }
}

export function useDrop(listener: DropListener) {
    const dragAndDrop = assertSome(useContext(DragAndDrop));
    useEffect(() => {
        dragAndDrop.addListener(listener);
        return () => dragAndDrop.removeListener(listener);
    }, [dragAndDrop, listener]);
}

export function useSimpleDrop(
    ref: React.RefObject<HTMLElement>,
    onDrop: (expr: Expr) => void,
): boolean {
    const [lastContains, setLastContains] = useState(false);
    function getRect() {
        const clientRect = ref.current?.getBoundingClientRect();
        return clientRect === undefined ? null : Rect.fromBoundingRect(clientRect);
    }
    useDrop({
        dragUpdate(point) {
            const contains = (point !== null && getRect()?.contains(point)) ?? false;
            setLastContains(contains);
        },
        acceptDrop(point, expr) {
            if (getRect()?.contains(point)) {
                onDrop(expr);
                return "move";
            }
            return "reject";
        },
    });
    return lastContains;
}
