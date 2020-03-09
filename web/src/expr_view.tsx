import React, { PureComponent } from "react";
import { motion } from "framer-motion";

import { Optional, assert, assertSome } from "utils";
import { Vec, Rect } from "geometry";
import Expr, { ExprId } from "expr";
import * as E from "expr";
import { KaleTheme } from "theme";
import { DragAndDrop } from "drag_and_drop";
import ContextMenu, { ContextMenuItem } from "components/context_menu";

import { Area } from "expr_view/core";
import { layoutExpr } from "expr_view/layout";
import { SvgGroup } from "expr_view/components";

// The `in` is weird here. See https://github.com/microsoft/TypeScript/issues/1778.
export type ExprAreaMap = { [expr in ExprId]: { inline: boolean; rect: Rect } };

function flattenArea(parent: Area): ExprAreaMap {
    const map: ExprAreaMap = {};
    function traverse(area: Area, origin: Vec) {
        map[area.expr.id] = { inline: area.inline, rect: area.rect.shift(origin) };
        for (const child of area.children) traverse(child, area.rect.origin.add(origin));
    }
    traverse(parent, Vec.zero);
    return map;
}

interface ExprViewProps {
    expr: Expr;
    theme: KaleTheme;
    exprAreaMapRef?: React.RefObject<ExprAreaMap>;

    // Callbacks.
    onClick?: (expr: ExprId) => void;
    onClickCreateCircle?: (expr: ExprId) => void;

    // Delegation.
    contextMenuFor?: (expr: ExprId) => ContextMenuItem[];

    // Looks.
    maxWidth?: number;
    frozen?: boolean;
    foldComments?: boolean;

    //TODO: Handle these in the generalised selection mechanism.
    focused?: boolean;
    selection?: Optional<ExprId>;
}

interface ExprViewState {
    highlight: Optional<ExprId>;
    showingMenu: Optional<{ menu: ContextMenuItem[]; at: Vec }>;
}

// This needs to be a class component so we can nicely pass it to the layout helper.
export default class ExprView extends PureComponent<ExprViewProps, ExprViewState> {
    static contextType = DragAndDrop;
    declare context: React.ContextType<typeof DragAndDrop>;

    state: ExprViewState = { highlight: null, showingMenu: null };
    // This is computed during the render phase, we only call the onExprAreaMap once
    // we are mounted or updated.
    pendingExprAreaMap: ExprAreaMap = {};

    get theme() {
        return this.props.theme;
    }

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
        if (!this.props.frozen) this.setState({ highlight: expr?.id });
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

    private drawRect(expr: Optional<ExprId>, isSelection: boolean, areas: ExprAreaMap) {
        if (expr == null) return;
        if (!isSelection && !this.props.focused) return;
        const rect = assertSome(areas[expr].rect).pad(this.theme.selection.paddingPx);

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
                rx={this.theme.selection.radiusPx}
                fill={
                    isSelection
                        ? this.props.focused
                            ? this.theme.selection.fill
                            : this.theme.selection.blurredFill
                        : "none"
                }
                initial={false}
                stroke={
                    isSelection
                        ? this.props.focused
                            ? this.theme.selection.stroke
                            : this.theme.selection.blurredStroke
                        : this.theme.highlightStroke
                }
                strokeWidth={0.5}
                transition={{ type: "tween", ease: "easeIn", duration: 0.1 }}
            />
        );
    }

    onContextMenu = (e: React.MouseEvent, expr: Expr) => {
        if (this.props.contextMenuFor == null) return;
        e.preventDefault();
        e.stopPropagation();
        this.setState({
            showingMenu: {
                at: Vec.fromPage(e),
                menu: this.props.contextMenuFor?.(expr.id),
            },
        });
    };

    private updateExprAreaMapRef() {
        if (this.props.exprAreaMapRef) {
            // See https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31065
            // As far as I can see React's users are free to modify .current, but the typings do not
            // respect that.
            (this.props.exprAreaMapRef as React.MutableRefObject<
                ExprAreaMap
            >).current = this.pendingExprAreaMap;
        }
    }

    componentDidMount() {
        this.updateExprAreaMapRef();
    }
    componentDidUpdate() {
        this.updateExprAreaMapRef();
    }

    render() {
        //TODO: Remove these binds.
        const { nodes, size, areas } = layoutExpr(this.theme, this.props.expr, {
            frozen: this.props.frozen,
            focused: this.props.focused,
            selection: this.props.selection,
            foldComments: this.props.foldComments,
            onHoverExpr: this.onHoverExpr.bind(this),
            onClickCreateCircle: this.onClickCreateCircle.bind(this),
            onClickExpr: this.onClickExpr.bind(this),
            onMouseDown: this.onMouseDown.bind(this),
            onContextMenu: this.onContextMenu,
        });

        // Selection and highlight drawing logic.
        const padding = new Vec(this.theme.exprViewPaddingPx);
        // Spooky in React's Concurrent Mode, but it's ok since we'll only use this when
        // we commit and it doesn't depend on any previous calls to render.
        this.pendingExprAreaMap = flattenArea({
            expr: this.props.expr,
            children: areas,
            rect: new Rect(padding, size),
            inline: false,
        });

        // Note: A similar check has to be perfomed in expr_layout for blanks.
        const highlight = this.props.frozen ? null : this.state.highlight;
        const selection = this.props.selection;
        const highlightRect = this.drawRect(highlight, false, this.pendingExprAreaMap);
        const selectionRect = this.drawRect(selection, true, this.pendingExprAreaMap);
        const layers = this.props.expr.withId(highlight)?.contains(selection)
            ? [highlightRect, selectionRect]
            : [selectionRect, highlightRect];

        const { width, height } = size.pad(padding.scale(2));
        const scale = Math.min(this.props.maxWidth ?? width, width) / width;
        return (
            <>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width={width * scale}
                    height={height * scale}
                    // SVGs are inline by default, this leads to a scourge of invisible space
                    // characters. Make it a block instead.
                    display="block"
                    viewBox={`0 0 ${width} ${height}`}
                    // If we can open context menus, do not allow the system menu.
                    onContextMenu={e => this.props.contextMenuFor && e.preventDefault()}
                >
                    {layers}
                    <SvgGroup translate={padding}>{nodes}</SvgGroup>
                </svg>
                {this.state.showingMenu && (
                    <ContextMenu
                        items={this.state.showingMenu.menu}
                        origin={this.state.showingMenu.at}
                        dismissMenu={() => this.setState({ showingMenu: null })}
                    />
                )}
            </>
        );
    }
}
