import React, { useState, useContext, ReactNode } from "react";
import { useToasts } from "react-toast-notifications";

import { assertSome } from "utils";
import Interpreter from "vm/interpreter";
import { Workspace } from "contexts/workspace";
import { VmError } from "vm/types";

export function useDebugProvider() {
    const workspace = assertSome(useContext(Workspace));
    const { addToast } = useToasts();
    const [continueEval, setContinueEval] = useState<(() => void) | null>(null);
    const [interpreter, setInterpeter] = useState<Interpreter | null>(null);
    return {
        interpreter,
        continueEval() {
            continueEval?.();
            setContinueEval(null);
        },
        async evalFunction(name: string) {
            const int = new Interpreter({
                onBreakpoint: cc => setContinueEval(cc),
                onTerminated: () => setInterpeter(null),
            });
            int.setWorkspace(workspace.workspace.scope);
            setInterpeter(int);
            try {
                await int.evalFunction(name);
            } catch (error) {
                if (error instanceof VmError) {
                    addToast(error.message, { appearance: "error", autoDismiss: true });
                    setInterpeter(null);
                } else {
                    throw error;
                }
            }
        },
    };
}

export type DebuggerValue = ReturnType<typeof useDebugProvider>;
export const Debugger = React.createContext<DebuggerValue | null>(null);

export function DebuggerProvider(props: { children: ReactNode }) {
    return <Debugger.Provider value={useDebugProvider()}>{props.children}</Debugger.Provider>;
}
