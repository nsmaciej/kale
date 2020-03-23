import { AiOutlinePushpin, AiFillPushpin } from "react-icons/ai";
import React, { useContext, useRef } from "react";

import { assertSome, mod } from "utils";
import { SubtleButton, NonIdealText, Shortcut } from "components";
import { useSimpleDrop } from "hooks";
import Clipboard, { ClipboardEntry } from "contexts/clipboard";

import ExprViewList from "components/expr_view_list";
import Pane from "components/pane";

export default React.memo(function ClipboardList() {
    const containerRef = useRef<HTMLDivElement>(null);
    const clipboard = assertSome(useContext(Clipboard));
    const draggingOver = useSimpleDrop(containerRef, (expr) =>
        clipboard.dispatch({ type: "add", entry: { pinned: false, expr } }),
    );

    function togglePin(item: ClipboardEntry) {
        clipboard.dispatch({ type: "togglePinned", expr: item.expr.id });
    }

    const history = clipboard.value.map((x, i) => ({
        ...x,
        shortcut: i < 10 ? mod(i + 1, 10).toString() : undefined,
    }));
    return (
        <Pane
            gridArea="history"
            name="Clipboard"
            extras={
                <SubtleButton
                    onClick={() => clipboard.dispatch({ type: "clear" })}
                    disabled={clipboard.value.every((x) => x.pinned)}
                >
                    Clear All
                </SubtleButton>
            }
        >
            <ExprViewList
                animate
                width={200}
                items={history}
                showDropMarker={draggingOver}
                onDraggedOut={(item) => {
                    clipboard.dispatch({ type: "use", expr: item.expr.id });
                }}
                onContextMenu={(item) => [
                    {
                        id: "pin",
                        label: "Toggle Pin",
                        action: () => togglePin(item),
                        keyEquivalent: "p",
                    },
                    {
                        id: "remove",
                        label: "Remove",
                        action: () => clipboard.dispatch({ type: "remove", expr: item.expr.id }),
                        keyEquivalent: "d",
                    },
                ]}
                fallback={
                    <NonIdealText>
                        Nothing here yet.
                        <br />
                        Use <Shortcut>C</Shortcut> to copy something
                    </NonIdealText>
                }
                extrasFudge={30}
                onGetExtras={(item) => (
                    <SubtleButton onClick={() => togglePin(item)}>
                        {item.pinned ? <AiFillPushpin /> : <AiOutlinePushpin />}
                    </SubtleButton>
                )}
            />
        </Pane>
    );
});
