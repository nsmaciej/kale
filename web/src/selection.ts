import * as E from "expr";
import Expr, { ExprId } from "expr";
import { ExprAreaMap } from "expr_view";
import { Optional } from "utils";

export type SelectFn = (expr: Expr, sel: ExprId, areas: ExprAreaMap) => Optional<ExprId>;

export const parent: SelectFn = (expr, sel) => {
    return expr.parentOf(sel)?.id;
};

const leftSibling: SelectFn = (expr, sel) => {
    const [siblings, ix] = expr.siblings(sel);
    if (ix == null || ix === 0) return null;
    return siblings[ix - 1]?.id;
};

const rightBiling: SelectFn = (expr, sel) => {
    const [siblings, ix] = expr.siblings(sel);
    if (ix == null) return null;
    return siblings[ix + 1]?.id;
};

const firstChild: SelectFn = (expr, sel) => {
    return expr.withId(sel)?.children()[0]?.id;
};

// Select only non-inline blocks.
function smartBlockSelection(selectSibling: SelectFn): SelectFn {
    return (expr, sel, areas) => {
        for (const parentExpr of expr.parents(sel)) {
            if (!areas[parentExpr.id].inline) {
                const sibling = selectSibling(expr, parentExpr.id, areas);
                if (sibling != null) return sibling;
            }
        }
        return null;
    };
}

function smartSelection(
    first: SelectFn,
    fallback?: Optional<SelectFn>,
    parentFallback = first,
): SelectFn {
    return (expr, sel, areas) => {
        // Try the first selection function or its fallback.
        const simple = first(expr, sel, areas) ?? fallback?.(expr, sel, areas);
        if (simple != null) return simple;
        // Otherwise try using the parentFallback on each parent.
        for (const parent of expr.parents(sel)) {
            const next = parentFallback(expr, parent.id, areas);
            if (next != null) return next;
        }
        return null;
    };
}

export const nextBlank: SelectFn = (expr, sel) => {
    const blanks = expr.findAll(x => x instanceof E.Blank);
    const ix = blanks.findIndex(x => x.id === sel);
    if (!blanks.length) return null;
    if (ix === -1) return blanks[0].id;
    return blanks[(ix + 1) % blanks.length].id;
};

export const rightSiblingSmart = smartSelection(rightBiling, firstChild);
export const leftSiblingSmart = smartSelection(leftSibling, parent);
export const firstChildSmart = smartSelection(firstChild, null, rightBiling);
export const parentSmart = smartSelection(parent, null, leftSibling);
export const upSmart = smartBlockSelection(leftSibling);
export const downSmart = smartBlockSelection(rightBiling);
