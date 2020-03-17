import React, { Fragment, ReactNode } from "react";
import styled, { useTheme } from "styled-components";
import { motion } from "framer-motion";

import Expr from "expr";
import ExprView from "expr_view";
import { Shortcut } from "components";

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

const Extras = styled.div`
    margin: ${p => p.theme.exprView.padding.css} !important;
`;

interface ShortcutExpr {
    expr: Expr;
    shortcut?: string;
}

interface ExprViewListProps<E> {
    animate?: boolean;
    maxWidth?: number;
    items: E[];
    frozen?: boolean;
    fallback?: ReactNode;
    extras?(item: E): ReactNode;
}

export default function ExprViewList<E extends ShortcutExpr>({
    items,
    frozen,
    animate,
    fallback,
    maxWidth,
    extras,
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
                <ExprView expr={item.expr} frozen={frozen} theme={theme} maxWidth={maxWidth} />
                {extras && <Extras>{extras(item)}</Extras>}
            </ExprListItem>
        </Fragment>
    );
    return (
        <ExprList>
            {items.length === 0 && fallback}
            {items.map(renderItem)}
        </ExprList>
    );
}
