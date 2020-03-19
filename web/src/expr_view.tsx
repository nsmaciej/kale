import React, { PureComponent } from "react";
import { motion } from "framer-motion";

import { Optional, assert, assertSome } from "utils";
import { Offset, Rect, Size } from "geometry";
import Expr, { ExprId } from "expr";
import * as E from "expr";
import { KaleTheme, Highlight } from "theme";
import { DragAndDrop } from "drag_and_drop";
import ContextMenu, { ContextMenuItem } from "components/context_menu";

import { Area, TextProperties } from "expr_view/core";
import layoutExpr from "expr_view/layout";
import { SvgGroup, SvgRect } from "expr_view/components";

export interface ExprArea {
    inline: boolean;
    rect: Rect;
    textProps: Optional<TextProperties>;
}

// The `in` is weird here. See https://github.com/microsoft/TypeScript/issues/1778.
export type ExprAreaMap = { [expr in ExprId]: ExprArea };

function flattenArea(parent: Area): ExprAreaMap {
    const map: ExprAreaMap = {};
    function traverse(area: Area, origin: Offset) {
        map[area.expr.id] = {
            inline: area.inline,
            rect: area.rect.shift(origin),
            textProps: area.text,
        };
        for (const child of area.children) traverse(child, area.rect.origin.add(origin));
    }
    traverse(parent, Offset.zero);
    return map;
}

interface ExprViewProps {
    expr: Expr;
    theme: KaleTheme;
    exprAreaMapRef?: React.RefObject<ExprAreaMap>;

    // Callbacks.
    onClick?(expr: ExprId): void;
    onHover?(expr: Optional<ExprId>): void;
    onDoubleClick?(expr: ExprId): void;
    onClickCreateCircle?(expr: ExprId): void;
    // The expr has been focused on.
    onFocus?(): void;

    // Delegation.
    contextMenuFor?(expr: ExprId): ContextMenuItem[];

    // Looks.
    maxWidth?: number;
    scale?: number;
    frozen?: boolean;
    foldComments?: boolean;

    //TODO: Handle these in the generalised selection mechanism.
    focused?: boolean;
    highlights?: readonly [ExprId, Highlight][];
}

interface ExprViewState {
    showingMenu: Optional<{ menu: ContextMenuItem[]; at: Offset; expr: ExprId }>;
    // You can trigger this with the React Dev Tools.
    debugShowAreas: boolean;
}

// This needs to be a class component so we can nicely pass it to the layout helper.
export default class ExprView extends PureComponent<ExprViewProps, ExprViewState> {
    static contextType = DragAndDrop;
    declare context: React.ContextType<typeof DragAndDrop>;

    state: ExprViewState = { showingMenu: null, debugShowAreas: false };
    private pendingExprAreaMap: ExprAreaMap = {};

    get theme() {
        return this.props.theme;
    }

    private debugRenderAreas(areas: ExprAreaMap) {
        const exprs = Object.entries(areas).map(([k, v]) => (
            <SvgRect
                key={`e${k}`}
                rect={v.rect}
                fill="none"
                stroke={v.inline ? "blue" : "red"}
                opacity="0.7"
            />
        ));
        const texts = Object.entries(areas)
            .filter(x => x[1].textProps != null)
            .map(([k, v]) => (
                <SvgRect
                    key={`t${k}`}
                    rect={
                        new Rect(
                            v.rect.origin.add(v.textProps?.offset ?? new Offset(0)),
                            new Size(5),
                        )
                    }
                    fill="limegreen"
                    stroke="none"
                    opacity="0.7"
                />
            ));
        return exprs.concat(texts);
    }

    private drawRect(exprId: ExprId, highlight: Highlight, areas: ExprAreaMap) {
        if (areas[exprId] == null) return;
        const rect = areas[exprId].rect.padding(
            this.props.expr.id === exprId
                ? this.theme.highlight.mainPadding
                : this.theme.highlight.padding,
        );
        // Hack: Blanks draw their own highlights.
        const isBlank = this.props.expr.findId(exprId) instanceof E.Blank;
        return (
            <motion.rect
                animate={{
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                    opacity: isBlank ? 0 : 1, // +!isBlank
                }}
                key={`highlight-${highlight.name}`}
                rx={this.theme.highlight.radius}
                fill={highlight.fill(this.props.focused === true) ?? "none"}
                stroke={highlight.stroke(this.props.focused === true) ?? "none"}
                initial={false}
                strokeWidth={highlight.strokeWidth}
                transition={{ type: "tween", ease: "easeIn", duration: 0.08 }}
            />
        );
    }

    // Handler for the mousedown event.
    private onMouseDown(event: React.MouseEvent, expr: Expr) {
        assert(event.type === "mousedown");
        if (event.buttons !== 1) return;
        event.stopPropagation();
        const rect = (event.target as SVGElement).getBoundingClientRect();
        assertSome(this.context).maybeStartDrag(
            Offset.fromPage(event),
            //TODO: This only really works well for the top-left element of an expr. For example
            // this doesn't work for functions with comments on top of them, since the offset is
            // relative to the function name instead of the whole expression.
            Offset.fromBoundingRect(rect),
            this.props.frozen ? this.props.expr : expr,
        );
    }

    private onContextMenu(e: React.MouseEvent, expr: Expr) {
        if (this.props.contextMenuFor == null) return;
        e.preventDefault();
        e.stopPropagation();
        this.setState({
            showingMenu: {
                at: Offset.fromPage(e),
                menu: this.props.contextMenuFor?.(expr.id),
                expr: expr.id,
            },
        });
    }

    // Change the highlighted expr.
    private onHoverExpr(event: React.MouseEvent, expr: Optional<Expr>) {
        if (this.props.onHover != null) {
            event.stopPropagation();
            this.props.onHover(expr?.id);
        }
    }

    private readonly exprPropsFor = (expr: Expr): Partial<React.DOMAttributes<Element>> => ({
        onMouseEnter: e => this.onHoverExpr(e, expr),
        onMouseLeave: e => this.onHoverExpr(e, null),
        onContextMenu: e => this.onContextMenu(e, expr),
        onMouseDown: e => this.onMouseDown(e, expr),
        onMouseUp: e => {
            e.stopPropagation();
            assertSome(this.context).dismissDrag();
        },
        // Note we do not stopPropagation if we aren't asked to handle something.
        onDoubleClick: e => {
            if (this.props.onDoubleClick != null) {
                e.stopPropagation();
                this.props.onDoubleClick(expr.id);
            }
        },
        onClick: e => {
            if (this.props.onClick != null) {
                e.stopPropagation();
                this.props.onClick(expr.id);
            }
        },
    });

    private readonly onClickCreateCircle = (event: React.MouseEvent, expr: Expr) => {
        // Again, as above, do not stop propegation if not asked to.
        if (this.props.onClickCreateCircle != null) {
            event.stopPropagation();
            this.props.onClickCreateCircle?.(expr.id);
        }
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
        const highlights = this.props.highlights?.slice() ?? [];
        if (this.state.showingMenu != null) {
            highlights.push([this.state.showingMenu.expr, this.theme.highlight.contextMenu]);
        }

        const { nodes, size, areas, text } = layoutExpr(this.theme, this.props.expr, {
            exprPropsFor: this.exprPropsFor,
            onClickCreateCircle: this.onClickCreateCircle,
            // Passed through props.
            frozen: this.props.frozen,
            focused: this.props.focused,
            // Pass something that can be momoized if we can.
            highlights: this.state.showingMenu ? highlights : this.props.highlights,
            foldComments: this.props.foldComments,
        });

        // Selection and highlight drawing logic.
        const padding = this.props.frozen
            ? this.theme.exprView.frozenPadding
            : this.theme.exprView.padding;
        // Spooky in React's Concurrent Mode, but it's ok since we'll only use this when
        // we commit and it doesn't depend on any previous calls to render.
        this.pendingExprAreaMap = flattenArea({
            expr: this.props.expr,
            children: areas,
            rect: new Rect(padding.topLeft, size),
            inline: false,
            text,
        });

        const highlightRects = [];
        if (this.props.highlights != null) {
            for (const [exprId, highlight] of highlights) {
                highlightRects.push(this.drawRect(exprId, highlight, this.pendingExprAreaMap));
            }
        }

        const { width, height } = size.padding(padding);
        const scale = this.props.maxWidth
            ? Math.min(this.props.maxWidth ?? width, width) / width
            : this.props.scale ?? 1;
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
                    style={{ cursor: "default" }}
                >
                    {highlightRects}
                    <SvgGroup translate={padding.topLeft}>{nodes}</SvgGroup>
                    {this.state.debugShowAreas && this.debugRenderAreas(this.pendingExprAreaMap)}
                </svg>
                {this.state.showingMenu && (
                    <ContextMenu
                        items={this.state.showingMenu.menu}
                        origin={this.state.showingMenu.at}
                        dismissMenu={() => {
                            this.setState({ showingMenu: null });
                            this.props.onFocus?.();
                        }}
                    />
                )}
            </>
        );
    }
}
