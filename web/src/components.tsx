import styled, { css } from "styled-components";
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

interface ShortcutProps {
    subtle?: boolean;
}

export const Shortcut = styled.kbd<ShortcutProps>`
    display: inline-block;
    background-color: ${p => (p.subtle ? "#ffffff" : "#eeeeee")};
    border-radius: 3px;
    border: 1px solid #cecece;
    box-shadow: 0 1px 1px #6b6b6b33;
    font-size: 0.85em;
    padding: 2px;
    white-space: nowrap;
    font-variant-numeric: normal;
    min-width: 1.5em;
    text-align: center;
    font-family: inherit;
    /* Ensure we always look snazzy no matter the context */
    color: ${p => p.theme.mainTextColour};
    line-height: 1;
`;

// Prevent a shortcut group from containing line-breaks.
export const ShortcutGroup = styled.span`
    display: inline-block;
`;

export const SubtleButton = styled.button`
    font: inherit;
    background: none;
    border: none;
    font-weight: 600;
    color: ${p => p.theme.clickableColour};
    outline: none;
    transition: color 0.1s;
    &:hover,
    &:focus {
        text-decoration: underline;
    }
    &:disabled {
        color: ${p => p.theme.disabledExprColour};
        text-decoration: none !important;
    }
`;

export const NonIdealText = styled.p`
    text-align: center;
    color: ${p => p.theme.subtleTextColour};
`;

export const EditorHeadingStyle = css`
    font-weight: 700;
    font-size: 20px;
    font-variant-numeric: oldstyle-nums;
`;

export const PaneHeading = styled.h2`
    ${EditorHeadingStyle}
`;
