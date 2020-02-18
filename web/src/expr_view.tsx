import React, { PureComponent, ReactNode, Component } from "react";
import ReactDOM from "react-dom";
import styled from "styled-components";

import { Optional, assert, max } from "./utils";
import { Size, size, vec, Vector } from "./geometry";
import {
    ExprLayout,
    Underline,
    Layout,
    Line,
    place,
    toExprLayout,
    underline,
    stackHorizontal,
    stackVertical,
    Group,
} from "./layout";
import { Expr, ExprVisitor } from "./expr";
import * as E from "./expr";
import TextMetrics from "./text_metrics";

export const KALE_THEME = {
    fontSizePx: 13,
    fontFamily: "iA Writer Quattro",
    //TODO: This should be based on the current text size.
    lineSpacing: 10,
    underlineColour: "#6a6a6a",
    selectionColour: "#d0e8fc",
    highlightColour: "#eeeeee",
    refineHighlightColour: "#94bcff",
    variableColour: "#248af0",
    literalColour: "#f59a11",
    holeColour: "#ff0000",
    // This also needs to be large enough to allow bottom-most underlines to render.
    selectionPaddingPx: 5,
    selectionRadiusPx: 3,
};

interface ExprViewProps {
    expr: Expr;
    frozen?: boolean;
    selection?: Optional<Expr>;
    onClick?: (expr: Expr) => void;
}

interface ExprViewState {
    hoverHighlight: Optional<Expr>;
}

interface DragAndDropSurfaceContext {
    maybeStartDrag: (start: Vector, expr: Expr) => void;
    dismissDrag: () => void;
}

interface DragAndDropSurfaceState {
    expr: Optional<Expr>;
    position: Optional<Vector>;
}

export class DragAndDropSurface extends Component<{}, DragAndDropSurfaceState> {
    static readonly Svg = styled.svg`
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
    `;
    state: DragAndDropSurfaceState = { expr: null, position: null };

    static readonly Context = React.createContext<
        Optional<DragAndDropSurfaceContext>
    >(null);

    private contextValue: DragAndDropSurfaceContext = {
        dismissDrag: this.dismissDrag.bind(this),
        maybeStartDrag: this.maybeStartDrag.bind(this),
    };
    private dragStart: Optional<Vector>;
    private dragExpr: Optional<Expr>;

    private maybeStartDrag(position: Vector, expr: Expr) {
        this.dragStart = position;
        this.dragExpr = expr;
    }

    private dismissDrag() {
        console.log(this.state);
        this.dragStart = null;
        this.dragExpr = null;
        if (this.state.expr != null) {
            // Premature optimisation. This method is called on every other mouse move.
            this.setState({ expr: null, position: null });
        }
    }

    private onMouseMove = (event: MouseEvent) => {
        const DRAG_THRESHOLD = 20;
        const position = Vector.fromPage(event);
        if (event.buttons != 1) {
            // Just a random mouse mouse move with no buttons.
            this.dismissDrag();
        } else if (this.state.expr != null) {
            // We are dragging, update the position
            this.setState({ position });
        } else if (
            this.dragStart != null &&
            this.dragStart.distance(position) > DRAG_THRESHOLD
        ) {
            // Start a new drag.
            this.setState({ position, expr: this.dragExpr });
        }
    };

    componentDidMount() {
        document.addEventListener("mousemove", this.onMouseMove);
    }

    componentWillUnmount() {
        document.removeEventListener("mousemove", this.onMouseMove);
    }

    render() {
        let surface: React.ReactNode;

        if (this.state.expr != null) {
            assert(this.state.position != null);
            const { nodes } = new ExprLayoutHelper(null, {
                hasSelectedParant: false,
            }).layout(this.state.expr);
            surface = ReactDOM.createPortal(
                <DragAndDropSurface.Svg
                    xmlns="http://www.w3.org/2000/svg"
                    onMouseUp={this.dismissDrag.bind(this)}
                >
                    <Group translate={this.state.position}>{nodes}</Group>
                </DragAndDropSurface.Svg>,
                document.body,
            );
        }

        return (
            <DragAndDropSurface.Context.Provider value={this.contextValue}>
                {surface}
                {this.props.children}
            </DragAndDropSurface.Context.Provider>
        );
    }
}

// This needs to be a class component so we can nicely pass it to the layout helper.
//TODO: Support a prop indicating if the view has focus. (Otherwise dim selection)
export default class ExprView extends PureComponent<
    ExprViewProps,
    ExprViewState
> {
    static contextType = DragAndDropSurface.Context;
    declare context: React.ContextType<typeof DragAndDropSurface.Context>;

    state: ExprViewState = { hoverHighlight: null };

    onClick(event: React.MouseEvent, expr: Expr) {
        event.stopPropagation();
        assert(this.context != null);
        this.context.dismissDrag();
        this.props.onClick?.(expr);
    }

    //TODO: This is unreliable because React removes the original node when we add the highlight
    // rect. Solution is either pre-create all the rects, or likely better for z-index: make
    // ExprLayout return selection bounds.
    onHover(event: React.MouseEvent, expr: Optional<Expr>) {
        event.stopPropagation();
        this.setState({ hoverHighlight: expr });
    }

    maybeStartDrag(event: React.MouseEvent, expr: Expr) {
        assert(event.type == "mousedown");
        if (event.buttons != 1) return;
        event.stopPropagation();
        assert(this.context != null);
        this.context.maybeStartDrag(Vector.fromPage(event), expr);
    }

    render() {
        const { nodes, size } = new ExprLayoutHelper(this, {
            hasSelectedParant: false,
        }).layout(this.props.expr);
        const { width, height } = size.pad(KALE_THEME.selectionPaddingPx * 2);
        const padding = vec(
            KALE_THEME.selectionPaddingPx,
            KALE_THEME.selectionPaddingPx,
        );
        return (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width={width}
                height={height}
                // SVGs are inline by default, this leads to a scourge of invisible space
                // characters. Make it a block instead.
                display="block"
            >
                <Group translate={padding}>{nodes}</Group>
            </svg>
        );
    }
}

interface TextProperties {
    italic?: boolean;
    bold?: boolean;
    colour?: string;
    title?: string;
}

export class LayoutNotSupported extends Error {}

// See https://vanseodesign.com/web-design/svg-text-baseline-alignment/ for excellent discussion
// on SVG text aligment properties.
const Code = styled.text<{ cursor?: string }>`
    font-size: ${KALE_THEME.fontSizePx}px;
    font-family: ${KALE_THEME.fontFamily};
    dominant-baseline: text-before-edge;
    cursor: default;
    user-select: none;
`;

interface ExprLayoutParams {
    hasSelectedParant: boolean;
}

class ExprLayoutHelper implements ExprVisitor<ExprLayout> {
    private childParams: ExprLayoutParams;
    constructor(
        private readonly parentView: Optional<ExprView>,
        private readonly params: ExprLayoutParams,
    ) {
        this.childParams = { ...params };
    }

    private layoutText(
        expr: Expr,
        text: string,
        { italic, colour, title, bold }: TextProperties = {},
    ): ExprLayout {
        const size = TextMetrics.global.measure(text);
        return {
            size,
            nodes: (
                <Code
                    fill={colour}
                    fontStyle={italic ? "italic" : undefined}
                    fontWeight={bold ? "bold" : undefined}
                    onClick={e => this.parentView?.onClick(e, expr)}
                    onMouseDown={e => this.parentView?.maybeStartDrag(e, expr)}
                    onMouseOver={e => this.parentView?.onHover(e, expr)}
                    onMouseOut={e => this.parentView?.onHover(e, null)}
                >
                    {title && <title>{title}</title>}
                    {text}
                </Code>
            ),
            underlines: null,
            inline: true,
        };
    }

    layout(expr: Expr): ExprLayout {
        // Set up child params.
        const selected = this.parentView?.props.selection === expr;
        //TODO: Hack, if we have no parent we are highlighted.
        const highlighted =
            this.parentView == null
                ? true
                : this.parentView.state.hoverHighlight === expr;
        this.childParams.hasSelectedParant =
            this.params.hasSelectedParant || selected;

        // Layout the expr.
        const layout = expr.visit(this);
        if (selected || highlighted) {
            const { size, inline, underlines, nodes: layoutNodes } = layout;
            const padding = KALE_THEME.selectionPaddingPx;
            const nodes = (
                <>
                    <rect
                        x={-padding}
                        y={-padding}
                        width={size.width + padding * 2}
                        height={size.height + padding * 2}
                        rx={KALE_THEME.selectionRadiusPx}
                        fill={
                            selected
                                ? KALE_THEME.selectionColour
                                : this.params.hasSelectedParant
                                ? KALE_THEME.refineHighlightColour
                                : KALE_THEME.highlightColour
                        }
                    />
                    {layoutNodes}
                </>
            );
            return { size, inline, underlines, nodes };
        }
        return layout;
    }

    visitList(expr: E.List): ExprLayout {
        //TODO: Add a larger clickable area to the list ruler.
        if (expr.data.comment)
            throw new LayoutNotSupported("List comments are not yet supported");
        let listSize = Size.zero;
        let nodes: ReactNode[] = [];
        const layoutHelper = new ExprLayoutHelper(
            this.parentView,
            this.childParams,
        );
        for (const line of expr.list) {
            const layout = layoutHelper.layout(line);
            const pos = listSize.bottom_left.dy(
                // Skip first line.
                listSize.height ? KALE_THEME.lineSpacing : 0,
            );
            if (layout.underlines !== null) {
                nodes.push(
                    place(
                        pos.dy(KALE_THEME.fontSizePx + 5),
                        layoutUnderlines(layout.underlines, true),
                        "underlines",
                        line.id,
                    ),
                );
            }
            nodes.push(place(pos, layout, "line", line.id));
            listSize = listSize.extend(pos, layout.size);
        }

        const ruler = {
            size: size(10, 0),
            nodes: (
                <Line
                    start={vec(3, 5)}
                    end={vec(3, listSize.height)}
                    onClick={e => this.parentView?.onClick(e, expr)}
                    onMouseOver={e => this.parentView?.onHover(e, expr)}
                    onMouseOut={e => this.parentView?.onHover(e, null)}
                />
            ),
        };
        return toExprLayout(
            stackHorizontal(0, ruler, { nodes, size: listSize }),
        );
    }

    visitLiteral(expr: E.Literal): ExprLayout {
        const content =
            expr.type === "str" ? `"${expr.content}"` : expr.content;
        return this.layoutText(expr, content, {
            title: expr.data.comment,
            colour: KALE_THEME.literalColour,
        });
    }

    visitVariable(expr: E.Variable): ExprLayout {
        return this.layoutText(expr, expr.name, {
            title: expr.data.comment,
            colour: KALE_THEME.variableColour,
        });
    }

    visitHole(expr: E.Hole): ExprLayout {
        //TODO: Wrap this in a nice box or something.
        return this.layoutText(expr, `<${expr.data.comment ?? "HOLE"}>`, {
            colour: KALE_THEME.holeColour,
        });
    }

    visitCall(expr: E.Call): ExprLayout {
        //TODO: Add the comment back.
        const layoutHelper = new ExprLayoutHelper(
            this.parentView,
            this.childParams,
        );
        const args = expr.args.map(x => layoutHelper.layout(x));
        //FIXME: This forces top-level call underlines to materialise, find a nicer way to do this.
        const inline =
            isCallInline(args) && expr !== this.parentView?.props.expr;
        const inlineMargin = TextMetrics.global.measure("\xa0").width; // Non-breaking space.
        const fnName = this.layoutText(expr, expr.fn, { bold: !inline });
        assert(fnName.inline);

        if (inline) {
            const underlines: [number, Underline][] = [];
            const nodes: ReactNode[] = [];
            let size = Size.zero;

            let i = 0;
            for (const arg of args) {
                // Skip adding the margin to the first argument.
                const pos = size.top_right.dx(size.width ? inlineMargin : 0);
                nodes.push(place(pos, arg, "arg", expr.args[i].id));
                if (arg.underlines)
                    // Sadly we have to account for the size of fnName straight away.
                    underlines.push([
                        pos.x + fnName.size.width + inlineMargin,
                        arg.underlines,
                    ]);
                size = size.extend(pos, arg.size);
                i++;
            }
            return underline(
                args.length > 0
                    ? stackHorizontal(inlineMargin, fnName, { nodes, size })
                    : fnName,
                underlines,
            );
        }

        const argStack = stackVertical(
            KALE_THEME.lineSpacing,
            ...args.map((arg, ix) => {
                // Materialise all underlines.
                if (!arg.underlines) return arg;
                const underlines = place(
                    vec(0, KALE_THEME.fontSizePx + 5),
                    layoutUnderlines(arg.underlines),
                    "underlines",
                    expr.args[ix].id,
                );
                return {
                    size: arg.size,
                    nodes: (
                        <>
                            {arg.nodes}
                            {underlines}
                        </>
                    ),
                };
            }),
        );
        return toExprLayout(stackHorizontal(inlineMargin, fnName, argStack));
    }
}

function underlineTreeHeight(underline: null | Underline): number {
    return underline === null
        ? 0
        : 1 + max(underline.children.map(x => underlineTreeHeight(x[1])));
}

function layoutUnderlines(underline: Underline, skipFirst = false): Layout {
    function layout(
        level: number,
        ix: number,
        underline: Underline,
        pos: Vector,
    ): ReactNode {
        // It took a while, but black, crispEdge, 0.5 stroke lines work well. They looks equally
        // well at full and half-pixel multiples; and look good on high-dpi screens.
        const drawn = level > 0 || !skipFirst;
        return (
            <React.Fragment key={ix}>
                {drawn && (
                    <Line
                        start={pos}
                        end={pos.dx(underline.width)}
                        strokeWidth={0.5}
                        shapeRendering="crispEdges"
                        stroke={KALE_THEME.underlineColour}
                    />
                )}
                {underline.children.map(([offset, next], ix) =>
                    layout(
                        level + 1,
                        ix,
                        next,
                        pos.dx(offset).dy(drawn ? 3 : 0),
                    ),
                )}
            </React.Fragment>
        );
    }
    return {
        nodes: layout(0, 0, underline, Vector.zero),
        size: size(underline.width, 1),
    };
}

function isCallInline(args: readonly ExprLayout[]): boolean {
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
    const LINE_BREAK_POINT = 200;
    const lineWidth = args.map(x => x.size.width).reduce((x, y) => x + y, 0);
    if (lineWidth > LINE_BREAK_POINT && args.length > 0) {
        return false;
    }

    // Is the expression too nested?
    const underlineHeights = args.map(x => underlineTreeHeight(x.underlines));
    const MAX_NESTING_LEVEL = 3;
    return max(underlineHeights) < MAX_NESTING_LEVEL;
}
