import React, { useState, useLayoutEffect, useRef, useEffect } from "react";
import styled from "styled-components";

import { Offset, Rect } from "geometry";
import { Optional, mod, assert, eventHasUnwantedModifiers } from "utils";
import { usePlatformModifierKey } from "hooks";
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
    onDismissMenu(): void;
    items: ContextMenuItem[];
    origin: Offset;
    popover?: boolean;
}

export default function ContextMenu({ items, origin, onDismissMenu, popover }: ContextMenuProps) {
    assert(items.length > 0);
    const [selection, setSelection] = useState<number | null>(null);
    const showingHidden = usePlatformModifierKey();
    const containerRef = useRef<HTMLDivElement>(null);
    const [adjustedOrigin, setAdjustedOrigin] = useState(origin);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        wrapperRef.current?.focus();
    }, [wrapperRef]);

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

    function onClick(item: ContextMenuItem) {
        //TODO: Blink the menu if the pointer is a mouse. See Chrome's
        // src/ui/views/controls/menu/menu_closure_animation_mac.h for timing.  This is difficult
        // because if we don't run the action straight away some things like opening software
        // keyboards might not work.
        if (item.label == null) return false;
        item.action?.();
        onDismissMenu();
    }

    function onKeyDown(e: React.KeyboardEvent) {
        if (eventHasUnwantedModifiers(e)) return;
        // Chrome's src/ui/views/controls/menu/menu_controller.cc is a great source for context menu
        // keyboard shortcuts.
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
                onDismissMenu();
                break;
            case "Enter":
            case "Space":
                if (selection) {
                    onClick(items[selection]);
                } else {
                    onDismissMenu();
                }
                break;
            default: {
                for (const item of items) {
                    if (item.keyEquivalent === e.key) {
                        if (!item.disabled) onClick(item);
                        return;
                    }
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
            tabIndex={0}
            onBlur={onDismissMenu}
            ref={wrapperRef}
        >
            <Menu
                popover={popover}
                selected={selection}
                items={items}
                onClick={onClick}
                containerRef={containerRef}
                // Do not allow selecting separators.
                onSetSelected={(i) => setSelection(i != null && items[i].label != null ? i : null)}
                minimalPadding={(i) =>
                    items[i].label == null || (items[i].hidden === true && !showingHidden)
                }
            >
                {(item) =>
                    (!item.hidden || showingHidden) &&
                    (item.label ? (
                        <ContextMenuItemContainer>
                            <span>{item.label}</span>
                            {item.keyEquivalent && <Shortcut keys={item.keyEquivalent} />}
                        </ContextMenuItemContainer>
                    ) : (
                        <ContextMenuSeparator />
                    ))
                }
            </Menu>
        </div>
    );
}
