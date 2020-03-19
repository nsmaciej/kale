import React from "react";
import { useTheme } from "styled-components";

import * as E from "expr";
import { Box, PaneHeading } from "components";
import ExprViewList from "components/expr_view_list";
import { Type } from "vm/types";

function blank(comment: string) {
    return new E.Blank(E.exprData(comment));
}

const toyBoxExprs = [
    { shortcut: "F", expr: new E.Call("Call") },
    { shortcut: "V", expr: new E.Variable("Variable") },
    { shortcut: "G", expr: new E.Literal("String", Type.Str) },
    { expr: new E.List([blank("first line"), blank("second line")]) },
    { expr: new E.Call("if", [blank("true branch"), blank("false branch")]) },
    { expr: new E.Literal("42", "int") },
];

export default React.memo(function ToyBox() {
    const theme = useTheme();
    if (!theme.feature.toyBox) return null;
    return (
        <Box gridArea="toybox" overflow="auto">
            <PaneHeading>Blocks</PaneHeading>
            <ExprViewList frozen items={toyBoxExprs} />
        </Box>
    );
});
