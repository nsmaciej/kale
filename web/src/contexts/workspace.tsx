import React, { Component } from "react";

import Expr, { Blank } from "expr";
import { Optional } from "utils";
import * as Samples from "sample";

export type TopLevel = { [name: string]: Expr };

export type WorkspaceValue = WorkspaceProvider["state"];
export const Workspace = React.createContext<Optional<WorkspaceValue>>(null);

export class WorkspaceProvider extends Component<{}, WorkspaceProvider["state"]> {
    state = {
        topLevel: { "Sample 1": Samples.SAMPLE_1, "Sample 2": Samples.SAMPLE_2 } as TopLevel,
        removeTopLevel: (name: string) => {
            this.setState(state => {
                const cloned = Object.assign({}, state.topLevel);
                delete cloned[name];
                return { topLevel: cloned };
            });
        },
        setTopLevel: (name: string, update: (expr: Expr) => Expr) => {
            this.setState(({ topLevel }) => ({
                topLevel: { ...topLevel, [name]: update(topLevel[name]) },
            }));
        },
        getTopLevel: (name: string): Expr => {
            if (Object.prototype.hasOwnProperty.call(this.state.topLevel, name)) {
                return this.state.topLevel[name];
            }
            const blank = new Blank();
            this.state.setTopLevel(name, () => blank);
            return blank;
        },
    };
    render() {
        return <Workspace.Provider value={this.state}>{this.props.children}</Workspace.Provider>;
    }
}
