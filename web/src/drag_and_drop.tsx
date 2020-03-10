import React, { Component } from "react";
import ReactDOM from "react-dom";
import styled, { ThemeConsumer } from "styled-components";

import { Optional, assertSome } from "utils";
import { Offset } from "geometry";
import Expr from "expr";

import { layoutExpr } from "expr_view/layout";
import { SvgGroup } from "expr_view/components";

interface DragAndDropSurfaceContext {
    maybeStartDrag: (start: Offset, exprStart: Offset, expr: Expr) => void;
    dismissDrag: () => void;
}

interface DragAndDropSurfaceState {
    position: Optional<Offset>;
}

export const DragAndDrop = React.createContext<Optional<DragAndDropSurfaceContext>>(null);

// There are three states to a drag.
// 1. Not dragging - drag and state.position is null.
// 2. Maybe-drag - drag is now initialised, except for delta.
// 3. Drag - Delta is now initialised, state.position follows the mouse.
export default class DragAndDropSurface extends Component<{}, DragAndDropSurfaceState> {
    static readonly Svg = styled.svg`
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
    `;
    state: DragAndDropSurfaceState = { position: null };

    private readonly contextValue: DragAndDropSurfaceContext = {
        dismissDrag: this.dismissDrag.bind(this),
        maybeStartDrag: this.maybeStartDrag.bind(this),
    };
    private drag: Optional<{
        start: Offset; // Where the maybe-drag started.
        delta: Optional<Offset>; // How much to offset the expr when showing the drag.
        exprStart: Offset; // Page space coordinates of the expr.
        expr: Expr;
    }>;

    private maybeStartDrag(start: Offset, exprStart: Offset, expr: Expr) {
        this.drag = { start, expr, exprStart, delta: null };
    }

    private dismissDrag() {
        this.drag = null;
        // Premature optimisation. This method is called on every other mouse move.
        if (this.state.position != null) this.setState({ position: null });
    }

    private readonly onMouseMove = (event: MouseEvent) => {
        // Ensure left mouse button is held down.
        if (event.buttons !== 1 || this.drag == null) {
            this.dismissDrag();
            return;
        }

        const DRAG_THRESHOLD = 4; // Based on Windows default, DragHeight registry.
        const position = Offset.fromPage(event);
        if (this.drag.delta == null) {
            // Consider starting a drag.
            if (this.drag.start.distance(position) > DRAG_THRESHOLD) {
                this.drag.delta = this.drag.exprStart.difference(position);
                this.setState({ position });
            }
        } else {
            // Update a drag.
            this.setState({ position });
        }
    };

    componentDidMount() {
        document.addEventListener("mousemove", this.onMouseMove);
    }
    componentWillUnmount() {
        document.removeEventListener("mousemove", this.onMouseMove);
    }

    renderExpr(expr: Expr) {
        return (
            <ThemeConsumer>
                {theme => layoutExpr(theme, expr, { frozen: true }).nodes}
            </ThemeConsumer>
        );
    }

    render() {
        let surface: React.ReactNode;

        if (this.drag?.delta != null) {
            const pos = assertSome(this.state.position).add(this.drag.delta);
            surface = ReactDOM.createPortal(
                <DragAndDropSurface.Svg
                    xmlns="http://www.w3.org/2000/svg"
                    onMouseUp={this.dismissDrag.bind(this)}
                >
                    <SvgGroup translate={pos}>{this.renderExpr(this.drag.expr)}</SvgGroup>
                </DragAndDropSurface.Svg>,
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
