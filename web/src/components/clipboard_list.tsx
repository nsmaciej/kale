import { AiOutlinePushpin, AiFillPushpin } from "react-icons/ai";
import { useDispatch, useSelector } from "react-redux";
import React, { useRef } from "react";

import { mod } from "utils";
import { NonIdealText } from "components";
import { useSimpleDrop } from "hooks";
import Clipboard, { ClipboardEntry } from "state/clipboard";

import Button from "components/button";
import ExprViewList from "components/expr_view_list";
import Pane from "components/pane";
import Shortcut from "components/shortcut";

export default React.memo(function ClipboardList() {
    const dispatch = useDispatch();
    const clipboard = useSelector<ClipboardEntry[]>((x) => x) as ClipboardEntry[];
    const containerRef = useRef<HTMLDivElement>(null);
    const draggingOver = useSimpleDrop(containerRef, (expr) =>
        dispatch(Clipboard.actions.add({ pinned: false, expr })),
    );

    function togglePin(item: ClipboardEntry) {
        dispatch(Clipboard.actions.togglePinned(item.expr.id));
    }

    const history = clipboard.map((x, i) => ({
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
                    onClick={() => dispatch(Clipboard.actions.clear())}
                    disabled={clipboard.every((x) => x.pinned)}
                />
            }
        >
            <ExprViewList
                animate
                stretch
                width={260}
                items={history}
                showDropMarker={draggingOver}
                onDraggedOut={(item) => dispatch(Clipboard.actions.use(item.expr.id))}
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
                            dispatch(Clipboard.actions.remove(item.expr.id));
                        },
                    },
                ]}
                onMiddleClick={(item) => dispatch(Clipboard.actions.remove(item.expr.id))}
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
