import React, { ReactNode, useState } from "react";
import styled from "styled-components";
import {
    SpaceProps,
    GridProps,
    FlexboxProps,
    LayoutProps,
    grid,
    space,
    layout,
    flexbox,
} from "styled-system";

import { Vec, Rect } from "./geometry";
import THEME from "./theme";

export type BoxProps = SpaceProps & GridProps & FlexboxProps & LayoutProps;
export const Box = styled.div<BoxProps>`
    ${space}
    ${grid}
    ${flexbox}
    ${layout}
`;

const getGap = (p: StackProps) => (p.gap ?? 0) / 2;
export interface StackProps extends BoxProps {
    gap?: number;
}
export const VerticalStack = styled(Box)`
    display: flex;
    flex-direction: column;
    margin: -${getGap}px 0;
    & > * {
        margin: ${getGap}px 0;
    }
`;
export const HorizonstalStack = styled(Box)`
    display: flex;
    flex-direction: row;
    margin: 0 -${getGap}px;
    & > * {
        margin: 0 ${getGap}px;
    }
`;

export const Shortcut = styled.kbd`
    display: inline;
    background-color: #eee;
    border-radius: 3px;
    border: 1px solid #cecece;
    box-shadow: 0 1px 1px #6b6b6b33;
    font-size: 0.85em;
    padding: 2px 4px;
    white-space: nowrap;
    font-family: inherit;
`;

// A type for components that have custom props but pass everything else on.
type CustomSvgProps<Element, CustomProps> = CustomProps &
    Omit<React.SVGProps<Element>, keyof CustomProps>;

// Naming convention: generic svg components have the prefix Svg, bot established UI elements.
export function SvgGroup({
    children,
    translate = Vec.zero,
}: {
    children: ReactNode;
    translate?: Vec;
}) {
    return <g transform={`translate(${translate.x} ${translate.y})`}>{children}</g>;
}

type LineProps = CustomSvgProps<SVGLineElement, { start: Vec; end: Vec }>;
export function SvgLine({ start, end, stroke = "#000000", ...props }: LineProps) {
    return <line x1={start.x} x2={end.x} y1={start.y} y2={end.y} stroke={stroke} {...props} />;
}

export function SvgRect({
    rect: { x, y, width, height },
    children,
    ...props
}: CustomSvgProps<SVGRectElement, { rect: Rect }> & { children?: ReactNode }) {
    return (
        <rect {...{ x, y, width, height }} {...props}>
            {children}
        </rect>
    );
}

export function UnderlineLine(props: Omit<LineProps, "shapeRendering" | "stroke" | "strokeWidth">) {
    // It took a while, but black, crispEdge, 0.5 stroke lines work well. They looks equally/ well
    // at full and half-pixel multiples; and look good on high-dpi screens.
    return (
        <SvgLine
            strokeWidth={0.5}
            shapeRendering="crsipEdges"
            stroke={THEME.decorationColour}
            {...props}
        />
    );
}

interface HitBoxProps<C> extends React.DOMAttributes<SVGRectElement> {
    children: C;
    title?: string;
    area: Rect;
}

export function HitBox({ children, area, title, ...rest }: HitBoxProps<ReactNode>) {
    return (
        <>
            {children}
            <SvgRect rect={area} fill="transparent" strokeWidth="0" {...rest}>
                {title && <title>{title}</title>}
            </SvgRect>
        </>
    );
}

// Same idea as above, but with function as children.
export function HoverHitBox({
    children,
    area,
    title,
    onMouseEnter,
    onMouseLeave,
    ...rest
}: HitBoxProps<(hover: boolean) => void>) {
    const [hover, setHover] = useState(false);
    const mouseEnter = (e: React.MouseEvent<SVGRectElement>) => {
        setHover(true);
        onMouseEnter?.(e);
    };
    const mouseLeave = (e: React.MouseEvent<SVGRectElement>) => {
        setHover(false);
        onMouseLeave?.(e);
    };
    return (
        <>
            {children(hover)}
            <SvgRect
                rect={area}
                fill="transparent"
                strokeWidth="0"
                onMouseEnter={mouseEnter}
                onMouseLeave={mouseLeave}
                {...rest}
            >
                {title && <title>{title}</title>}
            </SvgRect>
        </>
    );
}
