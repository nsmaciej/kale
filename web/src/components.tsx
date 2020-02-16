import styled from "styled-components";

export interface LayoutProps {
    gridArea: string;
}

type AlignTypes =
    | "start"
    | "end"
    | "center"
    | "baseline"
    | "stretch"
    | "normal";

type ContentAlignTypes =
    | AlignTypes
    | "space-between"
    | "space-around"
    | "space-evenly";

export interface StackProps {
    gap?: number;
    alignItems?: AlignTypes;
    justifyContent?: ContentAlignTypes;
}

export const Box = styled.div<LayoutProps>`
    grid-area: ${p => p.gridArea};
`;

const Stack = styled(Box)<StackProps & LayoutProps>`
    display: flex;
    overflow: auto;
    align-items: ${p => p.alignItems ?? "normal"};
    justify-content: ${p => p.justifyContent ?? "normal"};
`;

const getGap = (p: StackProps) => (p.gap ?? 0) / 2;

export const VerticalStack = styled(Stack)<StackProps & LayoutProps>`
    flex-direction: column;
    margin: -${getGap}px 0;
    & > * {
        margin: ${getGap}px 0;
    }
`;

export const HorizonstalStack = styled(Stack)<StackProps & LayoutProps>`
    flex-direction: row;
    margin: 0 -${getGap}px;
    & > * {
        margin: 0 ${getGap}px;
    }
`;
