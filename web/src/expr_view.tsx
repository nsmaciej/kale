import React, { PureComponent, ReactNode, Component } from "react";
import ReactDOM from "react-dom";
import styled from "styled-components";

import { Optional, assert, max } from "./utils";
import { size, vec, Vector } from "./geometry";
import { Layout, hstack, vstack } from "./layout";
import { Expr, ExprVisitor } from "./expr";
import * as E from "./expr";
import TextMetrics from "./text_metrics";
import { Group, UnderlineLine, Line } from "./components";
import THEME from "./theme";

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
        const { nodes, size } = materialiseUnderlines(
            new ExprLayoutHelper(this, {
                hasSelectedParant: false,
            }).layout(this.props.expr),
        );
        const { width, height } = size.pad(THEME.selectionPaddingPx * 2);
        const padding = vec(THEME.selectionPaddingPx, THEME.selectionPaddingPx);
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
    font-size: ${THEME.fontSizePx}px;
    font-family: ${THEME.fontFamily};
    dominant-baseline: text-before-edge;
    cursor: default;
    user-select: none;
`;

interface ExprLayoutParams {
    hasSelectedParant: boolean;
}

function materialiseUnderlines(parent: Layout) {
    const layout = parent.copy();
    const LINE_GAP = 3;
    for (const x of parent.underlines) {
        const pos = vec(x.offset, parent.size.height + x.level * LINE_GAP);
        layout.nodes.push(<UnderlineLine start={pos} end={pos.dx(x.length)} />);
    }
    return layout;
}

class ExprLayoutHelper implements ExprVisitor<Layout> {
    private childParams: ExprLayoutParams;
    constructor(
        private readonly parentView: Optional<ExprView>,
        private readonly params: ExprLayoutParams,
    ) {
        this.childParams = { ...params };
    }

    private exprProps(expr: Expr) {
        return {
            onMouseEnter: (e: React.MouseEvent) =>
                this.parentView?.onHover(e, expr),
            onMouseLeave: (e: React.MouseEvent) =>
                this.parentView?.onHover(e, null),
            onClick: (e: React.MouseEvent) => this.parentView?.onClick(e, expr),
            onMouseDown: (e: React.MouseEvent) =>
                this.parentView?.maybeStartDrag(e, expr),
        };
    }

    private layoutText(
        expr: Expr,
        text: string,
        { italic, colour, title, bold }: TextProperties = {},
    ) {
        const layout = new Layout(
            (
                <Code
                    fill={colour}
                    fontStyle={italic ? "italic" : undefined}
                    fontWeight={bold ? "bold" : undefined}
                    {...this.exprProps(expr)}
                >
                    {title && <title>{title}</title>}
                    {text}
                </Code>
            ),
            TextMetrics.global.measure(text),
        );
        layout.inline = true;
        return layout;
    }

    layout(expr: Expr): Layout {
        const selected = this.parentView?.props.selection === expr;
        //TODO: Hack, if we have no parent we are highlighted.
        const highlighted =
            this.parentView == null
                ? true
                : this.parentView.state.hoverHighlight === expr;
        this.childParams.hasSelectedParant =
            this.params.hasSelectedParant || selected;

        const layout = expr.visit(this);
        const padding = THEME.selectionPaddingPx;
        const fill = selected
            ? THEME.selectionColour
            : this.params.hasSelectedParant
            ? THEME.refineHighlightColour
            : THEME.highlightColour;
        const rect = (
            <rect
                x={-padding}
                y={-padding}
                width={layout.size.width + padding * 2}
                height={layout.size.height + padding * 2}
                rx={THEME.selectionRadiusPx}
                //TODO: Do not render the selection rect inline.
                visibility={selected || highlighted ? "visible" : "hidden"}
                fill={fill}
            />
        );
        layout.place(Vector.zero, new Layout(rect), 0);
        return layout;
    }

    visitList(expr: E.List): Layout {
        //TODO: Add a larger clickable area to the list ruler.
        if (expr.data.comment)
            throw new LayoutNotSupported("List comments are not yet supported");
        const layoutHelper = new ExprLayoutHelper(
            this.parentView,
            this.childParams,
        );
        const layout = vstack(
            THEME.lineSpacing,
            expr.list.map(x => materialiseUnderlines(layoutHelper.layout(x))),
        );
        const ruler = (
            <Line
                start={vec(3, 5)}
                end={vec(3, layout.size.height)}
                {...this.exprProps(expr)}
            />
        );
        return hstack(0, new Layout(ruler, size(10, 0)), layout);
    }

    visitLiteral(expr: E.Literal): Layout {
        const content =
            expr.type === "str" ? `"${expr.content}"` : expr.content;
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
        //TODO: Wrap this in a nice box or something.
        return this.layoutText(expr, `<${expr.data.comment ?? "HOLE"}>`, {
            colour: THEME.holeColour,
        });
    }

    visitCall(expr: E.Call): Layout {
        //TODO: Add the comment back.
        const layoutHelper = new ExprLayoutHelper(
            this.parentView,
            this.childParams,
        );
        const args = expr.args.map(x => layoutHelper.layout(x));
        const inline = isCallInline(args);
        const inlineMargin = TextMetrics.global.measure("\xa0").width; // Non-breaking space.
        const fnName = this.layoutText(expr, expr.fn, { bold: !inline });

        if (inline) {
            const layout = hstack(inlineMargin, fnName, args);
            layout.isUnderlined = true;
            layout.inline = true;
            return layout;
        }

        return hstack(
            THEME.lineSpacing,
            fnName,
            vstack(THEME.lineSpacing, args.map(materialiseUnderlines)),
        );
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
    const LINE_BREAK_POINT = 200;
    const lineWidth = args.map(x => x.size.width).reduce((x, y) => x + y, 0);
    if (lineWidth > LINE_BREAK_POINT && args.length > 0) {
        return false;
    }
    // Is the expression too nested?
    const underlinesHeight = max(args.map(x => x.underlinesHeight()));
    const MAX_NESTING_LEVEL = 3;
    return underlinesHeight < MAX_NESTING_LEVEL;
}
