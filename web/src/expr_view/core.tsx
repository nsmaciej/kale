import React, { ReactNode } from "react";

import { Size, Vec, Rect } from "geometry";
import { Optional, max } from "utils";
import { SvgGroup } from "expr_view/components";
import Expr from "expr";

export interface Underline {
    level: number;
    offset: number;
    length: number;
}

export interface Area {
    rect: Rect;
    expr: Expr;
    children: Area[];
}

export class Layout {
    size: Size;
    nodes: ReactNode[] = [];
    inline = false;
    underlines: Underline[] = [];
    expr: Optional<Expr>;
    areas: Area[] = [];
    isUnderlined = false;
    inlineExprs = new Set<Expr>();

    constructor(node: ReactNode = null, size = Size.zero) {
        this.nodes = [node];
        this.size = size;
    }

    withNoUnderlines() {
        const layout = new Layout(this.nodes.slice(), this.size);
        layout.areas = this.areas;
        layout.expr = this.expr;
        layout.inlineExprs = this.inlineExprs;
        return layout;
    }

    place(origin: Vec, layout: Layout, index = this.nodes.length) {
        this.size = this.size.extend(origin, layout.size);
        this.nodes.splice(index, 0, <SvgGroup translate={origin}>{layout.nodes.flat()}</SvgGroup>);

        // Handle inline children.
        if (layout.inline && layout.expr != null) {
            this.inlineExprs.add(layout.expr);
        }
        if (layout.inlineExprs.size > 0) {
            this.inlineExprs = new Set([...this.inlineExprs, ...layout.inlineExprs]);
        }

        // Handle underlines.
        for (const x of layout.underlines) {
            this.underlines.push({
                level: x.level + +layout.isUnderlined,
                length: x.length,
                offset: x.offset + origin.x,
            });
        }
        if (layout.isUnderlined) {
            this.underlines.push({
                level: 0,
                length: layout.size.width,
                offset: origin.x,
            });
        }

        // Handle hover/drop areas.
        if (layout.expr != null) {
            this.areas.push({
                rect: new Rect(origin, layout.size),
                expr: layout.expr,
                children: layout.areas,
            });
        } else {
            // Adopt the areas.
            const orphans = layout.areas.map(({ rect, expr, children }) => ({
                expr,
                children,
                rect: rect.shift(origin),
            }));
            this.areas.push(...orphans);
        }
    }

    underlinesHeight() {
        return max(this.underlines.map(x => x.level)) + +this.isUnderlined;
    }
}

type StackLayout = (Optional<Layout>[] | Optional<Layout>)[];

function stack(column: boolean, margin: number, args: StackLayout) {
    const children = args.flat().filter(x => x != null);
    if (children.length === 1) {
        return children[0];
    }

    const layout = new Layout();
    for (const x of children) {
        // Do not use the margin for the first element.
        const pad = layout.size.isZero() ? 0 : margin;
        const size = layout.size.pad(new Vec(pad));
        const pos = column ? size.bottom_left : size.top_right;
        layout.place(pos, x);
    }
    return layout;
}

export const hstack = (margin: number, ...children: StackLayout) => stack(false, margin, children);
export const vstack = (margin: number, ...children: StackLayout) => stack(true, margin, children);
