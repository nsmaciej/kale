import styled from "styled-components";
import {
    SpaceProps,
    GridProps,
    FlexboxProps,
    LayoutProps,
    grid,
    space,
    layout,
    flexbox,
} from "styled-system";

export type BoxProps = SpaceProps & GridProps & FlexboxProps & LayoutProps;
export const Box = styled.div<BoxProps>`
    ${space}
    ${grid}
    ${flexbox}
    ${layout}
`;

const getGap = (p: StackProps) => (p.gap ?? 0) / 2;
export interface StackProps extends BoxProps {
    gap?: number;
}
export const VerticalStack = styled(Box)`
    display: flex;
    flex-direction: column;
    margin: -${getGap}px 0;
    & > * {
        margin: ${getGap}px 0;
    }
`;
export const HorizonstalStack = styled(Box)`
    display: flex;
    flex-direction: row;
    margin: 0 -${getGap}px;
    & > * {
        margin: 0 ${getGap}px;
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
`;
