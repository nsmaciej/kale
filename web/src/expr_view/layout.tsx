import { motion } from "framer-motion";
import memoizeOne from "memoize-one";
import React from "react";
import styled, { useTheme } from "styled-components";

import * as E from "expr";
import { KaleTheme, Highlight } from "theme";
import { max } from "utils";
import { Offset, Size, Rect } from "geometry";
import Expr, { ExprId, ExprVisitor } from "expr";
import TextMetrics from "text_metrics";

import { Layout, TextProperties, hstack, vstack, Area } from "expr_view/core";
import { UnderlineLine, SvgLine, HitBox, HoverHitBox } from "expr_view/components";

// See https://vanseodesign.com/web-design/svg-text-baseline-alignment/ for excellent discussion
// on SVG text aligment properties.
const Code = styled.text`
    font-size: ${p => p.theme.expr.fontSizePx}px;
    font-family: ${p => p.theme.expr.fontFamily};
`;

const CommentIndicator = styled.tspan`
    baseline-shift: super;
    fill: ${p => p.theme.syntaxColour.comment};
    font-size: ${p => Math.round(p.theme.expr.fontSizePx * 0.6)}px;
    font-weight: normal;
`;

function CreateCircle({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
    const theme = useTheme();
    const r = theme.createCircle.radius;
    const maxR = theme.createCircle.maxRadius;
    const cx = r;
    const cy = theme.expr.fontSizePx / 2 + 3;
    const rect = new Rect(new Offset(cx - maxR, cy - maxR), new Size(maxR * 2));
    return (
        <HoverHitBox area={rect} onClick={onClick} title="Add an argument...">
            {mouseOver => (
                <motion.circle
                    fill="none"
                    stroke={theme.createCircle.stroke}
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

// This lets all inline child areas have the same height, preventing
// the selection and highlight rects from overlapping with the lines.
// This is a limitation of the layout engine, we do not yet know how
// many underlines an expr will have until higher up in call stack,
// so we just set the height here, now that we know for sure.
function setAreasHeightInPlace(areas: Area[], height: number) {
    for (const area of areas) {
        if (!area.inline) continue;
        area.rect = area.rect.withSize(new Size(area.rect.size.width, height));
        setAreasHeightInPlace(area.children, height);
    }
}

function materialiseUnderlines(theme: KaleTheme, parent: Layout) {
    const layout = parent.withNoUnderlines();
    const gap = theme.layout.underlineSpacing;
    parent.underlines.forEach((x, i) => {
        const pos = new Offset(x.offset, parent.size.height + x.level * gap);
        layout.nodes.push(<UnderlineLine start={pos} end={pos.dx(x.length)} key={"U" + i} />);
    });
    const height = max(parent.underlines.map(x => x.level)) * gap;
    layout.size = layout.size.pad(new Offset(0, height));
    setAreasHeightInPlace(layout.areas, layout.size.height);
    return layout;
}

function isCallInline(theme: KaleTheme, args: readonly Layout[]): boolean {
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
    if (lineWidth > theme.layout.lineBreakPoint && args.length > 0) {
        return false;
    }
    // Is the expression too nested?
    const underlinesHeight = max(args.map(x => x.underlinesHeight()));
    const MAX_NESTING_LEVEL = 3;
    return underlinesHeight < MAX_NESTING_LEVEL;
}

interface LayoutState {
    hasDisabledParent: boolean;
}

class ExprLayout implements ExprVisitor<Layout> {
    constructor(
        private readonly t: KaleTheme,
        private readonly props: LayoutProps,
        private readonly state: LayoutState = { hasDisabledParent: false },
    ) {}

    private exprProps(expr: Expr) {
        return this.props.exprPropsFor?.(expr);
    }

    private layoutText(
        expr: Expr,
        text: string,
        props: TextProperties & { mainText?: boolean } = {},
    ) {
        const { italic, colour, title, weight, offset, commentIndicator, mainText } = props;
        const disabled = expr.data.disabled || this.state.hasDisabledParent;
        const layout = new Layout(
            (
                <Code
                    // Note: if changing this, also update the propagated text props below.
                    fill={disabled ? this.t.syntaxColour.disabled : colour}
                    fontStyle={italic ? "italic" : undefined}
                    fontWeight={weight}
                    x={offset?.x}
                    y={(offset?.y ?? 0) + this.t.expr.fontSizePx}
                    {...this.exprProps(expr)}
                    key={0}
                >
                    {title && <title>{title}</title>}
                    {text}
                    {commentIndicator && <CommentIndicator>?</CommentIndicator>}
                </Code>
            ),
            TextMetrics.global.measure(text, props),
        );
        layout.inline = true;
        if (mainText) {
            layout.text = props;
            if (disabled) {
                layout.text.colour = this.t.syntaxColour.disabled;
            }
        }
        return layout;
    }

    private layoutCreateCircle(expr: Expr) {
        if (this.props.frozen) return;
        return new Layout(
            (<CreateCircle onClick={e => this.props.onClickCreateCircle?.(e, expr)} key={0} />),
            new Size(this.t.createCircle.maxRadius, this.t.expr.fontSizePx),
        );
    }

    private layoutComment(expr: Expr) {
        if (expr.data.comment == null || this.props.foldComments) return null;
        return this.layoutText(expr, expr.data.comment, {
            italic: true,
            colour: this.t.syntaxColour.comment,
        });
    }

    layout(expr: Expr): Layout {
        const layout = expr.visit(this);
        layout.expr = expr;
        return layout;
    }

    private layoutInner(parent: Expr, expr: Expr) {
        return new ExprLayout(this.t, this.props, {
            hasDisabledParent: this.state.hasDisabledParent || parent.data.disabled,
        }).layout(expr);
    }

    visitList(expr: E.List): Layout {
        const layout = vstack(
            this.t.layout.lineSpacing,
            expr.list.map(x => materialiseUnderlines(this.t, this.layoutInner(expr, x))),
        );
        const line = new Rect(new Offset(3, 5), new Size(0, layout.size.height - 8));
        // Only thing outside layoutText checking this.
        const disabled = expr.data.disabled || this.state.hasDisabledParent;
        const ruler = (
            <HitBox area={line.pad(new Offset(5))} {...this.exprProps(expr)} key={0}>
                <SvgLine
                    start={line.origin}
                    end={line.bottomRight}
                    stroke={disabled ? this.t.syntaxColour.disabled : this.t.syntaxColour.listRuler}
                />
            </HitBox>
        );
        return vstack(
            this.t.layout.lineSpacing,
            this.layoutComment(expr),
            hstack(0, new Layout(ruler, new Size(10, 0)), layout),
        );
    }

    visitLiteral(expr: E.Literal): Layout {
        //TODO: Add more pretty printing for literals.
        return this.layoutText(expr, expr.content, {
            title: expr.data.comment ?? undefined,
            colour: this.t.syntaxColour.literal,
            italic: expr.type === "symbol",
            commentIndicator: expr.data.comment != null,
            mainText: true,
        });
    }

    visitVariable(expr: E.Variable): Layout {
        return this.layoutText(expr, expr.name, {
            title: expr.data.comment,
            commentIndicator: expr.data.comment != null,
            colour: this.t.syntaxColour.variable,
            mainText: true,
        });
    }

    visitBlank(expr: E.Blank): Layout {
        const padding = this.t.blank.padding;
        const text = this.layoutText(expr, expr.data.comment ?? "?", {
            colour: this.t.blank.textColour,
            offset: padding.topLeft,
        });

        let highlight = this.t.blank.resting;
        if (this.props.highlights != null) {
            for (const [exprId, hl] of this.props.highlights) {
                if (exprId === expr.id) highlight = hl;
            }
        }

        let rect = new Rect(Offset.zero, text.size.padding(padding));
        if (rect.width < rect.height) {
            rect = rect.withSize(new Size(rect.height)); // Make the pill square.
        }
        const { x, y, width, height } = rect;
        const layout = new Layout(
            (
                <g {...this.exprProps(expr)} key="0">
                    <motion.rect
                        {...{ width, height, x, y }}
                        animate={{
                            // Here we recreate the selection rect colouring logic.
                            fill: highlight.blankFill(this.props.focused === true),
                        }}
                        initial={false}
                        rx={rect.height / 2}
                        strokeWidth={highlight.strokeWidth}
                        stroke={highlight.blankStroke(this.props.focused === true)}
                        style={{ filter: highlight.droppable ? "url(#droppable)" : undefined }}
                    />
                    {text.nodes}
                </g>
            ),
            rect.size,
        );
        layout.inline = true;
        return layout;
    }

    visitCall(expr: E.Call): Layout {
        const args = expr.args.map(x => this.layoutInner(expr, x), this);
        const inline = isCallInline(this.t, args);
        const fnName = hstack(
            this.t.createCircle.maxRadius,
            this.layoutText(expr, expr.fn, {
                weight: 700,
                commentIndicator: expr.data.comment != null && this.props.foldComments,
                colour: this.t.syntaxColour.call,
                mainText: true,
            }),
            this.layoutCreateCircle(expr),
        );

        let layout: Layout;
        // Adding a comment makes a call non-inline but not bold.
        //TODO: Don't do this if we are in a list.
        if (inline && (expr.data.comment == null || this.props.foldComments)) {
            layout = hstack(TextMetrics.global.space.width, fnName, args);
            layout.isUnderlined = true;
            layout.inline = true;
        } else {
            layout = hstack(
                TextMetrics.global.space.width,
                fnName,
                vstack(
                    this.t.layout.lineSpacing,
                    args.map(x => materialiseUnderlines(this.t, x)),
                ),
            );
        }

        const comment = this.layoutComment(expr);
        return vstack(this.t.layout.lineSpacing, comment, layout);
    }
}

// Make sure to update argsEqual when adding or removing properties form this.
export interface LayoutProps {
    exprPropsFor?(expr: Expr): Partial<React.DOMAttributes<Element>>;
    onClickCreateCircle?(e: React.MouseEvent, expr: Expr): void;
    frozen?: boolean;
    focused?: boolean;
    highlights?: readonly [ExprId, Highlight][];
    foldComments?: boolean;
}

type LayoutExprArgs = [KaleTheme, Expr, LayoutProps];

function argsEquals(prev: LayoutExprArgs, next: LayoutExprArgs) {
    const lhs = prev[2];
    const rhs = next[2];
    const quickCheck =
        prev[0] === next[0] &&
        prev[1] === next[1] &&
        lhs.exprPropsFor === rhs.exprPropsFor &&
        lhs.onClickCreateCircle === rhs.onClickCreateCircle &&
        lhs.frozen === rhs.frozen &&
        lhs.foldComments === rhs.foldComments;
    if (!quickCheck) return false;

    // By the quickCheck the two exprs must be equal.
    const expr = next[1];
    // Check if either state has any blanks highlighted.
    function highlightsBlanks(part: LayoutProps) {
        if (part.highlights == null) return false;
        for (const pair of part.highlights) {
            if (expr.get(pair[0]) instanceof E.Blank) return true;
        }
        return false;
    }
    return !highlightsBlanks(lhs) && !highlightsBlanks(rhs);
}

export default memoizeOne(
    function layoutExpr(theme: KaleTheme, expr: Expr, props: LayoutProps): Layout {
        return materialiseUnderlines(theme, new ExprLayout(theme, props).layout(expr));
    },
    // This library is badly typed.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    argsEquals as (lhs: any[], rhs: any[]) => boolean,
);
