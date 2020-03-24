import React from "react";

import { ExprAreaMap } from "expr_view";
import { Offset } from "geometry";
import { SvgRect, DebugRect } from "expr_view/components";

export default function SvgDebugOverlay({ areaMap }: { areaMap: ExprAreaMap }) {
    const exprs = Object.entries(areaMap).map(([exprId, area]) => (
        <>
            <SvgRect
                key={`e${exprId}`}
                rect={area.rect}
                fill="none"
                stroke={area.inline ? "blue" : "red"}
                opacity="0.7"
            />
            <text x={area.rect.x} y={area.rect.y + 5} fontSize="5">
                {area.expr.id}
            </text>
        </>
    ));

    const texts = Object.entries(areaMap)
        .filter((x) => x[1].text != null)
        .map(([exprId, area]) => (
            <DebugRect
                key={`t${exprId}`}
                origin={area.rect.origin.offset(area.text?.offset ?? Offset.zero)}
            />
        ));
    return <>{exprs.concat(texts)}</>;
}
