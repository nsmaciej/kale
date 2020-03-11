import React, { useState, useContext, ReactNode } from "react";

import { Optional, assertSome } from "utils";
import Interpreter from "vm/interpreter";
import { Workspace } from "contexts/workspace";

export function useDebugProvider() {
    const workspace = assertSome(useContext(Workspace));
    const [continueEval, setContinueEval] = useState<Optional<() => void>>(null);
    const [interpreter, setInterpeter] = useState<Optional<Interpreter>>(null);
    return {
        interpreter,
        continueEval() {
            continueEval?.();
            setContinueEval(null);
        },
        evalFunction(name: string) {
            const int = new Interpreter({
                onBreakpoint: cc => setContinueEval(cc),
                onTerminated: () => console.log("Terminated"),
            });
            int.setWorkspace(workspace.topLevel);
            int.evalFunction(name);
            setInterpeter(int);
        },
    };
}

export type DebuggerValue = ReturnType<typeof useDebugProvider>;
export const Debugger = React.createContext<Optional<DebuggerValue>>(null);

export function DebuggerProvider(props: { children: ReactNode }) {
    return <Debugger.Provider value={useDebugProvider()}>{props.children}</Debugger.Provider>;
}
