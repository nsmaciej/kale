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
    border: 1px solid ${(p) => p.theme.colour.clickable};
`;

const Segment = styled.button<{ active: boolean }>`
    padding: 6px 10px 4px;
    & + & {
        border-left: 1px solid ${(p) => p.theme.colour.clickable};
    }
    background: ${(p) => p.active && p.theme.colour.clickable};
    color: ${(p) => p.active && p.theme.colour.background};
    &:hover {
        color: ${(p) => !p.active && p.theme.colour.clickable};
    }
    &:focus {
        box-shadow: 0 0 3px solid ${(p) => p.theme.colour.active};
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
