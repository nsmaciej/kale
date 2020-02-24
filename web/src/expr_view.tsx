import React, {
    PureComponent,
    Component,
    ReactNode,
    useState,
    useCallback,
} from "react";
import ReactDOM from "react-dom";
import styled from "styled-components";

import { Optional, assert, max } from "./utils";
import { size, vec, Vector, Rect } from "./geometry";
import { Layout, hstack, vstack, Area } from "./layout";
import { Expr, ExprVisitor } from "./expr";
import * as E from "./expr";
import TextMetrics from "./text_metrics";
import { SvgGroup, UnderlineLine, SvgLine, SvgRect } from "./components";
import THEME from "./theme";
import { motion } from "framer-motion";

interface DragAndDropSurfaceContext {
    maybeStartDrag: (start: Vector, exprStart: Vector, expr: Expr) => void;
    dismissDrag: () => void;
}

interface DragAndDropSurfaceState {
    position: Optional<Vector>;
}

// There are three states to a drag.
// 1. Not dragging - drag and state.position is null.
// 2. Maybe-drag - drag is now initialised, except for delta.
// 3. Drag - Delta is now initialised, state.position follows the mouse.
export class DragAndDropSurface extends Component<{}, DragAndDropSurfaceState> {
    static readonly Svg = styled.svg`
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
    `;
    state: DragAndDropSurfaceState = { position: null };

    static readonly Context = React.createContext<
        Optional<DragAndDropSurfaceContext>
    >(null);

    private contextValue: DragAndDropSurfaceContext = {
        dismissDrag: this.dismissDrag.bind(this),
        maybeStartDrag: this.maybeStartDrag.bind(this),
    };
    private drag: Optional<{
        start: Vector; // Where the maybe-drag started.
        delta: Optional<Vector>; // How much to offset the expr when showing the drag.
        exprStart: Vector; // Page space coordinates of the expr.
        expr: Expr;
    }>;

    private maybeStartDrag(start: Vector, exprStart: Vector, expr: Expr) {
        this.drag = { start, expr, exprStart, delta: null };
    }

    private dismissDrag() {
        this.drag = null;
        // Premature optimisation. This method is called on every other mouse move.
        if (this.state.position != null) this.setState({ position: null });
    }

    private onMouseMove = (event: MouseEvent) => {
        // Ensure left mouse button is held down.
        if (event.buttons != 1 || this.drag == null) {
            this.dismissDrag();
            return;
        }

        const DRAG_THRESHOLD = 4; // Based on Windows default, DragHeight registry.
        const position = Vector.fromPage(event);
        if (this.drag.delta == null) {
            // Consider starting a drag.
            if (this.drag.start.distance(position) > DRAG_THRESHOLD) {
                this.drag.delta = this.drag.exprStart.difference(position);
                this.setState({ position });
            }
        } else {
            // Update a drag.
            this.setState({ position });
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

        if (this.drag?.delta != null) {
            // drag.delta gets set when the drag starts proper.
            assert(this.state.position != null);
            const { nodes } = new ExprLayoutHelper(null).layout(this.drag.expr);
            surface = ReactDOM.createPortal(
                <DragAndDropSurface.Svg
                    xmlns="http://www.w3.org/2000/svg"
                    onMouseUp={this.dismissDrag.bind(this)}
                >
                    <SvgGroup
                        translate={this.state.position.add(this.drag.delta)}
                    >
                        {nodes}
                    </SvgGroup>
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

interface ExprViewProps {
    expr: Expr;
    frozen?: boolean;
    selection?: Optional<Expr>;
    onClick?: (expr: Expr) => void;
    onClickCreateCircle?: (expr: Expr) => void;
}

interface ExprViewState {
    highlight: Optional<Expr>;
}

// This needs to be a class component so we can nicely pass it to the layout helper.
//TODO: Support a prop indicating if the view has focus. (Otherwise dim selection)
export default class ExprView extends PureComponent<
    ExprViewProps,
    ExprViewState
> {
    static contextType = DragAndDropSurface.Context;
    declare context: React.ContextType<typeof DragAndDropSurface.Context>;

    state: ExprViewState = { highlight: null };

    // Generic click action passed on using the props.
    onClick(event: React.MouseEvent, expr: Expr) {
        event.stopPropagation();
        assert(this.context != null);
        this.context.dismissDrag();
        this.props.onClick?.(expr);
    }

    onClickCreateCircle(event: React.MouseEvent, expr: Expr) {
        //TODO: Might make sense to have a better delegation mechanism.
        event.stopPropagation();
        this.props.onClickCreateCircle?.(expr);
    }

    // Chang the highlighted expr.
    onHover(event: React.MouseEvent, expr: Optional<Expr>) {
        event.stopPropagation();
        this.setState({ highlight: expr });
    }

    // Handler for the mousedown event.
    maybeStartDrag(event: React.MouseEvent, expr: Expr) {
        assert(event.type == "mousedown");
        if (event.buttons != 1) return;
        event.stopPropagation();
        assert(this.context != null);
        const rect = (event.target as SVGElement).getBoundingClientRect();
        this.context.maybeStartDrag(
            Vector.fromPage(event),
            //TODO: This only really works well for the top-left element of an expr. For example
            // this doesn't work for functions with comments on top of them, since the offset is
            // relative to the function name instead of the whole expression.
            Vector.fromBoundingRect(rect),
            expr,
        );
    }

    private findExprRect(expr: Expr, area: Area): Optional<Rect> {
        if (area.expr === expr) return area.rect;
        for (const child of area.children) {
            const rect = this.findExprRect(expr, child);
            if (rect != null) return rect.shift(area.rect.origin);
        }
        return null;
    }

    private drawRect(expr: Expr, area: Area, colour: string) {
        const rect = this.findExprRect(expr, area);
        // This happens when an expression is removed.
        if (rect == null) return null;
        return (
            <SvgRect
                rect={rect.pad(THEME.selectionPaddingPx)}
                rx={THEME.selectionRadiusPx}
                fill={colour}
            />
        );
    }

    render() {
        const padding = THEME.selectionPaddingPx;
        const groupShift = vec(padding, padding);
        const { nodes, size, areas } = materialiseUnderlines(
            new ExprLayoutHelper(this).layout(this.props.expr),
        );
        const { width, height } = size.pad(padding * 2);

        // Selection and highlight drawing logic.
        const area = {
            expr: this.props.expr,
            children: areas,
            rect: new Rect(groupShift, size),
        };
        const highlight = this.state.highlight;
        const selection = this.props.selection;
        let layers: ReactNode = null;
        if (highlight != null && selection != null && highlight !== selection) {
            // I don't like this code one bit. Might abstract it away at some point.
            if (selection.contains(highlight)) {
                layers = [
                    this.drawRect(selection, area, THEME.selectionColour),
                    this.drawRect(highlight, area, THEME.refineHighlightColour),
                ];
            } else {
                layers = [
                    this.drawRect(highlight, area, THEME.highlightColour),
                    this.drawRect(selection, area, THEME.selectionColour),
                ];
            }
        } else if (selection != null) {
            layers = this.drawRect(selection, area, THEME.selectionColour);
        } else if (highlight != null) {
            layers = this.drawRect(highlight, area, THEME.highlightColour);
        }

        return (
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width={width}
                height={height}
                // SVGs are inline by default, this leads to a scourge of invisible space
                // characters. Make it a block instead.
                display="block"
            >
                {layers}
                <SvgGroup translate={groupShift}>{nodes}</SvgGroup>
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

// See https://vanseodesign.com/web-design/svg-text-baseline-alignment/ for excellent discussion
// on SVG text aligment properties.
const Code = styled.text<{ cursor?: string }>`
    font-size: ${THEME.fontSizePx}px;
    font-family: ${THEME.fontFamily};
    dominant-baseline: text-before-edge;
    cursor: default;
`;

function useBind<A>(fn: (a: A) => void, arg: A): () => void {
    return useCallback(() => fn(arg), []);
}

function CreateCirlce({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
    const [hover, setHover] = useState(false);
    const r = THEME.createCircleR;
    const maxR = THEME.createCircleMaxR;
    const cx = r;
    const cy = THEME.fontSizePx / 2 + 3;
    return (
        <>
            <motion.circle
                fill="none"
                stroke={THEME.decorationColour}
                strokeWidth={1}
                animate={{ r: hover ? maxR : r }}
                r={r}
                cx={cx}
                cy={cy}
                transition={{ duration: 0.1 }}
            />
            <rect
                // This rect represents the real hit-box of the circle.
                onClick={onClick}
                fill="transparent"
                strokeWidth="0"
                width={maxR * 2}
                height={maxR * 2}
                y={cy - maxR}
                x={cx - maxR}
                onMouseEnter={useBind(setHover, true)}
                onMouseLeave={useBind(setHover, false)}
            />
        </>
    );
}

function materialiseUnderlines(parent: Layout) {
    const layout = parent.withNoUnderlines();
    const LINE_GAP = 3;
    for (const x of parent.underlines) {
        const pos = vec(x.offset, parent.size.height + x.level * LINE_GAP);
        layout.nodes.push(<UnderlineLine start={pos} end={pos.dx(x.length)} />);
    }
    return layout;
}

class ExprLayoutHelper implements ExprVisitor<Layout> {
    constructor(private readonly parentView: Optional<ExprView>) {}

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
            TextMetrics.global.measure(text, { italic, bold }),
        );
        layout.inline = true;
        return layout;
    }

    private layoutCreateCircle(expr: Expr) {
        if (this.parentView?.props.frozen) return;
        return new Layout(
            (
                <CreateCirlce
                    onClick={e => this.parentView?.onClickCreateCircle(e, expr)}
                />
            ),
            size(THEME.createCircleMaxR, THEME.fontSizePx),
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
        //TODO: Add a larger clickable area to the list ruler.
        const layout = vstack(
            THEME.lineSpacing,
            expr.list.map(x => materialiseUnderlines(this.layout(x))),
        );
        const ruler = (
            <SvgLine
                start={vec(3, 5)}
                end={vec(3, layout.size.height)}
                {...this.exprProps(expr)}
            />
        );
        return vstack(
            THEME.lineSpacing,
            this.layoutComment(expr),
            hstack(0, new Layout(ruler, size(10, 0)), layout),
        );
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
        const args = expr.args.map(this.layout, this);
        const inline = isCallInline(args);
        const inlineMargin = TextMetrics.global.measure("\xa0").width; // Non-breaking space.

        const comment = this.layoutComment(expr);
        const fnName = this.layoutText(expr, expr.fn, { bold: !inline });
        const createCirlce = this.layoutCreateCircle(expr);

        let layout: Layout;
        // Adding a comment makes a call non-inline but not bold.
        if (inline && expr.data.comment == null) {
            layout = hstack(inlineMargin, fnName, createCirlce, args);
            layout.isUnderlined = true;
            layout.inline = true;
        } else {
            layout = hstack(
                THEME.lineSpacing,
                fnName,
                createCirlce,
                vstack(THEME.lineSpacing, args.map(materialiseUnderlines)),
            );
        }
        return vstack(THEME.lineSpacing, comment, layout);
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
