import { motion } from "framer-motion";
import React, { Fragment, ReactNode, useCallback } from "react";
import styled, { useTheme } from "styled-components";

import { ContextMenuItem } from "components/context_menu";
import { Shortcut } from "components";
import Expr from "expr";
import ExprView from "expr_view";

const ExprListItem = styled(motion.div)`
    grid-column: expr;
    justify-self: left;
    border: 1px solid ${p => p.theme.colour.subtleClickable};
    border-radius: ${p => p.theme.exprList.borderRadius}px;
    display: flex;
    padding: ${p => p.theme.exprList.padding.css};
`;

const ExprListShortcut = styled(Shortcut)`
    grid-column: shortcut;
    justify-self: right;
    margin-top: ${p => p.theme.exprView.padding.top / 2}px;
`;

const ExprList = styled.div`
    display: grid;
    grid-template-columns:
        [shortcut] auto
        [expr] min-content;
    gap: 10px;
    grid-auto-rows: min-content;
    align-items: start;
    margin: 20px 0 40px;
`;

const DropMarker = styled.div`
    grid-column: 1 / -1;
    background: ${p => p.theme.colour.clickable};
    height: 1px;
    box-shadow: 0 0 ${p => p.theme.droppable.radius}px ${p => p.theme.droppable.colour};
`;

const Extras = styled.div`
    margin: ${p => p.theme.exprView.frozenPadding.css} !important;
`;

interface ShortcutExpr {
    expr: Expr;
    shortcut?: string;
}

interface ExprViewListItemProps<E> {
    maxWidth?: number;
    onDraggedOut?(item: E): void;
    onContextMenu?(item: E): ContextMenuItem[];
}

interface ExprViewListProps<E> extends ExprViewListItemProps<E> {
    animate?: boolean;
    items: E[];
    fallback?: ReactNode;
    showDropMarker?: boolean;
    onGetExtras?(item: E): ReactNode;
}

// This is needed to help with ExprView momoization.
function ExprViewListItem<E extends ShortcutExpr>({
    item,
    maxWidth,
    onDraggedOut,
    onContextMenu,
}: ExprViewListItemProps<E> & { item: E }) {
    const theme = useTheme();
    const draggedOut = useCallback(() => onDraggedOut?.(item), [onDraggedOut, item]);
    const contextMenu = useCallback(() => onContextMenu?.(item) ?? [], [onContextMenu, item]);
    return (
        <ExprView
            frozen
            expr={item.expr}
            theme={theme}
            maxWidth={maxWidth}
            onDraggedOut={draggedOut}
            contextMenuFor={contextMenu}
        />
    );
}

export default function ExprViewList<E extends ShortcutExpr>({
    items,
    animate,
    fallback,
    showDropMarker,
    onGetExtras,
    ...itemProps
}: ExprViewListProps<E>) {
    const theme = useTheme();

    const renderItem = (item: E) => (
        // This has to be a fragment. Otherwise the items won't layout in a grid.
        <Fragment key={item.expr.id}>
            {item.shortcut && theme.feature.exprListShortcuts && (
                <ExprListShortcut>{item.shortcut}</ExprListShortcut>
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
        <ExprList>
            {showDropMarker && <DropMarker />}
            {items.length === 0 && fallback}
            {items.map(renderItem)}
        </ExprList>
    );
}
