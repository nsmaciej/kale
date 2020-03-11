import React, { Component } from "react";

import Expr, { Blank } from "expr";
import { Optional, assertSome } from "utils";
import { Func, Workspace as InterpterWorkspace } from "vm/types";
import * as Sample from "sample";

export type WorkspaceValue = WorkspaceProvider["state"];
export const Workspace = React.createContext<Optional<WorkspaceValue>>(null);

function asFunc(expr: Expr): Func {
    return { expr, scope: null, args: [] };
}

export class WorkspaceProvider extends Component<{}, WorkspaceProvider["state"]> {
    state = {
        topLevel: new Map([
            ["Sample 1", asFunc(Sample.SAMPLE_1)],
            ["Sample 2", asFunc(Sample.SAMPLE_2)],
            ["Hello World", asFunc(Sample.HELLO_WORLD)],
        ]) as InterpterWorkspace,
        removeTopLevel: (name: string) => {
            this.setState(state => {
                const topLevel = new Map(state.topLevel);
                topLevel.delete(name);
                return { topLevel };
            });
        },
        setTopLevel: (name: string, update: (expr: Expr) => Expr) => {
            this.setState(state => {
                const topLevel = new Map(state.topLevel);
                topLevel.set(name, asFunc(update(assertSome(topLevel.get(name)).expr)));
                return { topLevel };
            });
        },
        getTopLevel: (name: string): Expr => {
            const func = this.state.topLevel.get(name);
            if (func != null) {
                return func.expr;
            }
            const blank = new Blank();
            this.setState(state => {
                const topLevel = new Map(state.topLevel);
                topLevel.set(name, asFunc(blank));
                return { topLevel };
            });
            return blank;
        },
    };
    render() {
        return <Workspace.Provider value={this.state}>{this.props.children}</Workspace.Provider>;
    }
}
