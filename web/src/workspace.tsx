import React, { ReactNode, Component, useState } from "react";
import { Optional } from "./utils";
import Expr from "./expr";
import * as E from "./expr";
import * as Samples from "./sample";

export const Workspace = React.createContext<Optional<WorkspaceProvider>>(null);

interface WorkspaceState {
    topLevel: { [name: string]: Expr };
}

export class WorkspaceProvider extends Component<{}, WorkspaceState> {
    state: WorkspaceState = {
        topLevel: { "Sample 1": Samples.SAMPLE_1, "Sample 2": Samples.SAMPLE_2 },
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

    topLevel(name: string): Expr {
        return this.state.topLevel[name] ?? new E.Blank(E.exprData(`${name} not found`));
    }

    render() {
        return <Workspace.Provider value={this}>{this.props.children}</Workspace.Provider>;
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
