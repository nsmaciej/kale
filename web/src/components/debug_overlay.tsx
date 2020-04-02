import React, { useState, Fragment } from "react";

import { Area } from "expr_view/core";
import { Offset, Rect } from "geometry";
import { SvgRect, DebugRect } from "expr_view/components";
import { useUsesDarkTheme } from "contexts/theme";

export default function SvgDebugOverlay({ area }: { area: Area }) {
    const darkTheme = useUsesDarkTheme();
    const [showAreas, setShowAreas] = useState(true);
    const [showGaps, setShowGaps] = useState(false);
    const [showIds, setShowIds] = useState(false);
    function text(rect: Rect, content: number | string) {
        if (!showIds) return null;
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
        const key = subArea.expr.id;
        if (subArea.kind === "gap") {
            if (!showGaps) return null;
            return (
                <Fragment key={`gap-${key}`}>
                    <SvgRect rect={rect} fill="none" stroke="green" opacity={0.7} />
                    {text(rect, subArea.expr.id)}
                </Fragment>
            );
        }
        return (
            <Fragment key={`expr-${key}`}>
                {showAreas && (
                    <SvgRect
                        rect={rect}
                        fill="none"
                        stroke={subArea.inline ? "blue" : "red"}
                        opacity="0.7"
                    />
                )}
                {showAreas && text(rect, subArea.expr.id)}
                {subArea.text != null && (
                    <DebugRect origin={rect.origin.offset(subArea.text?.offset ?? Offset.zero)} />
                )}
                {subArea.children.map((x) => renderArea(x, rect.origin))}
            </Fragment>
        );
    }

    function renderButton(
        rank: number,
        type: string,
        setState: (updater: (old: boolean) => boolean) => void,
    ) {
        return (
            <text
                fontSize={10}
                y={10 + rank * 15}
                x={area.rect.width + area.rect.x}
                textAnchor="end"
                key={type}
                onClick={(e) => {
                    e.stopPropagation();
                    setState((x) => !x);
                }}
            >
                Toggle {type}
            </text>
        );
    }

    return (
        <>
            {renderArea(area, Offset.zero)}
            {renderButton(0, "Gaps", setShowGaps)}
            {renderButton(1, "IDs", setShowIds)}
            {renderButton(2, "Areas", setShowAreas)}
        </>
    );
}
