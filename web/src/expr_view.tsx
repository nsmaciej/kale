import { motion } from "framer-motion";
import React, { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled, { useTheme } from "styled-components";

import * as E from "expr";
import { Highlight } from "theme";
import { Rect, ClientOffset, Padding, Offset } from "geometry";
import { useContextChecked, useDrop } from "hooks";
import DragAndDrop from "contexts/drag_and_drop";
import Expr, { ExprId } from "expr";

import ContextMenu, { ContextMenuItem } from "components/context_menu";
import SvgDebugOverlay from "components/debug_overlay";

import { ExprArea, ExprAreaMap, flattenArea, Area } from "expr_view/core";
import { SvgGroup, SvgRect } from "expr_view/components";
import layoutExpr from "expr_view/layout";

export { ExprAreaMap, FlatExprArea } from "expr_view/core";

const Container = styled.svg`
    max-width: 100%;
    height: auto;
    /* SVGs are inline by default, this leads to a scourge of invisible space characters. Make it a
    block instead. */
    display: block;
    touch-action: pinch-zoom;
`;

export type OnDropMode = "replace" | "child" | "sibling";

interface ExprViewProps {
    /** The expr to display. */
    expr: Expr;
    /** A ref to a map containg the rendering status of all shown exprs. */
    exprAreaMapRef?: MutableRefObject<ExprAreaMap | null>;

    // Generic callbacks.
    onClick?(expr: ExprId): void;
    onHover?(expr: ExprId | null): void;
    onDoubleClick?(expr: ExprId): void;
    onMiddleClick?(expr: ExprId): void;

    // Drag and Drop.
    /** Triggered when an expr has been dragged out. See `immutable`. */
    onDraggedOut?(expr: ExprId): void;
    /** Called when a drag has been acepted and `at` shuould be replaced with `expr`. */
    onDrop?(mode: OnDropMode, at: ExprId, expr: Expr): void;
    /** When initiating a drag, should the expr appearance indicate a pending deletion or not (using
     * the ghosting effect) */
    persistent?: boolean;
    /** When initiating a drag, should constituent exprs be draggable, or the entire expr. */
    atomic?: boolean;
    /** When acccepting a drop, should the expr highlight to indicate that drops are accepted. When
     * the acceptance stage is run, should `onDropped` ever be called */
    immutable?: boolean;

    // Delegation.
    /** Called when the context menu is invoked. */
    onContextMenu?(expr: ExprId): ContextMenuItem[];
    /** Triggered when expr has been focused on, used after dismissing a context menu */
    onFocus?(): void;

    // Looks.
    padding?: Padding;
    /** Scale at which the expr should be shown. 1 means do not scale. */
    scale?: number;
    /** Should comments be hidden and replaced with a comment indicator. */
    foldComments?: boolean;
    /** Should a special debug overlay be shown over this view. */
    showDebugOverlay?: boolean;
    /** Use the alternative wide main expr padding. */
    widePadding?: boolean;

    /** Should the ExprView use the focused appearance for its highlights. */
    focused?: boolean;
    /** Highlights to use, note only the last highlight for a given ExprId ever gets used. */
    highlights?: readonly [ExprId, Highlight][];
}

interface ExprMenuState {
    menu: ContextMenuItem[];
    at: ClientOffset;
    expr: ExprId;
}

export default React.memo(function ExprView({
    atomic,
    expr,
    exprAreaMapRef,
    focused,
    foldComments,
    highlights,
    immutable,
    onClick,
    onContextMenu,
    onDoubleClick,
    onDraggedOut,
    onDrop,
    onFocus,
    onHover,
    onMiddleClick,
    padding,
    persistent,
    scale,
    showDebugOverlay,
    widePadding,
}: ExprViewProps) {
    const theme = useTheme();
    const dnd = useContextChecked(DragAndDrop);
    const [showingMenu, setShowingMenu] = useState<ExprMenuState | null>(null);
    const [ghost, setGhost] = useState<ExprId | null>(null);
    const [droppable, setDroppable] = useState<ExprId | null>(null);
    const [dropIndicator, setDropIndicator] = useState<Rect | null>(null);

    const containerRef = useRef<SVGSVGElement>(null);
    const pendingExprAreaMap = useRef(null as ExprAreaMap | null);
    const lastExprArea = useRef(null as ExprArea | null);

    // useMemo needed because this is a useCallbackp dependency.
    const finalPadding = useMemo(
        () =>
            (widePadding ? theme.exprView.padding : theme.exprView.widePadding).combine(
                padding ?? Padding.zero,
            ),
        [widePadding, padding, theme],
    );

    useDrop({
        dragUpdate(absolutePoint, draggedExpr) {
            if (immutable) return false;
            const area = clientOffsetToArea(absolutePoint);
            if (area === null || draggedExpr?.contains(area.expr.id)) {
                // Do not even hint we support nesting.
                setDroppable(null);
                setDropIndicator(null);
                return;
            }
            // Note these cannot be combined because blanks draw their own droppable highlight.
            if (area.kind === "gap") {
                // Careful, area.rec is a fresh reference each time, only re-render if it's
                // _actually_ different.
                setDropIndicator((old) => (old?.equals(area.rect) ? old : area.rect));
                setDroppable(null);
            } else {
                setDropIndicator(null);
                setDroppable(area.expr.id);
            }
        },
        acceptDrop(absolutePoint, draggedExpr) {
            if (immutable) return false;
            const area = clientOffsetToArea(absolutePoint);
            if (area === null) return false;
            // Reject nesting.
            //TODO: This very fugly and relies on the id of the draggd expr, replace it with some
            // sort of indication of the dragged-expr origin.
            if (draggedExpr.contains(area.expr.id)) return false;
            onDrop?.(area.kind === "gap" ? area.mode : "replace", area.expr.id, draggedExpr);
            return true;
        },
    });

    function clientOffsetToArea(absolutePoint: ClientOffset | null): Area | null {
        if (containerRef.current === null || lastExprArea.current === null) {
            return null;
        }
        const editorRect = Rect.fromBoundingRect(containerRef.current.getBoundingClientRect());
        if (absolutePoint === null || !editorRect.contains(absolutePoint)) {
            return null;
        }

        // Find the drop target. Keep in mind each nested area is offset relative to its parent.
        const point = absolutePoint.difference(editorRect.origin);
        let currentArea = lastExprArea.current;
        let areaStart = Offset.zero;
        main: for (;;) {
            for (const subArea of currentArea.children) {
                if (subArea.kind === "gap") {
                    if (subArea.rect.shift(areaStart).contains(point)) {
                        return { ...subArea, rect: subArea.rect.shift(areaStart) };
                    }
                } else {
                    if (subArea.rect.shift(areaStart).contains(point)) {
                        currentArea = subArea;
                        areaStart = areaStart.offset(subArea.rect.origin);
                        continue main;
                    }
                }
            }
            break;
        }
        return currentArea;
    }

    function drawRect(exprId: ExprId, highlight: Highlight, areas: ExprAreaMap) {
        if (areas[exprId] == null) return;
        const rect = areas[exprId].rect.padding(
            expr.id === exprId ? theme.highlight.mainPadding : theme.highlight.padding,
        );
        // Hack: Blanks draw their own highlights.
        const isBlank = expr.findId(exprId) instanceof E.Blank;
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
                fill={highlight.fill(focused === true) ?? "none"}
                stroke={highlight.stroke(focused === true) ?? "none"}
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
                    const dragExpr = atomic ? expr : childExpr;
                    const containerOrigin = ClientOffset.fromBoundingRect(
                        containerRef.current.getBoundingClientRect(),
                    );
                    const exprOrigin = pendingExprAreaMap.current[dragExpr.id].rect.origin;
                    dnd.maybeStartDrag({
                        expr: atomic ? dragExpr.resetIds() : dragExpr,
                        start: ClientOffset.fromClient(event),
                        exprStart: exprOrigin
                            .offset(containerOrigin)
                            .offset(finalPadding.topLeft.neg),
                        onDragAccepted(copyMode) {
                            if (!(copyMode || persistent)) onDraggedOut?.(dragExpr.id);
                        },
                        onDragUpdate(copyMode) {
                            setGhost(copyMode || persistent ? null : dragExpr.id);
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
            atomic,
            persistent,
            onClick,
            onContextMenu,
            onDoubleClick,
            onMiddleClick,
            onDraggedOut,
            onHover,
            finalPadding,
        ],
    );

    useEffect(() => {
        if (exprAreaMapRef !== undefined && pendingExprAreaMap.current !== null) {
            exprAreaMapRef.current = pendingExprAreaMap.current;
        }
    });

    const finalHighlights = highlights?.slice() ?? [];
    if (showingMenu != null && !atomic) {
        // Do not draw the context-menu ring on atomic exprs.
        finalHighlights.push([showingMenu.expr, theme.highlight.contextMenu]);
    }
    if (droppable != null) {
        finalHighlights.push([droppable, theme.highlight.droppable]);
    }

    const { nodes, size, areas, text } = layoutExpr(theme, expr, {
        focused,
        foldComments,
        exprPropsFor: immutable ? undefined : exprPropsFor,
        // Pass something that can be momoized if we can.
        highlights: showingMenu || droppable !== null ? finalHighlights : highlights,
        ghost: ghost,
    });

    // Spooky in React's Concurrent Mode, but it's ok since we'll only use this when
    // we commit and it doesn't depend on any previous calls to render.
    lastExprArea.current = {
        kind: "expr",
        expr,
        text,
        children: areas,
        rect: new Rect(finalPadding.topLeft, size),
        inline: false,
    };
    pendingExprAreaMap.current = flattenArea(lastExprArea.current);

    const highlightRects = [];
    for (const [exprId, highlight] of finalHighlights) {
        highlightRects.push(drawRect(exprId, highlight, pendingExprAreaMap.current));
    }

    const { width, height } = size.padding(finalPadding);
    const finalScale = scale ?? 1;
    return (
        <>
            <Container
                xmlns="http://www.w3.org/2000/svg"
                ref={containerRef}
                width={width * finalScale}
                height={height * finalScale}
                viewBox={`0 0 ${width} ${height}`}
                // If we can open context menus, do not allow the system menu.
                onContextMenu={(e) => onContextMenu && e.preventDefault()}
                // This makes it so the entire expr can be clicked or dragged.
                {...exprPropsFor(expr)}
            >
                {highlightRects}
                <SvgGroup translate={finalPadding.topLeft}>
                    {nodes}
                    {dropIndicator !== null && <SvgRect rect={dropIndicator} fill="red" />}
                </SvgGroup>
                {showDebugOverlay && lastExprArea.current !== null && (
                    <SvgDebugOverlay area={lastExprArea.current} />
                )}
            </Container>
            {showingMenu && (
                <ContextMenu
                    items={showingMenu.menu}
                    origin={showingMenu.at}
                    onDismissMenu={() => {
                        setShowingMenu(null);
                        onFocus?.();
                    }}
                />
            )}
        </>
    );
});
