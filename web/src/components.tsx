import styled from "styled-components";
import {
    SpaceProps,
    GridProps,
    FlexboxProps,
    LayoutProps,
    BorderProps,
    grid,
    space,
    layout,
    flexbox,
    border,
} from "styled-system";

export type BoxProps = SpaceProps & GridProps & FlexboxProps & LayoutProps & BorderProps;
export const Box = styled.div<BoxProps>`
    ${space}
    ${grid}
    ${flexbox}
    ${layout}
    ${border}
`;

const getSide = (p: StackProps) => "margin-" + (p.vertical ? "bottom" : "right");
export interface StackProps extends BoxProps {
    gap?: number;
    vertical?: boolean;
}
export const Stack = styled(Box)`
    display: flex;
    flex-direction: ${p => (p.vertical ? "column" : "row")};
    & > *:last-child {
        ${getSide}: 0;
    }
    & > * {
        ${getSide}: ${p => p.gap ?? 0}px;
    }
`;

export const Shortcut = styled.kbd`
    display: inline;
    background-color: #eee;
    border-radius: 3px;
    border: 1px solid #cecece;
    box-shadow: 0 1px 1px #6b6b6b33;
    font-size: 0.85em;
    padding: 2px 4px;
    white-space: nowrap;
    font-family: inherit;
    font-variant-numeric: normal;
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
