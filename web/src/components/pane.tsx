import React, { ReactNode } from "react";

import { Box, PaneHeading, Stack } from "components";

export default function Pane({
    gridArea,
    name,
    extras,
    children,
}: {
    gridArea: string;
    name: string;
    extras?: ReactNode;
    children: ReactNode;
}) {
    return (
        <Box gridArea={gridArea} overflow="auto">
            <Stack gap={10} alignItems="baseline" justifyContent="space-between">
                <PaneHeading>{name}</PaneHeading>
                {extras}
            </Stack>
            <Box marginTop={20}>{children}</Box>
        </Box>
    );
}
