import React, { ReactNode } from "react";

import { Optional, max, assert } from "utils";
import { Size, Offset, Rect } from "geometry";
import { SvgGroup } from "expr_view/components";
import { TextStyle } from "text_metrics";
import Expr, { ExprId } from "expr";

export interface TextProperties extends TextStyle {
    colour?: string;
    title?: Optional<string>;
    offset?: Offset;
    commentIndicator?: boolean;
}

export interface Underline {
    level: number;
    offset: number;
    length: number;
}

export interface ExprArea {
    kind: "expr";
    rect: Rect;
    children: Area[];
    expr: Expr;
    inline: boolean;
    text: Optional<TextProperties>;
}

export interface GapArea {
    kind: "gap";
    mode: "child" | "sibling";
    rect: Rect;
    /** The expr we are adjacent to. */
    expr: Expr;
}

export type Area = ExprArea | GapArea;

export interface FlatExprArea {
    expr: Expr;
    inline: boolean;
    rect: Rect;
    text: Optional<TextProperties>;
}

// The `in` is weird here. See https://github.com/microsoft/TypeScript/issues/1778.
export type ExprAreaMap = { [expr in ExprId]: FlatExprArea };

export function flattenArea(parent: Area): ExprAreaMap {
    const map: ExprAreaMap = {};
    function traverse(area: Area, origin: Offset) {
        if (area.kind === "expr") {
            map[area.expr.id] = {
                inline: area.inline,
                rect: area.rect.shift(origin),
                text: area.text,
                expr: area.expr,
            };
            for (const child of area.children) {
                traverse(child, area.rect.origin.offset(origin));
            }
        }
    }
    traverse(parent, Offset.zero);
    return map;
}

function shiftText(props: TextProperties, origin: Offset): TextProperties {
    const { offset, ...kept } = props;
    return { ...kept, offset: offset?.offset(origin) ?? origin };
}

function shiftArea({ rect, ...rest }: Area, origin: Offset) {
    return { ...rest, rect: rect.shift(origin) };
}

export class Layout {
    // Do not forget to update copy when adding properties.
    size: Size;
    nodes: ReactNode[] = [];
    underlines: Underline[] = [];
    areas: Area[] = [];

    /* A hint to the layout algorithm that this layout can neatly fit in line. */
    inline = false;
    /* This layout is not only inline but also should be underlined. */
    isUnderlined = false;

    /** This layout forms the entire expr and should be included in generated expr areas. */
    expr: Expr | null = null;
    /** Hacky, hint that this layout directly belongs to an expr, to help inserting gap between
     * stuff like function names and their arguments (even tho it's only the whole stack together
     * that forms an expr) */
    partOfExpr: Expr | null = null;
    /** This expr displays a piece of text, stored here to be used for the inline-editor. */
    text: Optional<TextProperties>;

    // Important: The node passed here should have a key, otherwise it might end up in a list, and
    // React will complain. A safe key is '0'.
    constructor(node: ReactNode = null, size = Size.zero) {
        this.nodes = [node];
        this.size = size;
    }

    withNoUnderlines(): Layout {
        const layout = this.copy();
        layout.underlines = [];
        layout.isUnderlined = false;
        layout.inline = false;
        return layout;
    }

    copy(): Layout {
        const r = new Layout();
        r.size = this.size;
        r.nodes = this.nodes.slice();
        r.underlines = this.underlines.slice();
        r.areas = this.areas.slice();
        r.isUnderlined = this.isUnderlined;
        r.expr = this.expr;
        r.partOfExpr = this.partOfExpr;
        r.inline = this.inline;
        r.text = this.text == null ? null : Object.assign({}, this.text);
        return r;
    }

    place(origin: Offset, layout: Layout) {
        this.size = this.size.extend(origin, layout.size);
        this.nodes.push(
            <SvgGroup
                translate={origin}
                // The logic is as follows: Either this is some random layout, in which case we let
                // React be inefficent, or it's an expr layout.
                key={layout.expr == null ? this.nodes.length : `expr-${layout.expr.id}`}
            >
                {layout.nodes.flat()}
            </SvgGroup>,
        );

        // Handle underlines.
        for (const x of layout.underlines) {
            this.underlines.push({
                level: x.level + +layout.isUnderlined,
                length: x.length,
                offset: x.offset + origin.x,
            });
        }
        if (layout.isUnderlined) {
            this.underlines.push({ level: 0, length: layout.size.width, offset: origin.x });
        }

        // Handle hover/drop areas.
        if (layout.expr != null) {
            this.areas.push({
                kind: "expr",
                rect: new Rect(origin, layout.size),
                expr: layout.expr,
                children: layout.areas,
                inline: layout.inline,
                text: layout.text,
            });
        } else {
            // Adopt the areas.
            this.areas.push(...layout.areas.map((x) => shiftArea(x, origin)));
            // Copy the text over while stacking children of exprs.
            if (layout.text != null) {
                assert(this.text == null, "Multiple text properties");
                this.text = shiftText(layout.text, origin);
            }
        }
    }

    underlinesHeight() {
        return max(this.underlines.map((x) => x.level)) + +this.isUnderlined;
    }
}

type StackLayout = (Optional<Layout>[] | Optional<Layout>)[];

function stack(column: boolean, margin: number, args: StackLayout) {
    const children: Layout[] = args.flat().filter((x) => x != null);
    if (children.length === 1) {
        return children[0];
    }

    const layout = new Layout();
    const gap = column ? new Size(0, margin) : new Size(margin, 0);
    children.forEach((x, i) => {
        layout.place(column ? layout.size.bottomLeft : layout.size.topRight, x);
        const corner = column ? layout.size.bottomLeft : layout.size.topRight;
        if (i < children.length - 1) {
            const expr = x.expr ?? x.partOfExpr;
            if (expr != null) {
                layout.areas.push({
                    kind: "gap",
                    // If this is a partOfExpr, the gap is a 'child gap'.
                    mode: x.expr != null ? "sibling" : "child",
                    expr,
                    rect: new Rect(
                        corner,
                        column ? new Size(x.size.width, margin) : new Size(margin, x.size.height),
                    ),
                });
            }
            layout.size = layout.size.extend(corner, gap);
        }
    });
    return layout;
}

export const hstack = (margin: number, ...children: StackLayout) => stack(false, margin, children);
export const vstack = (margin: number, ...children: StackLayout) => stack(true, margin, children);
