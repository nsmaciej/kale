import { useToasts } from "react-toast-notifications";
import React, { useState, ReactNode } from "react";

import { useSelector } from "state/root";

import { VmError } from "vm/types";
import Interpreter from "vm/interpreter";

export function useDebugProvider() {
    const scope = useSelector((x) => x.workspace.scope);
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
                onBreakpoint: (cc) => setContinueEval(cc),
                onTerminated: () => setInterpeter(null),
            });
            int.setWorkspace(scope);
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
const Debugger = React.createContext<DebuggerValue | null>(null);
export default Debugger;

export function DebuggerProvider(props: { children: ReactNode }) {
    return <Debugger.Provider value={useDebugProvider()}>{props.children}</Debugger.Provider>;
}
