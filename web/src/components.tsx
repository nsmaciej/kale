import React, { ReactNode, SVGProps } from "react";
import styled from "styled-components";

import { Vec, Rect } from "./geometry";
import THEME from "./theme";

export interface LayoutProps {
    gridArea?: string;
}

type AlignTypes =
    | "start"
    | "end"
    | "center"
    | "baseline"
    | "stretch"
    | "normal";

type ContentAlignTypes =
    | AlignTypes
    | "space-between"
    | "space-around"
    | "space-evenly";

export interface StackProps {
    gap?: number;
    alignItems?: AlignTypes;
    justifyContent?: ContentAlignTypes;
}

export const Box = styled.div<LayoutProps>`
    ${p => p.gridArea && `grid-area: ${p.gridArea};`}
`;

const Stack = styled(Box)<StackProps & LayoutProps>`
    display: flex;
    overflow: auto;
    align-items: ${p => p.alignItems ?? "normal"};
    justify-content: ${p => p.justifyContent ?? "normal"};
`;

const getGap = (p: StackProps) => (p.gap ?? 0) / 2;

export const VerticalStack = styled(Stack)<StackProps & LayoutProps>`
    flex-direction: column;
    margin: -${getGap}px 0;
    & > * {
        margin: ${getGap}px 0;
    }
`;

export const HorizonstalStack = styled(Stack)<StackProps & LayoutProps>`
    flex-direction: row;
    margin: 0 -${getGap}px;
    & > * {
        margin: 0 ${getGap}px;
    }
`;

// A type for components that have custom props but pass everything else on.
type CustomSvgProps<Element, CustomProps> = CustomProps &
    Omit<SVGProps<Element>, keyof CustomProps>;

// Naming convention: generic svg components have the prefix Svg, bot established UI elements.
export function SvgGroup({
    children,
    translate = Vec.zero,
}: {
    children: ReactNode;
    translate?: Vec;
}) {
    return (
        <g transform={`translate(${translate.x} ${translate.y})`}>{children}</g>
    );
}

type LineProps = CustomSvgProps<SVGLineElement, { start: Vec; end: Vec }>;

export function SvgLine({
    start,
    end,
    stroke = "#000000",
    ...props
}: LineProps) {
    return (
        <line
            x1={start.x}
            x2={end.x}
            y1={start.y}
            y2={end.y}
            stroke={stroke}
            {...props}
        />
    );
}

export function UnderlineLine(
    props: Omit<LineProps, "shapeRendering" | "stroke" | "strokeWidth">,
) {
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
