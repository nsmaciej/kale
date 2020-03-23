import React, { ReactNode, forwardRef, Ref } from "react";

import { Box, PaneHeading, Stack } from "components";

export interface PaneProps {
    gridArea: string;
    name: string;
    extras?: ReactNode;
    children: ReactNode;
}

function Pane({ gridArea, name, extras, children }: PaneProps, ref: Ref<HTMLDivElement>) {
    return (
        <Box gridArea={gridArea} overflow="auto" ref={ref}>
            <Stack gap={10} alignItems="baseline" justifyContent="space-between">
                <PaneHeading>{name}</PaneHeading>
                {extras}
            </Stack>
            <Box marginTop={20}>{children}</Box>
        </Box>
    );
}

export default forwardRef(Pane);
