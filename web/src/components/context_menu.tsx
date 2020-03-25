import React, { useState, useLayoutEffect, useRef } from "react";
import styled from "styled-components";

import { Offset, Rect } from "geometry";
import { Optional, mod, assert, delay } from "utils";
import { useDisableScrolling } from "hooks";
import Menu, { MenuItem } from "components/menu";
import Shortcut from "components/shortcut";

const ContextMenuSeparator = styled.div`
    height: 0;
    border-bottom: 1px solid ${(p) => p.theme.colour.disabled};
    width: 100%;
    margin: 2px 0;
`;

const ContextMenuItemContainer = styled.div`
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
    hidden?: boolean;
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
    const [showingHidden, setShowingHidden] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [adjustedOrigin, setAdjustedOrigin] = useState(origin);

    // Make sure the menu is always visible.
    useLayoutEffect(() => {
        if (containerRef.current !== null) {
            const rect = Rect.fromBoundingRect(containerRef.current.getBoundingClientRect());
            const menuBottom = rect.height + rect.y + 10;
            const overflow = document.documentElement.clientHeight - menuBottom;
            setAdjustedOrigin(origin.dy(Math.min(0, overflow)));
        }
    }, [origin]);

    /**
     * Moves selection skipping past separators, if the menu consists of only separators, bad
     * things(tm) will happen. */
    function moveSelection(delta: 1 | -1) {
        setSelection((current) => {
            let next = mod(
                current === null ? (delta === -1 ? -1 : 0) : current + delta,
                items.length,
            );
            while (items[next].label == null) {
                next = mod(next + delta, items.length);
            }
            return next;
        });
    }

    async function onClick(item: ContextMenuItem, index: number) {
        if (blinking) false;
        setBlinking(true);

        // Blink the menu. See Chrome's
        // src/ui/views/controls/menu/menu_closure_animation_mac.h for how big-boys do this.
        const offDuration = 100;
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

    function onKeyUp(e: React.KeyboardEvent) {
        if (e.ctrlKey || e.metaKey) return;
        e.stopPropagation();
        if (e.key === "Alt") setShowingHidden(false);
    }

    function onKeyDown(e: React.KeyboardEvent) {
        // Chrome's src/ui/views/controls/menu/menu_controller.cc is a great source for these.
        if (e.ctrlKey || e.metaKey) return;
        // Pressing Alt allows showing hidden menu items.
        if (e.altKey && e.key !== "Alt") return;
        e.stopPropagation();
        e.preventDefault();
        switch (e.key) {
            case "Alt":
                setShowingHidden(true);
                break;
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
            case "Space":
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
                        if (!item.disabled) onClick(item, i);
                        return;
                    }
                    i++;
                }
            }
        }
    }

    return (
        <div
            style={{
                position: "fixed",
                left: adjustedOrigin.x,
                top: adjustedOrigin.y,
                zIndex: 100,
            }}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
            tabIndex={0}
            onBlur={dismissMenu}
            ref={(el) => el?.focus()}
        >
            <Menu
                popover={popover}
                selected={selection}
                items={items}
                onClick={onClick}
                containerRef={containerRef}
                // Do not allow selecting separators.
                onSetSelected={(i) =>
                    blinking || setSelection(i != null && items[i].label != null ? i : null)
                }
                minimalPadding={(i) =>
                    items[i].label == null || (items[i].hidden === true && !showingHidden)
                }
            >
                {(item) =>
                    (!item.hidden || showingHidden) &&
                    (item.label ? (
                        <ContextMenuItemContainer>
                            <span>{item.label}</span>
                            {item.keyEquivalent && <Shortcut subtle keys={item.keyEquivalent} />}
                        </ContextMenuItemContainer>
                    ) : (
                        <ContextMenuSeparator />
                    ))
                }
            </Menu>
        </div>
    );
}
