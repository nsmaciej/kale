import * as ReactDOM from "react-dom";
import React, { Component } from "react";
import styled, { StyleSheetManager, createGlobalStyle } from "styled-components";

import { DragAndDropSurface } from "./expr_view";
import TextMetrics from "./text_metrics";
import THEME from "./theme";
import { Box, Stack, Shortcut } from "./components";
import { WorkspaceProvider, ClipboardProvider } from "./workspace";
import { ToyBox, ClipboardList, EditorStack } from "./panes";

const GlobalStyle = createGlobalStyle`
#main {
    position: absolute;
    top: 0;
    height: 100%;
    width: 100%;
}
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    outline: 0;
}
body {
    font: 14px/1 "Nunito", sans-serif;
    color: #404040;
}
p {
    line-height: 1.8;
    font-variant-numeric: oldstyle-nums;
}
/* Nothing inside svgs should be selectable */
svg * {
    user-select: none;
    cursor: default;
}
h1, h2, h3 {
    user-select: none;
}
h1 {
    font-weight: 900;
    font-size: 25px;
}
h2 {
    font-weight: 700;
    font-size: 20px;
}
h3 {
    font-weight: 500;
    font-size: 20px;
}
`;

function Help() {
    const S = Shortcut;
    return (
        <p style={{ maxWidth: "700px" }}>
            Use <S>H</S> <S>J</S> <S>K</S> <S>L</S> to move around. Fill in the blanks with{" "}
            <S>Tab</S>. Use <S>Backspace</S> to Delete and <S>C</S> to Copy. Create blanks with the
            circular buttons or <S>A</S> or <S>I</S>. Paste items from history using <S>0</S>-
            <S>9</S> &mdash; <b>Help is on the way!</b>
        </p>
    );
}

class Kale extends Component {
    private static readonly Container = styled.div`
        display: grid;
        grid-template-areas:
            "nav nav nav"
            "toybox editor history";
        grid-template-rows: min-content auto;
        grid-template-columns: max-content minmax(min-content, auto) max-content;
        gap: 20px 40px;
        padding: 15px 20px 0;
        height: 100%;
    `;

    private static readonly Heading = styled.h1`
        color: #0ba902;
        letter-spacing: 2px;
    `;

    render() {
        return (
            <React.StrictMode>
                <StyleSheetManager disableVendorPrefixes>
                    <DragAndDropSurface>
                        <WorkspaceProvider>
                            <ClipboardProvider>
                                <GlobalStyle />
                                <Kale.Container>
                                    <Stack
                                        gridArea="nav"
                                        gap={10}
                                        alignItems="center"
                                        justifyContent="space-between"
                                        paddingBottom={15}
                                        borderBottom="1px solid #e4e4e4"
                                    >
                                        <Kale.Heading>Kale</Kale.Heading>
                                        <Help />
                                    </Stack>

                                    {THEME.showingToyBox && <ToyBox />}
                                    <EditorStack />
                                    <ClipboardList />
                                </Kale.Container>
                            </ClipboardProvider>
                        </WorkspaceProvider>
                    </DragAndDropSurface>
                </StyleSheetManager>
            </React.StrictMode>
        );
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await TextMetrics.loadGlobal();
    ReactDOM.render(<Kale />, document.getElementById("main"));
});
