import React, { ReactNode, useState } from "react";
import styled from "styled-components";
import { Stack, Shortcut } from "components";
import { Optional, mod, assert } from "utils";
import { Vec } from "geometry";

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
                            paddingRight: minimalPadding ? 0 : 16,
                        }}
                    >
                        {props.children(x)}
                    </MenuItemContainer>
                );
            })}
        </MenuPopover>
    );
}

const ContextMenuSeparator = styled.div`
    height: 1px;
    background: ${p => p.theme.disabledColour};
    width: 100%;
`;

const ContextMenuItemContainer = styled.div`
    display: flex;
    justify-content: space-between;
    width: 100%;
    & > kbd {
        margin-left: 20px;
    }
`;

export interface ContextMenuItem extends MenuItem {
    label: Optional<string>;
    action: Optional<() => void>;
    keyEquivalent?: Optional<string>;
}

interface ContextMenuProps {
    dismissMenu: () => void;
    items: ContextMenuItem[];
    origin: Vec;
}

export function ContextMenu({ items, origin, dismissMenu }: ContextMenuProps) {
    assert(items.length > 0);
    const [selection, setSelection] = useState(null as Optional<number>);

    // Move selection skipping past separators, if the menu consists of only separators,
    // bad things(tm) will happen.
    function moveSelection(delta: 1 | -1) {
        setSelection(current => {
            let next = current == null ? 0 : mod(current + delta, items.length);
            while (items[next].label == null) {
                next = mod(next + delta, items.length);
            }
            return next;
        });
    }

    function onClick(item: ContextMenuItem) {
        dismissMenu();
        item.action?.();
    }

    function onKeyDown(e: React.KeyboardEvent) {
        e.stopPropagation();
        switch (e.key) {
            case "ArrowDown":
                moveSelection(1);
                break;
            case "ArrowUp":
                moveSelection(-1);
                break;
            case "Escape":
                dismissMenu();
                break;
            default:
                for (const item of items) {
                    if (item.keyEquivalent === e.key) {
                        onClick(item);
                        return;
                    }
                }
        }
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
                // Do not allow selecting separators.
                setSelected={i => setSelection(i != null && items[i].label != null ? i : null)}
                minimalPadding={i => items[i].label == null}
            >
                {item =>
                    item.label ? (
                        <ContextMenuItemContainer>
                            {item.label}
                            <Shortcut subtle>{item.keyEquivalent?.toUpperCase()}</Shortcut>
                        </ContextMenuItemContainer>
                    ) : (
                        <ContextMenuSeparator />
                    )
                }
            </Menu>
        </div>
    );
}
