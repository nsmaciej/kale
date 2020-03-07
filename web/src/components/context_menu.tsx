import React, { useState } from "react";
import styled from "styled-components";

import { Shortcut } from "components";
import { Optional, mod, assert } from "utils";
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
