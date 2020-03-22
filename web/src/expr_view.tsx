import React, { PureComponent } from "react";
import { motion } from "framer-motion";

import * as E from "expr";
import { DragAndDrop } from "contexts/drag_and_drop";
import { KaleTheme, Highlight } from "theme";
import { Offset, Rect, ClientOffset } from "geometry";
import { Optional, assert, assertSome } from "utils";
import ContextMenu, { ContextMenuItem } from "components/context_menu";
import Expr, { ExprId } from "expr";

import { ExprArea, ExprAreaMap, flattenArea } from "expr_view/core";
import { SvgGroup, SvgRect, DebugRect } from "expr_view/components";
import layoutExpr from "expr_view/layout";

export { ExprArea, ExprAreaMap, FlatExprArea } from "expr_view/core";

interface ExprViewProps {
    expr: Expr;
    theme: KaleTheme;
    exprAreaMapRef?: React.RefObject<ExprAreaMap>;
    exprAreaRef?: React.RefObject<ExprArea>;

    // Callbacks.
    onClick?(expr: ExprId): void;
    onHover?(expr: Optional<ExprId>): void;
    onDoubleClick?(expr: ExprId): void;
    /** Triggered when an expr has been dragged out using drag-and-drop. */
    onDraggedOut?(expr: ExprId): void;
    /** Triggered when expr has been focused on, used after dismissing a context menu */
    onFocus?(): void;

    // Delegation.
    contextMenuFor?(expr: ExprId): ContextMenuItem[];

    // Looks.
    maxWidth?: number;
    scale?: number;
    /** Is this an atomic expr whose children cannot be dragged out and should be given a new id
     * when dragged? */
    frozen?: boolean;
    foldComments?: boolean;
    showDebugOverlay?: boolean;

    //TODO: Handle these in the generalised selection mechanism.
    focused?: boolean;
    highlights?: readonly [ExprId, Highlight][];
}

interface ExprViewState {
    showingMenu: Optional<{ menu: ContextMenuItem[]; at: ClientOffset; expr: ExprId }>;
}

// This needs to be a class component so we can nicely pass it to the layout helper.
export default class ExprView extends PureComponent<ExprViewProps, ExprViewState> {
    static contextType = DragAndDrop;
    declare context: React.ContextType<typeof DragAndDrop>;

    state: ExprViewState = { showingMenu: null };
    private readonly containerRef = React.createRef<SVGSVGElement>();
    private pendingExprAreaMap: ExprAreaMap | null = null;
    private pendingExprArea: ExprArea | null = null;

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
            .filter(x => x[1].text != null)
            .map(([k, v]) => (
                <DebugRect
                    key={`t${k}`}
                    origin={v.rect.origin.add(v.text?.offset ?? Offset.zero)}
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
                style={{ filter: highlight.droppable ? "url(#droppable)" : undefined }}
                transition={{
                    type: "tween",
                    ease: "easeIn",
                    duration: highlight.animates ? 0.08 : 0,
                }}
            />
        );
    }

    // Handler for the mousedown event.
    private onMouseDown(event: React.MouseEvent, expr: Expr) {
        assert(event.type === "mousedown");
        if (
            event.buttons !== 1 ||
            this.pendingExprAreaMap === null ||
            this.containerRef.current === null
        ) {
            return;
        }

        event.stopPropagation();
        const containerOrigin = ClientOffset.fromBoundingRect(
            this.containerRef.current?.getBoundingClientRect(),
        );
        // Frozen expressions drag everything.
        const dragExpr = this.props.frozen ? this.props.expr : expr;
        assertSome(this.context).maybeStartDrag(
            ClientOffset.fromClient(event),
            this.pendingExprAreaMap[dragExpr.id].rect.origin.add(containerOrigin),
            this.props.frozen ? dragExpr.resetIds() : dragExpr,
            () => this.props.onDraggedOut?.(dragExpr.id),
        );
    }

    private onContextMenu(e: React.MouseEvent, expr: Expr) {
        if (this.props.contextMenuFor == null) return;
        e.preventDefault();
        e.stopPropagation();
        this.setState({
            showingMenu: {
                at: ClientOffset.fromClient(e),
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

    private updateExprAreaMapRef() {
        if (this.props.exprAreaMapRef !== undefined && this.pendingExprAreaMap !== null) {
            // See https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31065
            // As far as I can see React's users are free to modify .current, but the typings do not
            // respect that.
            (this.props.exprAreaMapRef as React.MutableRefObject<
                ExprAreaMap
            >).current = this.pendingExprAreaMap;
        }
        if (this.props.exprAreaRef !== undefined && this.pendingExprArea !== null) {
            (this.props.exprAreaRef as React.MutableRefObject<
                ExprArea
            >).current = this.pendingExprArea;
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
            // Passed through props.
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
        this.pendingExprArea = {
            expr: this.props.expr,
            children: areas,
            rect: new Rect(padding.topLeft, size),
            inline: false,
            text,
        };
        this.pendingExprAreaMap = flattenArea(this.pendingExprArea);

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
                    ref={this.containerRef}
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
                    <filter id="droppable">
                        <feDropShadow
                            dx="0"
                            dy="0"
                            stdDeviation={this.theme.droppable.radius / 2}
                            floodColor={this.theme.droppable.colour}
                        />
                    </filter>
                    {highlightRects}
                    <SvgGroup translate={padding.topLeft}>{nodes}</SvgGroup>
                    {this.props.showDebugOverlay && this.debugRenderAreas(this.pendingExprAreaMap)}
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
