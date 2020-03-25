import React, { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useTheme } from "styled-components";

import * as E from "expr";
import { Highlight } from "theme";
import { Rect, ClientOffset } from "geometry";
import DragAndDrop from "contexts/drag_and_drop";
import Expr, { ExprId } from "expr";
import { useContextChecked } from "hooks";

import ContextMenu, { ContextMenuItem } from "components/context_menu";
import SvgDebugOverlay from "components/debug_overlay";

import { ExprArea, ExprAreaMap, flattenArea } from "expr_view/core";
import { SvgGroup } from "expr_view/components";
import layoutExpr from "expr_view/layout";

export { ExprArea, ExprAreaMap, FlatExprArea } from "expr_view/core";

interface ExprViewProps {
    expr: Expr;
    exprAreaMapRef?: MutableRefObject<ExprAreaMap | null>;
    exprAreaRef?: MutableRefObject<ExprArea | null>;

    // Callbacks.
    onClick?(expr: ExprId): void;
    onHover?(expr: ExprId | null): void;
    onDoubleClick?(expr: ExprId): void;
    /** Triggered when an expr has been dragged out using drag-and-drop. */
    onDraggedOut?(expr: ExprId): void;
    /** Triggered when expr has been focused on, used after dismissing a context menu */
    onFocus?(): void;

    // Delegation.
    onContextMenu?(expr: ExprId): ContextMenuItem[];

    // Looks.
    width?: number;
    scale?: number;
    /** Is this an atomic expr whose children cannot be dragged out and should be given a new id
     * when dragged? */
    frozen?: boolean;
    foldComments?: boolean;
    showDebugOverlay?: boolean;

    focused?: boolean;
    highlights?: readonly [ExprId, Highlight][];
}

interface ExprMenuState {
    menu: ContextMenuItem[];
    at: ClientOffset;
    expr: ExprId;
}

//TODO: Make a functional component.
export default React.memo(function ExprView(props: ExprViewProps) {
    const theme = useTheme();
    const dnd = useContextChecked(DragAndDrop);
    const [showingMenu, setShowingMenu] = useState<ExprMenuState | null>(null);

    const containerRef = useRef<SVGSVGElement>(null);
    const pendingExprAreaMap = useRef(null as ExprAreaMap | null);
    const pendingExprArea = useRef(null as ExprArea | null);

    // useMemo needed because this is a useCallbackp dependency.
    const padding = useMemo(
        () => (props.frozen ? theme.exprView.frozenPadding : theme.exprView.padding),
        [props.frozen, theme],
    );

    function drawRect(exprId: ExprId, highlight: Highlight, areas: ExprAreaMap) {
        if (areas[exprId] == null) return;
        const rect = areas[exprId].rect.padding(
            props.expr.id === exprId ? theme.highlight.mainPadding : theme.highlight.padding,
        );
        // Hack: Blanks draw their own highlights.
        const isBlank = props.expr.findId(exprId) instanceof E.Blank;
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
                rx={theme.highlight.radius}
                fill={highlight.fill(props.focused === true) ?? "none"}
                stroke={highlight.stroke(props.focused === true) ?? "none"}
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

    const { frozen, expr, onDoubleClick, onClick, onHover, onDraggedOut, onContextMenu } = props;
    // Change the highlighted expr.
    const exprPropsFor = useCallback(
        (childExpr: Expr): Partial<React.DOMAttributes<Element>> => {
            /** Prevents default and calls `fn` with `arg` if `fn` is provided, nop otherwise. */
            function trigger<T>(fn: ((arg: T) => void) | undefined, arg: T, e: React.MouseEvent) {
                if (fn !== undefined) {
                    e.preventDefault();
                    fn(arg);
                }
            }
            return {
                onDoubleClick(event) {
                    trigger(onDoubleClick, childExpr.id, event);
                },
                onClick(event) {
                    trigger(onClick, childExpr.id, event);
                },
                onMouseEnter(event: React.MouseEvent) {
                    trigger(onHover, childExpr.id, event);
                },
                onMouseLeave(event: React.MouseEvent) {
                    trigger(onHover, null, event);
                },
                onMouseDown(event) {
                    if (event.buttons !== 1) return;
                    event.stopPropagation();
                    if (pendingExprAreaMap.current === null || containerRef.current === null) {
                        return;
                    }

                    // Frozen expressions drag everything.
                    const dragExpr = frozen ? expr : childExpr;
                    const containerOrigin = ClientOffset.fromBoundingRect(
                        containerRef.current.getBoundingClientRect(),
                    );
                    const exprOrigin = pendingExprAreaMap.current[dragExpr.id].rect.origin;
                    dnd.maybeStartDrag(
                        ClientOffset.fromClient(event),
                        exprOrigin.offset(containerOrigin).offset(padding.topLeft.neg),
                        frozen ? dragExpr.resetIds() : dragExpr,
                        () => onDraggedOut?.(dragExpr.id),
                    );
                },
                onContextMenu(event) {
                    if (onContextMenu === undefined) return;
                    event.preventDefault();
                    event.stopPropagation();
                    const menu = onContextMenu(childExpr.id);
                    if (menu.length > 0) {
                        setShowingMenu({
                            at: ClientOffset.fromClient(event),
                            menu: onContextMenu?.(childExpr.id),
                            expr: childExpr.id,
                        });
                    }
                },
            };
        },
        [dnd, expr, frozen, onClick, onContextMenu, onDoubleClick, onDraggedOut, onHover, padding],
    );

    useEffect(() => {
        if (props.exprAreaMapRef !== undefined && pendingExprAreaMap.current !== null) {
            props.exprAreaMapRef.current = pendingExprAreaMap.current;
        }
        if (props.exprAreaRef !== undefined && pendingExprArea.current !== null) {
            props.exprAreaRef.current = pendingExprArea.current;
        }
    });

    const highlights = props.highlights?.slice() ?? [];
    if (showingMenu != null) {
        highlights.push([showingMenu.expr, theme.highlight.contextMenu]);
    }

    const { nodes, size, areas, text } = layoutExpr(theme, props.expr, {
        exprPropsFor,
        focused: props.focused,
        // Pass something that can be momoized if we can.
        highlights: showingMenu ? highlights : props.highlights,
        foldComments: props.foldComments,
    });

    // Spooky in React's Concurrent Mode, but it's ok since we'll only use this when
    // we commit and it doesn't depend on any previous calls to render.
    pendingExprArea.current = {
        expr: props.expr,
        children: areas,
        rect: new Rect(padding.topLeft, size),
        inline: false,
        text,
    };
    pendingExprAreaMap.current = flattenArea(pendingExprArea.current);

    const highlightRects = [];
    if (props.highlights != null) {
        for (const [exprId, highlight] of highlights) {
            highlightRects.push(drawRect(exprId, highlight, pendingExprAreaMap.current));
        }
    }

    const { width, height } = size.padding(padding);
    let scale = props.scale ?? 1;
    if (props.width !== undefined) {
        // Note this already includes the padding.
        scale = Math.min(props.width, width * scale) / width;
    }
    return (
        <>
            <svg
                xmlns="http://www.w3.org/2000/svg"
                ref={containerRef}
                width={width * scale}
                height={height * scale}
                // SVGs are inline by default, this leads to a scourge of invisible space
                // characters. Make it a block instead.
                display="block"
                viewBox={`0 0 ${width} ${height}`}
                // If we can open context menus, do not allow the system menu.
                onContextMenu={(e) => props.onContextMenu && e.preventDefault()}
                style={{ cursor: "default" }}
            >
                {highlightRects}
                <SvgGroup translate={padding.topLeft}>{nodes}</SvgGroup>
                {props.showDebugOverlay && <SvgDebugOverlay areaMap={pendingExprAreaMap.current} />}
            </svg>
            {showingMenu && (
                <ContextMenu
                    items={showingMenu.menu}
                    origin={showingMenu.at}
                    onDismissMenu={() => {
                        setShowingMenu(null);
                        props.onFocus?.();
                    }}
                />
            )}
        </>
    );
});
