import { motion } from "framer-motion";
import memoizeOne from "memoize-one";
import React from "react";
import styled from "styled-components";

import * as E from "expr";
import { KaleTheme, Highlight } from "theme";
import { max } from "utils";
import { Offset, Size, Rect } from "geometry";
import Expr, { ExprId, ExprVisitor } from "expr";
import TextMetrics from "text_metrics";

import { Layout, TextProperties, hstack, vstack, Area } from "expr_view/core";
import { Type } from "vm/types";
import { UnderlineLine, SvgLine, HitBox, SvgGroup } from "expr_view/components";

const Code = styled.text`
    font-size: ${(p) => p.theme.expr.fontSizePx}px;
    font-family: ${(p) => p.theme.expr.fontFamily};
`;

const CommentIndicator = styled.tspan`
    baseline-shift: super;
    fill: ${(p) => p.theme.syntaxColour.comment};
    font-size: ${(p) => Math.round(p.theme.expr.fontSizePx * 0.6)}px;
    font-weight: normal;
`;

/** Lets all inline child areas have the same height, preventing the selection and highlight
 * rects from overlapping with the lines. This is a limitation of the layout engine, we do not yet
 * know how many underlines an expr will have until higher up in call stack, so we just set the
 * height here, now that we know for sure. */
function setAreasHeightInPlace(areas: Area[], height: number) {
    for (const area of areas) {
        if (area.kind === "expr" && area.inline) {
            area.rect = area.rect.withSize(new Size(area.rect.size.width, height));
            setAreasHeightInPlace(area.children, height);
        }
    }
}

function materialiseUnderlines(theme: KaleTheme, parent: Layout) {
    const layout = parent.withNoUnderlines();
    const gap = theme.layout.underlineSpacing;
    parent.underlines.forEach((x, i) => {
        const pos = new Offset(x.offset, parent.size.height + x.level * gap);
        layout.nodes.push(<UnderlineLine start={pos} end={pos.dx(x.length)} key={"U" + i} />);
    });
    const height = max(parent.underlines.map((x) => x.level)) * gap;
    layout.size = layout.size.pad(new Offset(0, height));
    // Don't just use height, subtract the text offset in case there is a comment sitting on top of
    // the text. (Like in the 'commented call in a list' case).
    setAreasHeightInPlace(layout.areas, layout.size.height - (layout.text?.offset?.y ?? 0));
    return layout;
}

function isCallInline(theme: KaleTheme, args: readonly Layout[]): boolean {
    if (args.length === 0) {
        return true;
    }
    if (!args.every((x) => x.inline)) {
        return false;
    }
    // Our situation won't improve much from here on by making the function not-inline.
    if (args.length === 1) {
        return true;
    }
    // Do we need a line break?
    const lineWidth = args.map((x) => x.size.width).reduce((x, y) => x + y, 0);
    if (lineWidth > theme.layout.lineBreakPoint && args.length > 0) {
        return false;
    }
    // Is the expression too nested?
    return max(args.map((x) => x.underlinesHeight())) < theme.layout.maxNesting;
}

interface LayoutState {
    hasDisableAncestor: boolean;
    hasListParent: boolean;
}

class ExprLayout implements ExprVisitor<Layout> {
    constructor(
        private readonly t: KaleTheme,
        private readonly props: LayoutProps,
        // We pretend topLevel expressions are in a 'list'.
        private readonly state: LayoutState = { hasDisableAncestor: false, hasListParent: true },
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
        const disabled = expr.data.disabled || this.state.hasDisableAncestor;
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

    private layoutComment(expr: Expr) {
        if (expr.data.comment == null || this.props.foldComments) return null;
        return this.layoutText(expr, expr.data.comment, {
            italic: true,
            colour: this.t.syntaxColour.comment,
        });
    }

    layout(expr: Expr): Layout {
        const layout = expr.visit(this);
        if (this.props.ghost === expr.id) {
            layout.nodes = [
                <SvgGroup opacity={0.3} key="ghost">
                    {layout.nodes}
                </SvgGroup>,
            ];
        }
        layout.expr = expr;
        return layout;
    }

    private layoutInner(parent: Expr, expr: Expr) {
        return new ExprLayout(this.t, this.props, {
            hasDisableAncestor: this.state.hasDisableAncestor || parent.data.disabled,
            hasListParent: parent instanceof E.List,
        }).layout(expr);
    }

    visitList(expr: E.List): Layout {
        const layout = vstack(
            this.t.layout.lineSpacing,
            expr.list.map((x) => materialiseUnderlines(this.t, this.layoutInner(expr, x))),
        );
        const line = new Rect(new Offset(3, 5), new Size(0, layout.size.height - 8));
        // Only thing outside layoutText checking this.
        const disabled = expr.data.disabled || this.state.hasDisableAncestor;
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
        const textProps = {
            title: expr.data.comment ?? undefined,
            colour: this.t.syntaxColour.literal,
            italic: expr.type === Type.Num,
        };
        const content = this.layoutText(expr, expr.content, {
            commentIndicator: expr.data.comment != null,
            mainText: true,
            ...textProps,
        });
        if (expr.type === Type.Text) {
            const quote = this.layoutText(expr, '"', textProps);
            const text = hstack(0, quote, content, quote);
            text.inline = true;
            return text;
        }
        return content;
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
        // Find the topmost highlight to apply.
        let highlight = this.t.blank.resting;
        if (this.props.highlights != null) {
            for (const [exprId, hl] of this.props.highlights) {
                if (exprId === expr.id) highlight = hl;
            }
        }

        const padding = this.t.blank.padding;
        const margin = this.t.blank.margin;
        const text = this.layoutText(expr, expr.data.comment ?? "?", {
            colour: this.t.blank.textColour,
        });

        let rectSize = text.size.padding(this.t.blank.padding);
        if (rectSize.width < rectSize.height) {
            rectSize = new Size(rectSize.height);
        }
        const layout = new Layout(
            (
                // Need to use a <g> because exprProps type doesn't match motion.rect.
                <SvgGroup {...this.exprProps(expr)} translate={this.t.blank.margin.topLeft} key="0">
                    <motion.rect
                        width={rectSize.width}
                        height={rectSize.height}
                        animate={{
                            // Here we recreate the selection rect colouring logic.
                            fill: highlight.blankFill(this.props.focused === true),
                        }}
                        initial={false}
                        rx={rectSize.height / 2}
                        stroke={highlight.blankStroke(this.props.focused === true)}
                        style={{ filter: highlight.droppable ? "url(#droppable)" : undefined }}
                    />
                </SvgGroup>
            ),
        );
        layout.place(padding.combine(margin).topLeft, text);
        layout.inline = true;
        layout.size = rectSize.padding(this.t.blank.margin);
        return layout;
    }

    visitCall(expr: E.Call): Layout {
        const args = expr.args.map((x) => this.layoutInner(expr, x), this);
        const fnName = this.layoutText(expr, expr.fn, {
            weight: 700,
            commentIndicator: expr.data.comment != null && this.props.foldComments,
            colour: this.t.syntaxColour.call,
            mainText: true,
        });
        // This is needed to make stack gap insertion insert a gap between the function name and the
        // arguments.
        fnName.partOfExpr = expr;

        let layout: Layout;
        const commentIsInline =
            expr.data.comment == null || this.props.foldComments || this.state.hasListParent;
        if (isCallInline(this.t, args) && commentIsInline) {
            layout = hstack(TextMetrics.global.space.width, fnName, args);
            // This normally wouldn't matter but if we have a comment the vstack would add another
            // underline we don't want.
            layout.isUnderlined = !this.state.hasListParent;
            layout.inline = true;
        } else {
            layout = hstack(
                TextMetrics.global.space.width,
                fnName,
                vstack(
                    this.t.layout.lineSpacing,
                    args.map((x) => materialiseUnderlines(this.t, x)),
                ),
            );
        }
        return vstack(this.t.layout.lineSpacing, this.layoutComment(expr), layout);
    }
}

// Make sure to update argsEqual when adding or removing properties form this.
export interface LayoutProps {
    exprPropsFor?(expr: Expr): Partial<React.DOMAttributes<Element>>;
    ghost?: ExprId | null;
    focused?: boolean;
    highlights?: readonly [ExprId, Highlight][];
    foldComments?: boolean;
}

type LayoutExprArgs = [KaleTheme, Expr, LayoutProps | undefined];

function argsEquals(prev: LayoutExprArgs, next: LayoutExprArgs) {
    // Check the theme and expr.
    if (prev[0] !== next[0] || prev[1] !== next[1]) return false;
    // The props are identical, no need for the complex check. Might be undefined.
    if (prev[2] === next[2]) return true;

    const lhs = prev[2];
    const rhs = next[2];
    const quickCheck =
        lhs !== undefined &&
        rhs !== undefined &&
        lhs.exprPropsFor === rhs.exprPropsFor &&
        lhs.foldComments === rhs.foldComments &&
        lhs?.ghost === rhs?.ghost;
    if (!quickCheck) return false;

    // By the quickCheck the two exprs must be equal.
    const expr = next[1];
    // Check if either state has any blanks highlighted.
    function highlightsBlanks(part: LayoutProps) {
        if (part.highlights == null) return false;
        for (const pair of part.highlights) {
            if (expr.findId(pair[0]) instanceof E.Blank) return true;
        }
        return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return !highlightsBlanks(lhs!) && !highlightsBlanks(rhs!);
}

// Use the same reference each time if we don't pass props.
const emptyProps = {};
//TODO: One day implement this as a hook with useMemo now that ExprView is a functional component.
export default memoizeOne(
    function layoutExpr(theme: KaleTheme, expr: Expr, props?: LayoutProps): Layout {
        return materialiseUnderlines(
            theme,
            new ExprLayout(theme, props ?? emptyProps).layout(expr),
        );
    },
    // This library is badly typed.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    argsEquals as (lhs: any[], rhs: any[]) => boolean,
);
