import React from "react";
import styled from "styled-components";
import { ButtonBase } from "components";

export interface SegmentButtonProps<L> {
    vertical?: boolean;
    labels: readonly L[];
    active?: string | null;
    onClick(label: L, segment: number): void;
}

const Container = styled.div<{ vertical?: boolean }>`
    display: flex;
    flex-direction: ${(p) => (p.vertical ? "column" : "row")};
    border-radius: ${(p) => p.theme.general.borderRadius}px;
    border: 1px solid ${(p) => p.theme.colour.subtleClickable};
    overflow: hidden;
`;

const Segment = styled(ButtonBase)<{ vertical?: boolean }>`
    padding: ${(p) => (p.vertical ? "12px 10px" : "10px 14px")};
    & + & {
        ${(p) =>
            p.vertical
                ? `border-top: 1px solid ${p.theme.colour.subtleClickable}`
                : `border-left: 1px solid ${p.theme.colour.subtleClickable}`}
    }
`;

export default function SegmentButton<L extends string>({
    vertical,
    labels,
    active,
    onClick,
}: SegmentButtonProps<L>) {
    return (
        <Container vertical={vertical}>
            {labels.map((label, i) => (
                <Segment
                    key={label}
                    selected={label === active}
                    onClick={() => onClick(label, i)}
                    vertical={vertical}
                >
                    {label}
                </Segment>
            ))}
        </Container>
    );
}
