import { useTheme } from "styled-components";
import React from "react";

import * as E from "expr";
import { Box, PaneHeading } from "components";
import { Type } from "vm/types";
import Builtins from "vm/builtins";
import Expr, { exprData } from "expr";
import ExprViewList, { ShortcutExpr } from "components/expr_view_list";

function createToyBox(): readonly ShortcutExpr[] {
    function blank(comment: string) {
        return new E.Blank(E.exprData(comment));
    }

    const exprs: Expr[] = [
        new E.List([blank("First Line"), blank("Second Line")]),
        new E.Call("If", [blank("If True"), blank("If False")]),
        new E.Call("While", [blank("Condition"), blank("Do Something")]),
        new E.Call("Let", [new E.Variable("Variable"), blank("Value")]),
        new E.Call("Set", [new E.Variable("Variable"), blank("Value")]),
    ];
    for (const [fn, value] of Object.entries(Builtins)) {
        const args = value.value.args.map(x => new E.Blank(exprData(x)));
        exprs.push(new E.Call(fn, args));
    }
    return exprs.map(expr => ({ expr }));
}

const toyBoxExprs = createToyBox();
export default React.memo(function ToyBox() {
    const theme = useTheme();
    if (!theme.feature.toyBox) return null;
    return (
        <Box gridArea="toybox" overflow="auto">
            <PaneHeading>Blocks</PaneHeading>
            <ExprViewList items={toyBoxExprs} />
        </Box>
    );
});
