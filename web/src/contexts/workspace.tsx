import React, { Component } from "react";

import Expr, { Blank } from "expr";
import { Optional, assertSome, assert } from "utils";
import { Type, Value, Func, Workspace as InterpterWorkspace, Builtin } from "vm/types";
import Builtins from "vm/builtins";
import * as Sample from "sample";

export type WorkspaceValue = WorkspaceProvider["state"];
export const Workspace = React.createContext<Optional<WorkspaceValue>>(null);

function asFunc(expr: Expr): Value<Func> {
    return { type: Type.Func, value: { expr, scope: null, args: [] } };
}

export class WorkspaceProvider extends Component<{}, WorkspaceProvider["state"]> {
    state = {
        topLevel: new Map() as InterpterWorkspace,
        // This helps useSuggestions to not run as much, keys aren't reference stable.
        functionList: [] as string[],
        removeTopLevel: (name: string) => {
            this.setState(state => {
                const topLevel = new Map(state.topLevel);
                topLevel.delete(name);
                return { topLevel };
            });
            this.syncFunctionList();
        },

        setTopLevel: (name: string, update: (expr: Expr) => Expr) => {
            this.setState(state => {
                const maybeFunc = assertSome(state.topLevel.get(name));
                assert(maybeFunc.type === Type.Func, "Cannot edit builtins");
                const topLevel = new Map(state.topLevel);
                topLevel.set(name, asFunc(update((maybeFunc.value as Func).expr)));
                return { topLevel };
            });
        },

        getTopLevel: (name: string): Value<Func | Builtin> => {
            const func = this.state.topLevel.get(name);
            if (func != null) {
                return func;
            }
            const blank = new Blank();
            this.setState(state => {
                const topLevel = new Map(state.topLevel);
                topLevel.set(name, asFunc(blank));
                return { topLevel };
            });
            this.syncFunctionList();
            return asFunc(blank);
        },
    };

    private syncFunctionList() {
        this.setState(state => ({
            functionList: Array.from(state.topLevel.keys()),
        }));
    }

    componentDidMount() {
        this.syncFunctionList();
    }

    constructor(props: {}) {
        super(props);
        const topLevel: Map<string, Value<Builtin | Func>> = new Map([
            ["Sample-1", asFunc(Sample.SAMPLE_1)],
            ["Sample-2", asFunc(Sample.SAMPLE_2)],
            ["Hello-World", asFunc(Sample.HELLO_WORLD)],
        ]);
        for (const [name, builtin] of Object.entries(Builtins)) {
            topLevel.set(name, builtin);
        }
        this.state.topLevel = topLevel;
    }

    render() {
        return <Workspace.Provider value={this.state}>{this.props.children}</Workspace.Provider>;
    }
}
