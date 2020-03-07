import React, { ReactNode } from "react";
import styled from "styled-components";

import { Stack } from "components";
import { Optional } from "utils";

const MenuPopover = styled(Stack).attrs({ gap: 1, vertical: true })`
    width: 400px; /* TODO: Remove this - shouldn't be needed but doesn't work without this */
    position: absolute;
    background: #ffffff;
    border-radius: ${p => p.theme.borderRadiusPx}px;
    box-shadow: 0 0 0 1px #10161a1a, 0 2px 4px #10161a33, 0 8px 24px #10161a33;
    padding: 6px 0;
    z-index: 1000;
`;

const MenuItemContainer = styled.div<{ selected: boolean }>`
    user-select: none;
    background: ${p => (p.selected ? p.theme.clickableColour : "transparent")};
    display: flex;
    align-items: center;
    & > svg {
        margin-right: 5px;
    }
    color: ${p => (p.selected ? "white" : p.theme.mainTextColour)};
`;

export interface MenuItem {
    id: string;
}

interface MenuProps<I> {
    items: readonly I[];
    width?: number;
    selected: Optional<number>;
    setSelected: (index: number | null) => void;
    onClick: (item: I, index: number) => void;
    // Function-children to render a menu item.
    children: (item: I) => ReactNode;
    // Special function for the context menu.
    minimalPadding?: (index: number) => boolean;
}

export default function Menu<I extends MenuItem>(props: MenuProps<I>): JSX.Element {
    return (
        <MenuPopover style={{ width: props.width ?? "max-content" }}>
            {props.items.map((x, i) => {
                const minimalPadding = props.minimalPadding?.(i) ?? false;
                return (
                    <MenuItemContainer
                        key={x.id}
                        onMouseDown={e => e.preventDefault()} // Don't blur.
                        onClick={() => props.onClick(x, i)}
                        onContextMenu={e => e.preventDefault()} // Can't right click.
                        onMouseMove={() => props.setSelected(i)}
                        onMouseLeave={() => props.setSelected(null)}
                        selected={i === props.selected}
                        style={{
                            paddingTop: minimalPadding ? 1 : 6,
                            paddingBottom: minimalPadding ? 1 : 6,
                            paddingLeft: minimalPadding ? 0 : 16,
                            paddingRight: minimalPadding ? 0 : 10,
                        }}
                    >
                        {props.children(x)}
                    </MenuItemContainer>
                );
            })}
        </MenuPopover>
    );
}
