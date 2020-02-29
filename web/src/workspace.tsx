import React, { ReactNode, Component, useState } from "react";
import { Optional } from "./utils";
import Expr from "./expr";
import * as E from "./expr";
import * as Samples from "./sample";

export const Workspace = React.createContext<Optional<WorkspaceValue>>(null);

export interface WorkspaceValue {
    topLevel: { [name: string]: Expr };
    getTopLevel(name: string): Expr;
    removeTopLevel(name: string): void;
    setTopLevel(name: string, update: (expr: Expr) => Expr): void;
}

export class WorkspaceProvider extends Component<{}, WorkspaceValue> {
    state: WorkspaceValue = {
        topLevel: { "Sample 1": Samples.SAMPLE_1, "Sample 2": Samples.SAMPLE_2 },
        removeTopLevel: this.removeTopLevel.bind(this),
        setTopLevel: this.setTopLevel.bind(this),
        getTopLevel: this.getTopLevel.bind(this),
    };

    removeTopLevel(name: string) {
        this.setState(({ topLevel }) => {
            const cloned = Object.assign({}, topLevel);
            delete cloned[name];
            return { topLevel: cloned };
        });
    }

    setTopLevel(name: string, update: (expr: Expr) => Expr) {
        this.setState(({ topLevel }) => ({
            topLevel: { ...topLevel, [name]: update(topLevel[name]) },
        }));
    }

    getTopLevel(name: string): Expr {
        return this.state.topLevel[name] ?? new E.Blank(E.exprData(`${name} not found`));
    }

    render() {
        return <Workspace.Provider value={this.state}>{this.props.children}</Workspace.Provider>;
    }
}

type SetState<S> = React.Dispatch<React.SetStateAction<S>>;

export interface ClipboardValue {
    clipboard: Expr[];
    setClipboard: SetState<Expr[]>;
}

export const Clipboard = React.createContext<Optional<ClipboardValue>>(null);

export function ClipboardProvider({ children }: { children: ReactNode }) {
    const [clipboard, setClipboard] = useState<Expr[]>([]);
    const value = { clipboard, setClipboard };
    return <Clipboard.Provider value={value}>{children}</Clipboard.Provider>;
}
