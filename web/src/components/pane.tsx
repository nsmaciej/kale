import React, { ReactNode, forwardRef, Ref } from "react";

import { Box, PaneHeading, Stack } from "components";

export interface PaneProps {
    name: string;
    extras?: ReactNode;
    children: ReactNode;
}

function Pane({ name, extras, children }: PaneProps, ref: Ref<HTMLDivElement>) {
    return (
        <Box overflow="auto" ref={ref}>
            <Stack gap={10} alignItems="baseline" justifyContent="space-between">
                <PaneHeading>{name}</PaneHeading>
                {extras}
            </Stack>
            <Box marginTop={20}>{children}</Box>
        </Box>
    );
}

export default forwardRef(Pane);
