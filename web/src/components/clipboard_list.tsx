import React, { useContext, useRef } from "react";
import { AiOutlinePushpin, AiFillPushpin } from "react-icons/ai";

import { assertSome, mod } from "utils";
import { Box, Stack, SubtleButton, NonIdealText, PaneHeading, Shortcut } from "components";
import ExprViewList from "components/expr_view_list";

import { Clipboard } from "contexts/clipboard";
import { useSimpleDrop } from "contexts/drag_and_drop";

export default React.memo(function ClipboardList() {
    const containerRef = useRef<HTMLDivElement>(null);
    const clipboard = assertSome(useContext(Clipboard));

    const draggingOver = useSimpleDrop(containerRef, expr =>
        clipboard.add({ pinned: false, expr }),
    );

    const history = clipboard.clipboard.map((x, i) => ({
        ...x,
        shortcut: i < 10 ? mod(i + 1, 10).toString() : undefined,
    }));
    return (
        <Box gridArea="history" overflow="auto" ref={containerRef}>
            <Stack gap={10} alignItems="baseline" justifyContent="space-between">
                <PaneHeading>History</PaneHeading>
                <SubtleButton
                    onClick={() => clipboard.clear()}
                    disabled={!clipboard.canBeCleared()}
                >
                    Clear All
                </SubtleButton>
            </Stack>
            <ExprViewList
                frozen
                animate
                maxWidth={300}
                items={history}
                showDropMarker={draggingOver}
                fallback={
                    <NonIdealText>
                        Nothing here yet.
                        <br />
                        Use <Shortcut>C</Shortcut> to copy something
                    </NonIdealText>
                }
                extras={item => (
                    <SubtleButton onClick={() => clipboard.togglePinned(item.expr.id)}>
                        {item.pinned ? <AiFillPushpin /> : <AiOutlinePushpin />}
                    </SubtleButton>
                )}
            />
        </Box>
    );
});
