import { motion } from "framer-motion";
import React, { Fragment, ReactNode, useCallback } from "react";
import styled, { useTheme } from "styled-components";

import { Box } from "components";
import Expr from "expr";
import ExprView from "expr_view";

import { ContextMenuItem } from "components/context_menu";
import Shortcut from "components/shortcut";

const ExprList = styled.div`
    display: grid;
    grid-template-columns:
        [shortcut] max-content
        [expr] 1fr;
    /* We use margin-right in the shortcut to handle horizontal gap, this way the column collapses
    no nothing if there are no shortcuts present */
    gap: 10px 0;
    grid-auto-rows: min-content;
    align-items: start;
`;

const ExprListItem = styled(motion.div)`
    grid-column: expr;
    justify-self: left;
    border: 1px solid ${(p) => p.theme.colour.subtleClickable};
    border-radius: ${(p) => p.theme.exprList.borderRadius}px;
    display: flex;
`;

const ExprListShortcut = styled.div`
    grid-column: shortcut;
    justify-self: right;
    margin-top: ${(p) => p.theme.exprView.padding.top / 2}px;
    margin-right: 10px;
`;

const DropMarker = styled.div`
    grid-column: 1 / -1;
    background: ${(p) => p.theme.colour.clickable};
    height: 1px;
    box-shadow: 0 0 ${(p) => p.theme.droppable.radius}px ${(p) => p.theme.droppable.colour};
`;

const Fallback = styled.div`
    grid-column: 1 / -1;
`;

const Extras = styled.div`
    margin: ${(p) => p.theme.exprView.widePadding.css} !important;
`;

export interface ShortcutExpr {
    expr: Expr;
    persistent?: boolean;
    shortcut?: string;
}

interface ExprViewListItemProps<E> {
    /** Scale used for the interior ExprViews. */
    scale?: number;
    /** Pass-through callback for each expr in the list. */
    onDraggedOut?(item: E): void;
    /** Pass-through callback for each expr in the list. */
    onContextMenu?(item: E): ContextMenuItem[];
    /** Called on middle click for an expr. */
    onMiddleClick?(item: E): void;
}

interface ExprViewListProps<E> extends ExprViewListItemProps<E> {
    width?: number;
    animate?: boolean;
    items: readonly E[];
    fallback?: ReactNode;
    showDropMarker?: boolean;
    onGetExtras?(item: E): ReactNode;
}

// This is needed to help with ExprView momoization.
function ExprViewListItem<E extends ShortcutExpr>({
    item,
    scale,
    onDraggedOut,
    onContextMenu,
    onMiddleClick,
}: ExprViewListItemProps<E> & { item: E }) {
    const theme = useTheme();
    const draggedOut = useCallback(() => onDraggedOut?.(item), [onDraggedOut, item]);
    const contextMenu = useCallback(() => onContextMenu?.(item) ?? [], [onContextMenu, item]);
    const middleClick = useCallback(() => onMiddleClick?.(item), [onMiddleClick, item]);
    return (
        <Box alignSelf="center" width="100%">
            <ExprView
                atomic
                immutable
                persistent={item.persistent}
                expr={item.expr}
                scale={scale}
                padding={theme.exprList.padding}
                onDraggedOut={draggedOut}
                onContextMenu={contextMenu}
                onMiddleClick={middleClick}
            />
        </Box>
    );
}

export default function ExprViewList<E extends ShortcutExpr>({
    items,
    animate,
    fallback,
    showDropMarker,
    onGetExtras,
    width,
    ...itemProps
}: ExprViewListProps<E>) {
    const theme = useTheme();
    const renderItem = (item: E) => (
        // This has to be a fragment. Otherwise the items won't layout in a grid.
        <Fragment key={item.expr.id}>
            {item.shortcut && theme.feature.exprListShortcuts && (
                <ExprListShortcut>
                    <Shortcut keys={item.shortcut} />
                </ExprListShortcut>
            )}
            <ExprListItem
                initial={animate && { opacity: 0.8, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.1, ease: "easeIn" }}
            >
                <ExprViewListItem item={item} {...itemProps} />
                {onGetExtras && <Extras>{onGetExtras(item)}</Extras>}
            </ExprListItem>
        </Fragment>
    );
    return (
        <ExprList style={{ width }}>
            {showDropMarker && <DropMarker />}
            {items.length === 0 && <Fallback>{fallback}</Fallback>}
            {items.map(renderItem)}
        </ExprList>
    );
}
