import * as E from "expr";
import Expr, { ExprId } from "expr";
import { ExprAreaMap } from "expr_view";
import { Optional } from "utils";

export type SelectFn = (expr: Expr, sel: ExprId, areas: ExprAreaMap) => Optional<ExprId>;

const selectParent: SelectFn = (expr, sel) => {
    return expr.parentOf(sel)?.id;
};

const selectLeftSibling: SelectFn = (expr, sel) => {
    const [siblings, ix] = expr.siblings(sel);
    if (ix == null || ix === 0) return null;
    return siblings[ix - 1]?.id;
};

const selectRightSibling: SelectFn = (expr, sel) => {
    const [siblings, ix] = expr.siblings(sel);
    if (ix == null) return null;
    return siblings[ix + 1]?.id;
};

const selectFirstChild: SelectFn = (expr, sel) => {
    return expr.withId(sel)?.children()[0]?.id;
};

// Select only non-inline blocks.
function smartBlockSelection(selectSibling: SelectFn): SelectFn {
    return (expr, sel, areas) => {
        for (const parent of expr.parents(sel)) {
            if (!areas[parent.id].inline) {
                const sibling = selectSibling(expr, parent.id, areas);
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
    if (ix === -1) return blanks[0].id;
    return blanks[(ix + 1) % blanks.length].id;
};

export const rightSiblingSmart = smartSelection(selectRightSibling, selectFirstChild);
export const leftSiblingSmart = smartSelection(selectLeftSibling, selectParent);
export const firstChildSmart = smartSelection(selectFirstChild, null, selectRightSibling);
export const parentSmart = smartSelection(selectParent, null, selectLeftSibling);
export const upSmart = smartBlockSelection(selectLeftSibling);
export const downSmart = smartBlockSelection(selectRightSibling);
