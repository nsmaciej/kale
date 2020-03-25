import styled from "styled-components";
import {
    SpaceProps,
    GridProps,
    FlexboxProps,
    LayoutProps,
    BorderProps,
    PositionProps,
    grid,
    space,
    layout,
    flexbox,
    border,
    position,
} from "styled-system";

export type BoxProps = SpaceProps &
    GridProps &
    FlexboxProps &
    LayoutProps &
    BorderProps &
    PositionProps;
export const Box = styled.div<BoxProps>`
    ${space}
    ${grid}
    ${flexbox}
    ${layout}
    ${border}
    ${position}
`;

export interface StackProps extends BoxProps {
    gap?: number;
    vertical?: boolean;
}

const getSide = (p: StackProps) => "margin-" + (p.vertical ? "bottom" : "right");
export const Stack = styled(Box)`
    display: flex;
    flex-direction: ${(p: StackProps) => (p.vertical ? "column" : "row")};
    & > *:last-child {
        ${getSide}: 0;
    }
    & > * {
        ${getSide}: ${(p: StackProps) => p.gap ?? 0}px;
    }
`;

export const SubtleButton = styled.button<{ selected?: boolean }>`
    color: ${(p) => p.theme.colour.clickable};
    transition: color 0.1s;
    ${(p) => p.selected && "-webkit-text-stroke: 1px currentcolor"};
    &:hover {
        color: ${(p) => (p.selected ? undefined : p.theme.colour.active)};
    }
    &:disabled {
        color: ${(p) => p.theme.colour.disabled};
    }
`;

// Meant for wrapping react-icons icons.
export const IconButton = styled.button`
    background: none;
    border: none;
    color: ${(p) => p.theme.colour.clickable};
    & > svg {
        width: 1.5em;
        height: 1.5em;
    }
    &:hover,
    &:focus {
        color: ${(p) => p.theme.colour.active};
    }
    &:disabled {
        color: ${(p) => p.theme.colour.disabled};
    }
`;

export const NonIdealText = styled.p`
    text-align: center;
    color: ${(p) => p.theme.colour.subtleText};
`;

export const PaneHeading = styled.h2`
    font-weight: 700;
    font-size: 20px;
    font-variant-numeric: oldstyle-nums;
`;
