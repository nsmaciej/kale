import React, { ReactNode } from "react";
import styled from "styled-components";

import { Optional } from "utils";

const MenuPopover = styled.div<{ subtle: boolean }>`
    background: #ffffff30;
    border-radius: ${p => p.theme.borderRadiusPx}px;
    box-shadow: 0 0 0 1px #10161a1a, 0 2px 4px #10161a33, 0 8px 24px #10161a33;
    ${p => !p.subtle && "padding: 6px 0"};
    z-index: 1000;
    position: absolute;
    overflow: auto;
    backdrop-filter: brightness(150%) blur(20px);
`;

const MenuItemContainer = styled.div<{ selected: boolean; enabled: boolean }>`
    user-select: none;
    background: ${p => (p.enabled && p.selected ? p.theme.clickableColour : "transparent")};
    display: flex;
    align-items: center;
    & > svg {
        margin-right: 5px;
    }
    color: ${p =>
        p.enabled ? (p.selected ? "white" : p.theme.mainTextColour) : p.theme.disabledColour};
    overflow: hidden;
`;

// Convenience class for overflowing text.
export const MenuTextWrapper = styled.div`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

export interface MenuItem {
    id: string;
    enabled: boolean;
}

interface MenuProps<I> {
    items: readonly I[];
    width?: number;
    subtle?: boolean;
    selected: Optional<number>;
    setSelected(index: number | null): void;
    onClick(item: I, index: number): void;
    // Function-children to render a menu item in a flexbox context.
    children(item: I): ReactNode;
    // Special function for the context menu.
    minimalPadding?(index: number): boolean;
}

export default function Menu<I extends MenuItem>(props: MenuProps<I>) {
    return (
        <MenuPopover
            subtle={props.subtle ?? false}
            style={{
                minWidth: props.width ?? "max-content",
            }}
        >
            {props.items.map((item, i) => {
                const minimalPadding = props.minimalPadding?.(i) ?? false;
                return (
                    <MenuItemContainer
                        key={item.id}
                        onMouseDown={e => e.preventDefault()} // Don't blur.
                        onClick={() => props.onClick(item, i)}
                        onContextMenu={e => e.preventDefault()} // Can't right click.
                        onMouseMove={() => props.setSelected(i)}
                        onMouseLeave={() => props.setSelected(null)}
                        // Styling.
                        enabled={item.enabled}
                        selected={i === props.selected}
                        style={{
                            paddingTop: minimalPadding ? 1 : 6,
                            paddingBottom: minimalPadding ? 1 : 6,
                            paddingLeft: minimalPadding ? 0 : 10,
                            paddingRight: minimalPadding ? 0 : 10,
                        }}
                    >
                        {props.children(item)}
                    </MenuItemContainer>
                );
            })}
        </MenuPopover>
    );
}
