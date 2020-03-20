import React, { Component, useEffect, useContext, useRef, useState } from "react";
import ReactDOM from "react-dom";
import styled, { ThemeConsumer } from "styled-components";

import { ClientOffset, Rect } from "geometry";
import { KaleTheme } from "theme";
import { Optional, assertSome, assert } from "utils";
import Expr from "expr";
import layoutExpr, { LayoutProps } from "expr_view/layout";

const Container = styled.svg`
    position: absolute;
    background: ${p => p.theme.colour.background};
    box-shadow: ${p => p.theme.boxShadow};
    padding: ${p => p.theme.exprList.padding.add(p.theme.highlight.padding).css};
    border-radius: ${p => p.theme.exprList.borderRadius}px;
    box-sizing: content-box;
    z-index: 1000;
`;

export interface DropListener {
    update(point: ClientOffset | null): void;
    drop(point: ClientOffset, expr: Expr): void;
}

export interface DragAndDropValue {
    maybeStartDrag(start: ClientOffset, exprStart: ClientOffset, expr: Expr): void;
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
        expr: Expr;
    }>;

    private readonly listeners = new Set<DropListener>();

    private readonly dismissDrag = () => {
        // Note this calls both .drop and then .update on the listeners.

        if (this.drag?.delta != null) {
            const exprCorner = assertSome(this.state.position).add(this.drag.delta);
            const expr = this.drag.expr;
            this.listeners.forEach(x => x.drop(exprCorner, expr));
        }
        this.drag = null;
        // Premature optimisation. This method is called on every other mouse move.
        if (this.state.position != null) {
            this.listeners.forEach(f => f.update(null));
            this.setState({ position: null });
        }
    };

    private readonly onMouseMove = (event: MouseEvent) => {
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
            const exprCorner = position.add(this.drag.delta);
            this.listeners.forEach(x => x.update(exprCorner));
        }
    };

    componentDidMount() {
        document.addEventListener("mousemove", this.onMouseMove);
    }
    componentWillUnmount() {
        document.removeEventListener("mousemove", this.onMouseMove);
    }

    private readonly contextValue: DragAndDropValue = {
        maybeStartDrag: (start: ClientOffset, exprStart: ClientOffset, expr: Expr) => {
            this.drag = { start, expr, exprStart, delta: null };
        },
        addListener: (listener: DropListener) => {
            this.listeners.add(listener);
        },
        removeListener: (listener: DropListener) => {
            this.listeners.delete(listener);
        },
    };

    // layoutExpr is now memoized, save these in advance.
    exprLayoutProps: LayoutProps = { frozen: true };

    private renderExpr(theme: KaleTheme) {
        assert(this.drag?.delta != null);
        const pos = assertSome(this.state.position).add(this.drag.delta);
        const { nodes, size } = layoutExpr(theme, this.drag.expr, this.exprLayoutProps);
        return (
            <Container
                xmlns="http://www.w3.org/2000/svg"
                onMouseUp={this.dismissDrag}
                style={{
                    top: pos.y,
                    left: pos.x,
                    width: size.width,
                    height: size.height,
                }}
            >
                {nodes}
            </Container>
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
        update(point) {
            const contains = (point !== null && getRect()?.contains(point)) ?? false;
            setLastContains(contains);
        },
        drop(point, expr) {
            if (getRect()?.contains(point)) onDrop(expr);
        },
    });
    return lastContains;
}
