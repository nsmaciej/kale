import React from "react";
import styled from "styled-components";

import Shortcut from "components/shortcut";

const HintContainer = styled.div`
    grid-area: hints;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 15px 10px;
    padding-bottom: 20px;
`;

const Hint = styled.div`
    width: 90px;
    display: inline-block;
    text-align: right;
    padding-right: 10px;
`;

export default function Hints() {
    function hint(shortcut: string | string[], description: string) {
        return (
            <div>
                <Hint>
                    <Shortcut keys={shortcut} />
                </Hint>
                {description}
            </div>
        );
    }
    return (
        <HintContainer>
            {hint("Left", "Select Previous")}
            {hint("Right", "Select Next")}
            {hint("Down", "Select Line Down")}
            {hint("Up", "Select Line Up")}
            {hint("Tab", "Select Next Blank")}
            {hint("p", "Select Parent")}
            {hint(["Shift", "Left"], "Select Left")}
            {hint(["Shift", "Right"], "Select Right")}
            {hint(["Shift", "Down"], "Focus Editor Down")}
            {hint(["Shift", "Up"], "Focus Editor Up")}
            {hint("D", "Close Editor")}
            {hint("O", "Jump to Previous Editor")}
        </HintContainer>
    );
}
