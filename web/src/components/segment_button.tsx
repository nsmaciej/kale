import React from "react";
import styled from "styled-components";

export interface SegmentButtonProps<L> {
    labels: readonly L[];
    active?: string | null;
    onClick(label: L, segment: number): void;
}

const Container = styled.div`
    display: flex;
    border-radius: ${(p) => p.theme.general.borderRadius}px;
    border: 1px solid ${(p) => p.theme.colour.subtleClickable};
    overflow: hidden;
`;

const Segment = styled.button<{ active: boolean }>`
    padding: 10px 10px 8px;
    background: ${(p) => (p.active ? p.theme.colour.clickable : p.theme.colour.innerBackground)};
    color: ${(p) => p.active && p.theme.colour.background};
    & + & {
        border-left: 1px solid ${(p) => p.theme.colour.subtleClickable};
    }
    &:hover {
        color: ${(p) => !p.active && p.theme.colour.clickable};
    }
`;

export default function SegmentButton<L extends string>({
    labels,
    active,
    onClick,
}: SegmentButtonProps<L>) {
    return (
        <Container>
            {labels.map((label, i) => (
                <Segment key={label} active={label === active} onClick={() => onClick(label, i)}>
                    {label}
                </Segment>
            ))}
        </Container>
    );
}
