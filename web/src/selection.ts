import * as E from "expr";
import { ExprAreaMap } from "expr_view";
import Expr, { ExprId } from "expr";

export type SelectFn = (expr: Expr, sel: ExprId, areas: ExprAreaMap) => ExprId | null;

export const parent: SelectFn = (expr, sel) => {
    return expr.parentOf(sel)?.id ?? null;
};

export const leftSibling: SelectFn = (expr, sel) => {
    const [siblings, ix] = expr.siblings(sel);
    if (ix == null || ix === 0) return null;
    return siblings[ix - 1]?.id;
};

export const rightSibling: SelectFn = (expr, sel) => {
    const [siblings, ix] = expr.siblings(sel);
    if (ix == null) return null;
    return siblings[ix + 1]?.id;
};

export const firstChild: SelectFn = (expr, sel) => {
    return expr.findId(sel)?.children()[0]?.id ?? null;
};

export const lastChild: SelectFn = (expr, sel) => {
    const children = expr.findId(sel)?.children();
    if (children == null) return null;
    return children[children.length - 1]?.id;
};

const leftDeepestChild: SelectFn = (expr, sel, areas) => {
    let r = leftSibling(expr, sel, areas);
    while (r != null) {
        const next = lastChild(expr, r, areas);
        if (next == null) return r;
        r = next;
    }
    return r;
};

/** Skips past inline exprs and lists using a selector. */
function skipNonInline(selectSibling: SelectFn): SelectFn {
    return (expr, sel, areas) => {
        let result = selectSibling(expr, sel, areas);
        while (result !== null && (areas[result].expr instanceof E.List || areas[result].inline)) {
            result = selectSibling(expr, result, areas);
        }
        return result;
    };
}

function smartSelection(first: SelectFn, fallback: SelectFn): SelectFn {
    return (expr, sel, areas) => {
        // Try the first selection function or its fallback.
        const simple = first(expr, sel, areas) ?? fallback(expr, sel, areas);
        if (simple != null) return simple;
        // Otherwise try using the fallback on each parent.
        for (const parentExpr of expr.parents(sel)) {
            const next = fallback(expr, parentExpr.id, areas);
            if (next != null) return next;
        }
        return null;
    };
}

export const nextBlank: SelectFn = (expr, sel) => {
    const blanks = expr.findAll((x) => x instanceof E.Blank);
    const ix = blanks.findIndex((x) => x.id === sel);
    if (!blanks.length) return null;
    if (ix === -1) return blanks[0].id;
    return blanks[(ix + 1) % blanks.length].id;
};

// Skip past children.
export const rightSiblingSmart = smartSelection(rightSibling, rightSibling);
export const leftSiblingSmart = smartSelection(leftSibling, parent);
// Pre-order traversal.
export const leftSmart = smartSelection(leftDeepestChild, parent);
export const rightSmart = smartSelection(firstChild, rightSibling);
// Non-inline siblings.
export const upSmart = skipNonInline(leftSmart);
export const downSmart = skipNonInline(rightSmart);
