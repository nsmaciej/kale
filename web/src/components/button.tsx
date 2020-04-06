import { AiOutlineCaretDown } from "react-icons/ai";
import React, { ReactNode } from "react";

import { SubtleButton, Stack } from "components";

export interface ButtonProps {
    name?: string;
    icon?: ReactNode;
    menu?: boolean;
    disabled?: boolean;
    onClick?(): void;
}

export default function Button({ name, icon, menu, onClick, disabled }: ButtonProps) {
    return (
        <SubtleButton onClick={onClick} disabled={disabled}>
            <Stack gap={6} justifyContent="center">
                {icon}
                {name && <div>{name}</div>}
                {menu && <AiOutlineCaretDown />}
            </Stack>
        </SubtleButton>
    );
}
