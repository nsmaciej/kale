import React, { ReactNode } from "react";

import { Size, Offset, Rect, Padding } from "geometry";
import { Optional, max, assert } from "utils";
import { SvgGroup } from "expr_view/components";
import Expr from "expr";
import { TextStyle } from "text_metrics";

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

export interface Area {
    rect: Rect;
    expr: Expr;
    text: Optional<TextProperties>;
    children: Area[];
    // Needed for setAreasHeightInPlace. See its comment.
    inline: boolean;
}

function shiftText(props: TextProperties, origin: Offset): TextProperties {
    const { offset, ...kept } = props;
    return { ...kept, offset: offset?.add(origin) ?? origin };
}

function shiftArea({ rect, ...rest }: Area, origin: Offset) {
    return { ...rest, rect: rect.shift(origin) };
}

export class Layout {
    // Do not forget to update withNoUnderlines when adding properties.
    size: Size;
    nodes: ReactNode[] = [];
    underlines: Underline[] = [];
    areas: Area[] = [];
    isUnderlined = false;

    // Things that will get copied to areas.
    expr: Optional<Expr>;
    inline = false;
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
        r.inline = this.inline;
        r.text = this.text == null ? null : Object.assign({}, this.text);
        return r;
    }

    place(origin: Offset, layout: Layout, index = this.nodes.length) {
        this.size = this.size.extend(origin, layout.size);
        this.nodes.splice(
            index,
            0,
            <SvgGroup
                translate={origin}
                // The logic is as follows: Either this is some random layout, in which case we let
                // React be inefficent, or it's an expr layout.
                key={layout.expr == null ? this.nodes.length : "E" + layout.expr.id}
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
                rect: new Rect(origin, layout.size),
                expr: layout.expr,
                children: layout.areas,
                inline: layout.inline,
                text: layout.text,
            });
        } else {
            // Adopt the areas.
            this.areas.push(...layout.areas.map(x => shiftArea(x, origin)));
            // Copy the text over while stacking children of exprs.
            if (layout.text != null) {
                assert(this.text == null, "Multiple text properties");
                this.text = shiftText(layout.text, origin);
            }
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
        const size = layout.size.pad(new Offset(pad));
        const pos = column ? size.bottomLeft : size.topRight;
        layout.place(pos, x);
    }
    return layout;
}

export const hstack = (margin: number, ...children: StackLayout) => stack(false, margin, children);
export const vstack = (margin: number, ...children: StackLayout) => stack(true, margin, children);
