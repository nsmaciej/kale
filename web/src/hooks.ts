import { useContext, useState, useMemo } from "react";

import { assertSome, Optional, mod } from "utils";
import { Workspace } from "contexts/workspace";
import { MenuItem } from "components/menu";
import { specialFunctions } from "vm/interpreter";

interface Suggestion extends MenuItem {
    name: string;
    original: boolean;
}

interface SuggestionsHook {
    suggestions: Suggestion[];
    selection: Optional<number>;
    setSelection(selection: Optional<number>): void;
    moveSelection(delta: 1 | -1): void;
}

export function useSuggestions(
    value: string,
    { showValue, showSpecials }: { showValue?: boolean; showSpecials?: boolean } = {},
): SuggestionsHook {
    const workspace = assertSome(useContext(Workspace));
    const [selection, setSelection] = useState<Optional<number>>(0);

    const suggestions = useMemo(() => {
        const r = [...workspace.topLevel.keys(), ...(showSpecials ? specialFunctions : [])]
            .filter(x => x.toLowerCase().includes(value.toLowerCase()))
            .slice(0, 5)
            .map(x => ({
                name: x,
                original: false,
                id: x,
            }));
        const fullMatch = workspace.topLevel.has(value);
        if (value !== "" && !fullMatch && showValue && !specialFunctions.includes(value)) {
            r.push({
                name: value,
                original: true,
                id: value,
            });
        }
        if (!r.length) {
            setSelection(null);
        }
        return r as Suggestion[];
    }, [value, workspace.topLevel, showValue, showSpecials]);

    return {
        selection,
        setSelection,
        suggestions,
        moveSelection(delta) {
            setSelection(x =>
                mod(x == null ? (delta === 1 ? 0 : -1) : x + delta, suggestions.length),
            );
        },
    };
}
