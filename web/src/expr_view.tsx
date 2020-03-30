import { motion } from "framer-motion";
import React, { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled, { useTheme } from "styled-components";

import * as E from "expr";
import { Highlight } from "theme";
import { Rect, ClientOffset, Padding } from "geometry";
import { useContextChecked } from "hooks";
import DragAndDrop from "contexts/drag_and_drop";
import Expr, { ExprId } from "expr";

import ContextMenu, { ContextMenuItem } from "components/context_menu";
import SvgDebugOverlay from "components/debug_overlay";

import { ExprArea, ExprAreaMap, flattenArea } from "expr_view/core";
import { SvgGroup } from "expr_view/components";
import layoutExpr from "expr_view/layout";

export { ExprArea, ExprAreaMap, FlatExprArea } from "expr_view/core";

const Container = styled.svg`
    max-width: 100%;
    height: auto;
    /* SVGs are inline by default, this leads to a scourge of invisible space characters. Make it a
    block instead. */
    display: block;
    touch-action: pinch-zoom;
`;

interface ExprViewProps {
    expr: Expr;
    exprAreaMapRef?: MutableRefObject<ExprAreaMap | null>;
    exprAreaRef?: MutableRefObject<ExprArea | null>;

    // Callbacks.
    onClick?(expr: ExprId): void;
    onHover?(expr: ExprId | null): void;
    onDoubleClick?(expr: ExprId): void;
    onMiddleClick?(expr: ExprId): void;
    /** Triggered when an expr has been dragged out using drag-and-drop. */
    onDraggedOut?(expr: ExprId): void;
    /** Triggered when expr has been focused on, used after dismissing a context menu */
    onFocus?(): void;

    // Delegation.
    onContextMenu?(expr: ExprId): ContextMenuItem[];

    // Looks.
    padding?: Padding;
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
    const [ghost, setGhost] = useState<ExprId | null>(null);

    const containerRef = useRef<SVGSVGElement>(null);
    const pendingExprAreaMap = useRef(null as ExprAreaMap | null);
    const pendingExprArea = useRef(null as ExprArea | null);

    // useMemo needed because this is a useCallbackp dependency.
    const padding = useMemo(
        () =>
            (props.frozen ? theme.exprView.frozenPadding : theme.exprView.padding).combine(
                props.padding ?? Padding.zero,
            ),
        [props.frozen, props.padding, theme],
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

    const {
        frozen,
        expr,
        onDoubleClick,
        onClick,
        onMiddleClick,
        onHover,
        onDraggedOut,
        onContextMenu,
    } = props;
    // Change the highlighted expr.
    const exprPropsFor = useCallback(
        (childExpr: Expr): Partial<React.DOMAttributes<Element>> => {
            function trigger<T>(fn: ((arg: T) => void) | undefined, arg: T, e: React.MouseEvent) {
                e.preventDefault();
                if (fn !== undefined) {
                    e.stopPropagation();
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
                onPointerDown(event) {
                    if (event.button === 1) {
                        trigger(onMiddleClick, childExpr.id, event);
                        return;
                    }
                    // Only allow the left mouse button below.
                    if (event.button !== 0) return;
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
                    dnd.maybeStartDrag({
                        expr: frozen ? dragExpr.resetIds() : dragExpr,
                        start: ClientOffset.fromClient(event),
                        exprStart: exprOrigin.offset(containerOrigin).offset(padding.topLeft.neg),
                        onDragAccepted() {
                            onDraggedOut?.(dragExpr.id);
                        },
                        onDragUpdate(willMove) {
                            setGhost(willMove && !frozen ? dragExpr.id : null);
                        },
                        onDragEnd() {
                            setGhost(null);
                        },
                    });
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
        [
            dnd,
            expr,
            frozen,
            onClick,
            onContextMenu,
            onDoubleClick,
            onMiddleClick,
            onDraggedOut,
            onHover,
            padding,
        ],
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
        transparent: ghost,
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
    const scale = props.scale ?? 1;
    return (
        <>
            <Container
                xmlns="http://www.w3.org/2000/svg"
                ref={containerRef}
                width={width * scale}
                height={height * scale}
                viewBox={`0 0 ${width} ${height}`}
                // If we can open context menus, do not allow the system menu.
                onContextMenu={(e) => props.onContextMenu && e.preventDefault()}
            >
                {highlightRects}
                <SvgGroup translate={padding.topLeft}>{nodes}</SvgGroup>
                {props.showDebugOverlay && <SvgDebugOverlay areaMap={pendingExprAreaMap.current} />}
            </Container>
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
