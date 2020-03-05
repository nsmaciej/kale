import React, { ReactNode } from "react";
import styled from "styled-components";
import { Stack } from "components";
import { Optional } from "utils";

export interface MenuItem<T = React.Key> {
    id: T;
    action: () => void;
}

interface MenuProps<K, I extends MenuItem<K>> {
    items: readonly I[];
    selected: Optional<K>;
    children: (item: I) => ReactNode;
}

const MenuPopover = styled(Stack).attrs({ gap: 1, vertical: true })`
    width: 400px; /* TODO: Remove this - shouldn't be needed but doesn't work without this */
    position: absolute;
    background: #ffffff;
    border-radius: 0 0 ${p => p.theme.borderRadiusPx}px ${p => p.theme.borderRadiusPx}px;
    box-shadow: 0 0 0 1px #10161a1a, 0 2px 4px #10161a33, 0 8px 24px #10161a33;
    padding: 6px;
    z-index: 1000;
`;

const MenuItemContainer = styled.div<{ selected: boolean }>`
    user-select: none;
    border-radius: ${p => p.theme.borderRadiusPx}px;
    padding: 8px 8px;
    background: ${p => (p.selected ? p.theme.clickableColour : "transparent")};
    display: flex;
    align-items: center;
    & > svg {
        margin-right: 5px;
    }
    &:hover {
        background: ${p => (p.selected ? p.theme.clickableColour : p.theme.grey)};
    }
    color: ${p => (p.selected ? "white" : "black")};
`;

export default function Menu<K extends React.Key, I extends MenuItem<K>>(
    props: MenuProps<K, I>,
): JSX.Element {
    return (
        <MenuPopover>
            {props.items.map(x => (
                <MenuItemContainer
                    key={x.id}
                    onMouseDown={e => e.preventDefault()} // Don't blur.
                    onClick={() => x.action()}
                    selected={x.id === props.selected}
                >
                    {props.children(x)}
                </MenuItemContainer>
            ))}
        </MenuPopover>
    );
}
