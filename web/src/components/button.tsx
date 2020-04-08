import { AiOutlineCaretDown } from "react-icons/ai";
import React, { ReactNode } from "react";
import styled from "styled-components";

import { ButtonBase, Stack } from "components";

export interface ButtonProps {
    name?: string;
    icon?: ReactNode;
    menu?: boolean;
    disabled?: boolean;
    onClick?(): void;
}

export const ButtonContainer = styled(ButtonBase)`
    border: 1px solid ${(p) => p.theme.colour.subtleClickable};
    border-radius: ${(p) => p.theme.general.borderRadius}px;
    flex: none;
`;

export default function Button({ name, icon, menu, onClick, disabled }: ButtonProps) {
    return (
        <ButtonContainer onClick={onClick} disabled={disabled}>
            <Stack gap={6} justifyContent="center">
                {icon}
                {name && <div>{name}</div>}
                {menu && <AiOutlineCaretDown />}
            </Stack>
        </ButtonContainer>
    );
}
