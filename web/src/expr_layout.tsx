import React from "react";
import styled from "styled-components";

import { Optional, max } from "./utils";
import { Vec, Size, Rect } from "./geometry";
import { Layout, hstack, vstack } from "./layout";
import { Expr, ExprId, ExprVisitor } from "./expr";
import * as E from "./expr";
import TextMetrics from "./text_metrics";
import { UnderlineLine, SvgLine, HitBox, HoverHitBox } from "./expr_components";
import THEME from "./theme";
import { motion } from "framer-motion";

interface TextProperties {
    italic?: boolean;
    bold?: boolean;
    colour?: string;
    title?: string;
    offset?: Vec;
}

// See https://vanseodesign.com/web-design/svg-text-baseline-alignment/ for excellent discussion
// on SVG text aligment properties.
const Code = styled.text`
    font-size: ${THEME.fontSizePx}px;
    font-family: ${THEME.fontFamily};
    dominant-baseline: text-before-edge;
`;

function CreateCircle({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
    const r = THEME.createCircleR;
    const maxR = THEME.createCircleMaxR;
    const cx = r;
    const cy = THEME.fontSizePx / 2 + 3;
    const rect = new Rect(new Vec(cx - maxR, cy - maxR), new Size(maxR * 2));
    return (
        <HoverHitBox area={rect} onClick={onClick} title="Add an argument...">
            {mouseOver => (
                <motion.circle
                    fill="none"
                    stroke={THEME.decorationColour}
                    strokeWidth={1}
                    animate={{ r: mouseOver ? maxR : r }}
                    r={r}
                    cx={cx}
                    cy={cy}
                    transition={{ duration: 0.1 }}
                />
            )}
        </HoverHitBox>
    );
}

export function materialiseUnderlines(parent: Layout) {
    const layout = parent.withNoUnderlines();
    const gap = THEME.lineGap;
    for (const x of parent.underlines) {
        const pos = new Vec(x.offset, parent.size.height + x.level * gap);
        layout.nodes.push(<UnderlineLine start={pos} end={pos.dx(x.length)} />);
    }
    const height = max(parent.underlines.map(x => x.level)) * gap;
    layout.size = layout.size.pad(new Vec(0, height));
    return layout;
}

export interface ExprDelegate {
    isFrozen?(expr: Expr): boolean;
    selection?: Optional<ExprId>; // Only checked by holes.
    onHoverExpr?(e: React.MouseEvent, expr: Optional<Expr>): void;
    onClickExpr?(e: React.MouseEvent, expr: Expr): void;
    onClickCreateCircle?(e: React.MouseEvent, expr: Expr): void;
    onMouseDown?(e: React.MouseEvent, expr: Expr): void;
}

export class ExprLayout implements ExprVisitor<Layout> {
    constructor(private readonly delegate: Optional<ExprDelegate>) {}

    private exprProps(expr: Expr) {
        return {
            onMouseEnter: (e: React.MouseEvent) => this.delegate?.onHoverExpr?.(e, expr),
            onMouseLeave: (e: React.MouseEvent) => this.delegate?.onHoverExpr?.(e, null),
            onClick: (e: React.MouseEvent) => this.delegate?.onClickExpr?.(e, expr),
            onMouseDown: (e: React.MouseEvent) => this.delegate?.onMouseDown?.(e, expr),
        };
    }

    private layoutText(
        expr: Expr,
        text: string,
        { italic, colour, title, bold, offset }: TextProperties = {},
    ) {
        const layout = new Layout(
            (
                <Code
                    fill={colour}
                    fontStyle={italic ? "italic" : undefined}
                    fontWeight={bold ? "bold" : undefined}
                    x={offset?.x}
                    y={offset?.y}
                    {...this.exprProps(expr)}
                >
                    {title && <title>{title}</title>}
                    {text}
                </Code>
            ),
            TextMetrics.global.measure(text, { italic, bold }),
        );
        layout.inline = true;
        return layout;
    }

    private layoutCreateCircle(expr: Expr) {
        if (this.delegate?.isFrozen?.(expr)) return;
        return new Layout(
            (<CreateCircle onClick={e => this.delegate?.onClickCreateCircle?.(e, expr)} />),
            new Size(THEME.createCircleMaxR, THEME.fontSizePx),
        );
    }

    private layoutComment(expr: Expr) {
        if (expr.data.comment == null) return null;
        return this.layoutText(expr, expr.data.comment, {
            italic: true,
            colour: THEME.commentColour,
        });
    }

    layout(expr: Expr): Layout {
        const layout = expr.visit(this);
        // This associates the layout with the expr, which is used for generating selection areas.
        layout.expr = expr;
        return layout;
    }

    visitList(expr: E.List): Layout {
        const layout = vstack(
            THEME.lineSpacingPx,
            expr.list.map(x => materialiseUnderlines(this.layout(x))),
        );
        const line = new Rect(new Vec(3, 5), new Size(0, layout.size.height - 5));
        const ruler = (
            <HitBox area={line.pad(new Vec(5))} {...this.exprProps(expr)}>
                <SvgLine start={line.origin} end={line.bottom_right} />
            </HitBox>
        );
        return vstack(
            THEME.lineSpacingPx,
            this.layoutComment(expr),
            hstack(0, new Layout(ruler, new Size(10, 0)), layout),
        );
    }

    visitLiteral(expr: E.Literal): Layout {
        const content = expr.type === "str" ? `"${expr.content}"` : expr.content;
        return this.layoutText(expr, content, {
            title: expr.data.comment,
            colour: THEME.literalColour,
        });
    }

    visitVariable(expr: E.Variable): Layout {
        return this.layoutText(expr, expr.name, {
            title: expr.data.comment,
            colour: THEME.variableColour,
        });
    }

    visitHole(expr: E.Hole): Layout {
        const padding = THEME.holePillPadding;
        const text = this.layoutText(expr, expr.data.comment ?? "?", {
            colour: THEME.holeColour,
            offset: padding,
        });
        let rect = new Rect(padding, text.size).pad(padding);
        if (rect.width < rect.height) {
            rect = rect.withSize(new Size(rect.height)); // Make the pill square.
        }
        const { x, y, width, height } = rect;
        const selected = this.delegate?.selection === expr.id;
        const pill = (mouseOver: boolean) => (
            <motion.rect
                {...{ width, height, x, y }}
                animate={{
                    fill: selected
                        ? THEME.selectionColour
                        : mouseOver
                        ? THEME.holeFillColourHover
                        : THEME.holeFillColour,
                }}
                initial={false}
                rx={rect.height / 2}
                strokeWidth={1}
                stroke={selected ? THEME.selectionStrokeColour : THEME.holeStrokeColour}
            />
        );
        const layout = new Layout(
            (
                <HoverHitBox area={rect} {...this.exprProps(expr)}>
                    {mouseOver => (
                        <>
                            {pill(mouseOver)}
                            {text.nodes}
                        </>
                    )}
                </HoverHitBox>
            ),
            rect.size,
        );
        layout.inline = true;
        return layout;
    }

    visitCall(expr: E.Call): Layout {
        const args = expr.args.map(this.layout, this);
        const inline = isCallInline(args);
        const fnName = hstack(
            THEME.createCircleMaxR,
            this.layoutText(expr, expr.fn, { bold: !inline }),
            this.layoutCreateCircle(expr),
        );

        let layout: Layout;
        // Adding a comment makes a call non-inline but not bold.
        if (inline && expr.data.comment == null) {
            const inlineMarginPx = TextMetrics.global.measure("\xa0").width; // Non-breaking space.
            layout = hstack(inlineMarginPx, fnName, args);
            layout.isUnderlined = true;
            layout.inline = true;
        } else {
            layout = hstack(
                THEME.lineSpacingPx,
                fnName,
                vstack(THEME.lineSpacingPx, args.map(materialiseUnderlines)),
            );
        }

        const comment = this.layoutComment(expr);
        return vstack(THEME.lineSpacingPx, comment, layout);
    }
}

function isCallInline(args: readonly Layout[]): boolean {
    if (args.length === 0) {
        return true;
    }
    if (!args.every(x => x.inline)) {
        return false;
    }
    // Our situation won't improve much from here on by making the function not-inline.
    if (args.length === 1) {
        return true;
    }
    // Do we need a line break?
    const lineWidth = args.map(x => x.size.width).reduce((x, y) => x + y, 0);
    if (lineWidth > THEME.lineBreakPointPx && args.length > 0) {
        return false;
    }
    // Is the expression too nested?
    const underlinesHeight = max(args.map(x => x.underlinesHeight()));
    const MAX_NESTING_LEVEL = 3;
    return underlinesHeight < MAX_NESTING_LEVEL;
}
