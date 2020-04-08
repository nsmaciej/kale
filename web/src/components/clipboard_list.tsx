import { AiOutlinePushpin, AiFillPushpin } from "react-icons/ai";
import React, { useRef } from "react";

import { mod } from "utils";
import { NonIdealText } from "components";
import { useSimpleDrop, useContextChecked } from "hooks";
import Clipboard, { ClipboardEntry } from "contexts/clipboard";

import Button from "components/button";
import ExprViewList from "components/expr_view_list";
import Pane from "components/pane";
import Shortcut from "components/shortcut";

export default React.memo(function ClipboardList() {
    const containerRef = useRef<HTMLDivElement>(null);
    const clipboard = useContextChecked(Clipboard);
    const draggingOver = useSimpleDrop(containerRef, (expr) =>
        clipboard.dispatch({ type: "add", entry: { pinned: false, expr } }),
    );

    function togglePin(item: ClipboardEntry) {
        clipboard.dispatch({ type: "togglePinned", expr: item.expr.id });
    }

    const history = clipboard.value.map((x, i) => ({
        ...x,
        shortcut: i < 10 ? mod(i + 1, 10).toString() : undefined,
        persistent: x.pinned,
    }));
    return (
        <Pane
            ref={containerRef}
            name="Clipboard"
            extras={
                <Button
                    name="Clear All"
                    onClick={() => clipboard.dispatch({ type: "clear" })}
                    disabled={clipboard.value.every((x) => x.pinned)}
                />
            }
        >
            <ExprViewList
                animate
                stretch
                width={260}
                items={history}
                showDropMarker={draggingOver}
                onDraggedOut={(item) => {
                    clipboard.dispatch({ type: "use", expr: item.expr.id });
                }}
                onContextMenu={(item) => [
                    {
                        id: "pin",
                        label: "Toggle Pin",
                        keyEquivalent: "p",
                        action() {
                            togglePin(item);
                        },
                    },
                    {
                        id: "remove",
                        label: "Remove",
                        keyEquivalent: "d",
                        action() {
                            clipboard.dispatch({ type: "remove", expr: item.expr.id });
                        },
                    },
                ]}
                onMiddleClick={(item) => {
                    clipboard.dispatch({ type: "remove", expr: item.expr.id });
                }}
                fallback={
                    <NonIdealText>
                        Nothing here yet.
                        <br />
                        Use <Shortcut keys="c" /> to copy something
                    </NonIdealText>
                }
                onGetExtras={(item) => (
                    <Button
                        onClick={() => togglePin(item)}
                        icon={item.pinned ? <AiFillPushpin /> : <AiOutlinePushpin />}
                    />
                )}
            />
        </Pane>
    );
});
