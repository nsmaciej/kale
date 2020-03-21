import React, { useState } from "react";
import styled from "styled-components";

import { Offset } from "geometry";
import { Optional, mod, assert, delay } from "utils";
import { Shortcut } from "components";
import { useDisableScrolling } from "hooks";
import Menu, { MenuItem } from "components/menu";

const ContextMenuSeparator = styled.div`
    height: 1px;
    background: ${p => p.theme.colour.disabled};
    width: 100%;
`;

const ContextMenuItemContainer = styled.div<{ enabled: boolean }>`
    display: flex;
    align-items: center;
    width: 100%;
    & > *:first-child {
        /* Basically separate out the kbd shortcut by at least 20px */
        padding-right: 20px;
        margin-right: auto;
    }
`;
export interface ContextMenuItem extends MenuItem {
    label: Optional<string>;
    action: Optional<() => void>;
    keyEquivalent?: Optional<string>;
}

interface ContextMenuProps {
    dismissMenu(): void;
    items: ContextMenuItem[];
    origin: Offset;
    popover?: boolean;
}

export default function ContextMenu({ items, origin, dismissMenu, popover }: ContextMenuProps) {
    assert(items.length > 0);
    useDisableScrolling();
    const [selection, setSelection] = useState<number | null>(null);
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
        if (e.ctrlKey || e.altKey || e.metaKey) return;
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
                        if (item.enabled) onClick(item, i);
                        return;
                    }
                    i++;
                }
            }
        }
    }

    function renderShortcut(key: Optional<string>) {
        const S = Shortcut;
        if (key == null) return null;
        if (key.length > 1) return <S subtle>{key}</S>;
        if (key.toLowerCase() === key) return <S subtle>{key.toUpperCase()}</S>;
        return (
            <>
                <S subtle>Shift</S>
                <S subtle>{key.toUpperCase()}</S>
            </>
        );
    }

    return (
        <div
            style={{ position: "fixed", left: origin.x, top: origin.y, zIndex: 100 }}
            onKeyDown={onKeyDown}
            onKeyUp={e => {
                e.preventDefault();
                e.stopPropagation();
            }}
            tabIndex={0}
            onBlur={dismissMenu}
            ref={el => el?.focus()}
        >
            <Menu
                popover={popover}
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
                        <ContextMenuItemContainer enabled={item.enabled}>
                            <span>{item.label}</span>
                            {renderShortcut(item.keyEquivalent)}
                        </ContextMenuItemContainer>
                    ) : (
                        <ContextMenuSeparator />
                    )
                }
            </Menu>
        </div>
    );
}
