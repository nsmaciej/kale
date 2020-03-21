import React, { ReactNode } from "react";
import styled from "styled-components";

import { Offset } from "geometry";
import { useDisableScrolling } from "hooks";

interface PopoverProps {
    origin: Offset;
    children: ReactNode;
    onDismiss(): void;
}

const triangleSize = 8;

const Container = styled.div`
    position: fixed;
    box-shadow: ${p => p.theme.boxShadow};
    border-radius: ${p => p.theme.borderRadius}px;
    background: ${p => p.theme.colour.background};
`;

// See https://css-tricks.com/triangle-with-shadow/. We create a 45deg rotated square, then shift it
// up and use overflow: hidden to chop the bottom bit off.
const Arrow = styled.div`
    position: absolute;
    overflow: hidden;
    height: ${triangleSize}px;
    width: ${triangleSize * 2}px;
    left: ${p => p.theme.borderRadius}px;
    top: -${triangleSize}px;
    &::before {
        background: ${p => p.theme.colour.background};
        left: ${triangleSize / 2}px;
        top: ${triangleSize / 2}px;
        box-shadow: ${p => p.theme.boxShadowSmall};
        position: absolute;
        transform: rotate(45deg);
        content: "";
        width: ${triangleSize}px;
        height: ${triangleSize}px;
    }
`;

export default function Popover({ onDismiss, origin, children }: PopoverProps) {
    useDisableScrolling();
    return (
        <Container
            tabIndex={0}
            ref={el => el?.focus()}
            onBlur={onDismiss}
            style={{ top: origin.y + triangleSize, left: origin.x }}
        >
            <Arrow />
            <div>{children}</div>
        </Container>
    );
}
