import React, { ReactNode, useState } from "react";

import { Offset, Rect } from "geometry";
import { useTheme } from "styled-components";

// A type for components that have custom props but pass everything else on.
type CustomSvgProps<Element, CustomProps> = CustomProps &
    Omit<React.SVGProps<Element>, keyof CustomProps>;

// Naming convention: generic svg components have the prefix Svg, bot established UI elements.
export function SvgGroup({
    children,
    translate = Offset.zero,
}: {
    children: ReactNode;
    translate?: Offset;
}) {
    return <g transform={`translate(${translate.x} ${translate.y})`}>{children}</g>;
}

type LineProps = CustomSvgProps<SVGLineElement, { start: Offset; end: Offset }>;
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
    // It took a while, but black, crispEdge, 0.5 stroke lines work well. They looks equally well
    // at full and half-pixel multiples; and look good on high-dpi screens.
    const theme = useTheme();
    return (
        <SvgLine
            strokeWidth={0.5}
            shapeRendering="crsipEdges"
            stroke={theme.decorationColour}
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
