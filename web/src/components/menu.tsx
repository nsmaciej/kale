import React, { ReactNode, useState } from "react";
import styled from "styled-components";
import { Stack } from "components";
import { Optional } from "utils";
import { Vec } from "geometry";

const MenuPopover = styled(Stack).attrs({ gap: 1, vertical: true })`
    width: 400px; /* TODO: Remove this - shouldn't be needed but doesn't work without this */
    position: absolute;
    background: #ffffff;
    border-radius: ${p => p.theme.borderRadiusPx}px;
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
    color: ${p => (p.selected ? "white" : "black")};
`;

export interface MenuItem {
    id: string;
}

interface MenuProps<I> {
    items: readonly I[];
    selected: Optional<number>;
    setSelected: (item: I, index: number) => void;
    children: (item: I) => ReactNode;
    onClick: (item: I, index: number) => void;
}

export default function Menu<I extends MenuItem>(props: MenuProps<I>): JSX.Element {
    return (
        <MenuPopover>
            {props.items.map((x, i) => (
                <MenuItemContainer
                    key={x.id}
                    onMouseDown={e => e.preventDefault()} // Don't blur.
                    onClick={() => props.onClick(x, i)}
                    onContextMenu={e => e.preventDefault()} // Can't right click.
                    onMouseMove={e => props.setSelected(x, i)}
                    selected={i === props.selected}
                >
                    {props.children(x)}
                </MenuItemContainer>
            ))}
        </MenuPopover>
    );
}

export interface ContextMenuItem extends MenuItem {
    label: string;
    action: () => void;
}

interface ContextMenuProps {
    dismissMenu: () => void;
    items: ContextMenuItem[];
    origin: Vec;
}

export function ContextMenu({ items, origin, dismissMenu }: ContextMenuProps) {
    const [selection, setSelection] = useState(null as Optional<number>);

    function onKeyDown(e: React.KeyboardEvent) {
        e.stopPropagation();
        switch (e.key) {
            case "ArrowDown":
                setSelection(x => (x != null ? (x + 1) % items.length : 0));
                break;
            case "ArrowUp":
                setSelection(x =>
                    x != null ? (x - 1 + items.length) % items.length : items.length - 1,
                );
                break;
            case "Escape":
                dismissMenu();
                break;
        }
    }

    function onClick(item: ContextMenuItem) {
        dismissMenu();
        item.action();
    }

    return (
        <div
            style={{ position: "absolute", left: origin.x, top: origin.y }}
            onKeyDown={onKeyDown}
            tabIndex={0}
            onBlur={() => dismissMenu()}
            ref={el => el?.focus()}
        >
            <Menu
                selected={selection}
                items={items}
                onClick={onClick}
                setSelected={(_, i) => setSelection(i)}
            >
                {item => item.label}
            </Menu>
        </div>
    );
}
