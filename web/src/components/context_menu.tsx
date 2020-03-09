import React, { useState } from "react";
import styled from "styled-components";

import { Shortcut } from "components";
import { Optional, mod, assert, delay } from "utils";
import { Vec } from "geometry";
import Menu, { MenuItem } from "components/menu";

const ContextMenuSeparator = styled.div`
    height: 1px;
    background: ${p => p.theme.disabledColour};
    width: 100%;
`;

const ContextMenuItemContainer = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
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

export default function ContextMenu({ items, origin, dismissMenu }: ContextMenuProps) {
    assert(items.length > 0);
    const [selection, setSelection] = useState(null as Optional<number>);
    const [blinking, setBlinking] = useState(false);

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

    async function onClick(item: ContextMenuItem, index: number) {
        if (blinking) false;
        setBlinking(true);

        // Blink the menu.
        const offDuration = 60;
        if (selection != null) {
            setSelection(null);
            await delay(offDuration);
        }
        setSelection(index);
        await delay(offDuration / 2);

        setBlinking(false);
        dismissMenu();
        item.action?.();
    }

    function onKeyDown(e: React.KeyboardEvent) {
        e.stopPropagation();
        e.preventDefault();
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
            case "Enter":
                if (selection) {
                    onClick(items[selection], selection);
                } else {
                    dismissMenu();
                }
                break;
            default: {
                let i = 0;
                for (const item of items) {
                    if (item.keyEquivalent === e.key) {
                        onClick(item, i);
                        return;
                    }
                    i++;
                }
            }
        }
    }

    return (
        <div
            style={{ position: "absolute", left: origin.x, top: origin.y }}
            onKeyDown={onKeyDown}
            onKeyUp={e => {
                e.preventDefault();
                e.stopPropagation();
            }}
            tabIndex={0}
            onBlur={() => dismissMenu()}
            ref={el => el?.focus()}
        >
            <Menu
                selected={selection}
                items={items}
                onClick={onClick}
                // Do not allow selecting separators.
                setSelected={i =>
                    blinking || setSelection(i != null && items[i].label != null ? i : null)
                }
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
