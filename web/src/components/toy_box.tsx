import { useTheme } from "styled-components";
import React, { useState } from "react";

import * as E from "expr";
import { Stack, SubtleButton } from "components";
import { Category } from "vm/types";
import { groupEntries } from "utils";
import Builtins from "vm/builtins";
import Expr, { exprData } from "expr";

import ExprViewList, { ShortcutExpr } from "components/expr_view_list";
import Pane from "components/pane";

function createToyBox(): Readonly<{ [category in Category]: ShortcutExpr[] }> {
    function blank(comment: string) {
        return new E.Blank(E.exprData(comment));
    }

    const exprs: [Category, Expr][] = [
        [Category.General, new E.List([blank("First Line"), blank("Second Line")])],
        [Category.General, new E.Call("If", [blank("If True"), blank("If False")])],
        [Category.General, new E.Call("While", [blank("Condition"), blank("Do Something")])],
        [Category.General, new E.Call("Let", [new E.Variable("Variable"), blank("Value")])],
        [Category.General, new E.Call("Set", [new E.Variable("Variable"), blank("Value")])],
    ];
    for (const [fn, value] of Object.entries(Builtins)) {
        const { args, category } = value.value;
        if (category === undefined) continue;
        const blanks = args.map((x) => new E.Blank(exprData(x)));
        exprs.push([category, new E.Call(fn, blanks)]);
    }
    return groupEntries(exprs.map(([cat, expr]) => [cat, { expr }]));
}

const toyBoxExprs = createToyBox();
export default React.memo(function ToyBox() {
    const theme = useTheme();
    const [category, setCategory] = useState(Category.General);

    if (!theme.feature.toyBox) return null;
    return (
        <Pane gridArea="toybox" name="Blocks">
            <Stack gap={20} marginTop="">
                <Stack vertical gap={10} alignItems="end">
                    {Object.keys(Category).map((x) => (
                        <SubtleButton
                            key={x}
                            onClick={() => setCategory(x as Category)}
                            selected={x === category}
                        >
                            {x}
                        </SubtleButton>
                    ))}
                </Stack>
                <ExprViewList items={toyBoxExprs[category]} width={200} scale={0.9} />
            </Stack>
        </Pane>
    );
});
