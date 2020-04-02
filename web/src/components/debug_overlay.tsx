import React, { useState } from "react";

import { Area } from "expr_view/core";
import { Offset, Rect, Size } from "geometry";
import { SvgRect, DebugRect } from "expr_view/components";
import { useUsesDarkTheme } from "contexts/theme";

export default function SvgDebugOverlay({ area }: { area: Area }) {
    const darkTheme = useUsesDarkTheme();
    const [onlyGaps, setOnlyGaps] = useState(false);
    function text(rect: Rect, content: number | string) {
        return (
            <text
                x={rect.x + 1}
                y={rect.y + rect.height - 1}
                fontSize={7}
                fill={darkTheme ? "white" : "black"}
            >
                {content}
            </text>
        );
    }

    function renderArea(subArea: Area, origin: Offset): JSX.Element | null {
        const rect = subArea.rect.shift(origin);
        if (subArea.kind === "gap") {
            return (
                <>
                    <SvgRect rect={rect} fill="none" stroke="green" opacity={0.7} />
                    {text(rect, subArea.expr.id)}
                </>
            );
        }
        return (
            <>
                {onlyGaps || (
                    <SvgRect
                        rect={rect}
                        fill="none"
                        stroke={subArea.inline ? "blue" : "red"}
                        opacity="0.7"
                    />
                )}
                {onlyGaps || text(rect, subArea.expr.id)}
                {subArea.text != null && (
                    <DebugRect origin={rect.origin.offset(subArea.text?.offset ?? Offset.zero)} />
                )}
                {subArea.children.map((x) => renderArea(x, rect.origin))}
            </>
        );
    }

    return (
        <>
            <SvgRect
                rect={new Rect(Offset.zero, new Size(5))}
                fill="purple"
                onClick={() => setOnlyGaps((x) => !x)}
            />
            {renderArea(area, Offset.zero)}
        </>
    );
}
