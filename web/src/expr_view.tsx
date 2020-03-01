import React, { PureComponent, Component } from "react";
import ReactDOM from "react-dom";
import styled from "styled-components";
import { motion } from "framer-motion";

import { Optional, assert, assertSome } from "utils";
import { Vec, Rect } from "geometry";
import Expr, { ExprId } from "expr";
import * as E from "expr";
import THEME from "theme";

import { Area } from "expr_view/core";
import { ExprLayout, materialiseUnderlines, ExprDelegate } from "expr_view/layout";
import { SvgGroup } from "expr_view/components";

interface DragAndDropSurfaceContext {
    maybeStartDrag: (start: Vec, exprStart: Vec, expr: Expr) => void;
    dismissDrag: () => void;
}

interface DragAndDropSurfaceState {
    position: Optional<Vec>;
}

// There are three states to a drag.
// 1. Not dragging - drag and state.position is null.
// 2. Maybe-drag - drag is now initialised, except for delta.
// 3. Drag - Delta is now initialised, state.position follows the mouse.
export class DragAndDropSurface extends Component<{}, DragAndDropSurfaceState> {
    static readonly Svg = styled.svg`
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
    `;
    state: DragAndDropSurfaceState = { position: null };

    static readonly Context = React.createContext<Optional<DragAndDropSurfaceContext>>(null);

    private contextValue: DragAndDropSurfaceContext = {
        dismissDrag: this.dismissDrag.bind(this),
        maybeStartDrag: this.maybeStartDrag.bind(this),
    };
    private drag: Optional<{
        start: Vec; // Where the maybe-drag started.
        delta: Optional<Vec>; // How much to offset the expr when showing the drag.
        exprStart: Vec; // Page space coordinates of the expr.
        expr: Expr;
    }>;

    private maybeStartDrag(start: Vec, exprStart: Vec, expr: Expr) {
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
        const position = Vec.fromPage(event);
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

    render() {
        let surface: React.ReactNode;

        if (this.drag?.delta != null) {
            // drag.delta gets set when the drag starts proper.
            const pos = assertSome(this.state.position).add(this.drag.delta);
            const { nodes } = new ExprLayout({
                isFrozen: () => true,
            }).layout(this.drag.expr);
            surface = ReactDOM.createPortal(
                <DragAndDropSurface.Svg
                    xmlns="http://www.w3.org/2000/svg"
                    onMouseUp={this.dismissDrag.bind(this)}
                >
                    <SvgGroup translate={pos}>{nodes}</SvgGroup>
                </DragAndDropSurface.Svg>,
                document.body,
            );
        }

        return (
            <DragAndDropSurface.Context.Provider value={this.contextValue}>
                {surface}
                {this.props.children}
            </DragAndDropSurface.Context.Provider>
        );
    }
}

interface ExprViewProps {
    expr: Expr;
    frozen?: boolean;
    focused?: boolean;
    selection?: Optional<ExprId>;
    foldComments?: boolean;
    onClick?: (expr: ExprId) => void;
    onClickCreateCircle?: (expr: ExprId) => void;
}

interface ExprViewState {
    highlight: Optional<ExprId>;
    // animatingSelection: boolean;
}

// This needs to be a class component so we can nicely pass it to the layout helper.
export default class ExprView extends PureComponent<ExprViewProps, ExprViewState>
    implements ExprDelegate {
    static contextType = DragAndDropSurface.Context;
    declare context: React.ContextType<typeof DragAndDropSurface.Context>;

    state: ExprViewState = { highlight: null };

    // Generic click action passed on using the props.
    onClickExpr(event: React.MouseEvent, expr: Expr) {
        event.stopPropagation();
        assertSome(this.context).dismissDrag();
        this.props.onClick?.(expr.id);
    }

    onClickCreateCircle(event: React.MouseEvent, expr: Expr) {
        //TODO: Might make sense to have a better delegation mechanism.
        event.stopPropagation();
        this.props.onClickCreateCircle?.(expr.id);
    }

    // Chang the highlighted expr.
    onHoverExpr(event: React.MouseEvent, expr: Optional<Expr>) {
        event.stopPropagation();
        this.setState({ highlight: expr?.id });
    }

    // Handler for the mousedown event.
    onMouseDown(event: React.MouseEvent, expr: Expr) {
        assert(event.type === "mousedown");
        if (event.buttons !== 1) return;
        event.stopPropagation();
        const rect = (event.target as SVGElement).getBoundingClientRect();
        assertSome(this.context).maybeStartDrag(
            Vec.fromPage(event),
            //TODO: This only really works well for the top-left element of an expr. For example
            // this doesn't work for functions with comments on top of them, since the offset is
            // relative to the function name instead of the whole expression.
            Vec.fromBoundingRect(rect),
            this.props.frozen ? this.props.expr : expr,
        );
    }

    isFrozen(_expr: Expr) {
        return this.props.frozen ?? false;
    }

    get selection() {
        return this.props.selection;
    }
    get focused() {
        return this.props.focused;
    }
    get foldComments() {
        return this.props.foldComments;
    }

    private findExprRect(expr: ExprId, area: Area): Optional<Rect> {
        if (area.expr.id === expr) return area.rect;
        for (const child of area.children) {
            const rect = this.findExprRect(expr, child);
            if (rect != null) return rect.shift(area.rect.origin);
        }
        return null;
    }

    private readonly stopPropagation = (e: React.SyntheticEvent) => {
        e.stopPropagation();
    };

    private drawRect(expr: Optional<ExprId>, isSelection: boolean, area: Area) {
        if (expr == null) return;
        if (!isSelection && !this.props.focused) return;

        const rect = this.findExprRect(expr, area)?.pad(THEME.selection.paddingPx);
        if (rect == null) return; // This happens when an expression is removed.

        const isHole = this.props.expr.withId(expr) instanceof E.Blank;
        return (
            <motion.rect
                animate={{
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                    opacity: isHole ? 0 : 1, // +!isHole
                }}
                key={+isSelection}
                rx={THEME.selection.radiusPx}
                fill={
                    isSelection
                        ? this.props.focused
                            ? THEME.selection.fill
                            : THEME.selection.blurredFill
                        : "none"
                }
                initial={false}
                // Clicking on the selection doesn't pass through.
                onClick={this.stopPropagation}
                stroke={
                    isSelection
                        ? this.props.focused
                            ? THEME.selection.stroke
                            : THEME.selection.blurredStroke
                        : THEME.highlightStrokeColour
                }
                strokeWidth={0.5}
                transition={{ type: "tween", ease: "easeIn", duration: 0.1 }}
            />
        );
    }

    render() {
        const { nodes, size, areas, inlineExprs } = materialiseUnderlines(
            new ExprLayout(this).layout(this.props.expr),
        );

        // Selection and highlight drawing logic.
        const padding = new Vec(THEME.exprViewPaddingPx);
        const area = {
            expr: this.props.expr,
            children: areas,
            rect: new Rect(padding, size),
        };

        // Note: A similar check has to be perfomed in expr_layout for blanks.
        const highlight = this.props.frozen ? null : this.state.highlight;
        const selection = this.props.selection;
        const highlightRect = this.drawRect(highlight, false, area);
        const selectionRect = this.drawRect(selection, true, area);
        const layers = this.props.expr.withId(highlight)?.contains(selection)
            ? [highlightRect, selectionRect]
            : [selectionRect, highlightRect];

        const { width, height } = size.pad(padding.scale(2));
        return (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width={width}
                height={height}
                // SVGs are inline by default, this leads to a scourge of invisible space
                // characters. Make it a block instead.
                display="block"
            >
                {layers}
                <SvgGroup translate={padding}>{nodes}</SvgGroup>
            </svg>
        );
    }
}
