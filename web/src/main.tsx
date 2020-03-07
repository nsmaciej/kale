import * as ReactDOM from "react-dom";
import React from "react";
import styled, { ThemeProvider, StyleSheetManager, createGlobalStyle } from "styled-components";

import { DragAndDropSurface } from "expr_view";
import TextMetrics from "text_metrics";
import { DefaultTheme } from "theme";
import { Stack, Shortcut } from "components";
import { WorkspaceProvider, ClipboardProvider } from "workspace";
import { ToyBox, ClipboardList, EditorStack } from "panes";

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
    color: ${p => p.theme.mainTextColour};
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
`;

const Container = styled.div`
    display: grid;
    grid-template-areas:
        "nav nav nav"
        "toybox editor history";
    grid-template-rows: min-content auto;
    grid-template-columns: max-content minmax(min-content, auto) max-content;
    gap: 20px 40px;
    padding: 15px 20px 0;
    height: 100%;
    position: relative;
`;

const HeaderStack = styled(Stack)`
    grid-area: nav;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 15px;
    border-bottom: 1px solid ${p => p.theme.grey};
`;

const MainHeading = styled.h1`
    font-weight: 900;
    font-size: 25px;
    color: #0ba902;
    letter-spacing: 2px;
`;

function Help() {
    const S = Shortcut;
    return (
        <p style={{ maxWidth: "800px" }}>
            Use <S>H</S> <S>J</S> <S>K</S> <S>L</S> to move around. Fill in the blanks with{" "}
            <S>Tab</S>. Use <S>Backspace</S> or <S>D</S> to Delete and <S>C</S> to Copy. Create
            blanks with the circular buttons or <S>A</S> or <S>I</S>. Paste items from history using{" "}
            <S>0</S>-<S>9</S>. Fold comments with <S>#</S> &mdash; <b>Help is on the way!</b>
        </p>
    );
}

function Kale() {
    return (
        <Container>
            <HeaderStack>
                <Stack gap={15} alignItems="center" width="300px">
                    <MainHeading>Kale</MainHeading>
                    <p>
                        A visual programming project made by{" "}
                        <a href="https://maciej.ie">Maciej Goszczycki</a>
                    </p>
                </Stack>
                <Help />
            </HeaderStack>
            <ToyBox />
            <EditorStack />
            <ClipboardList />
        </Container>
    );
}

function App() {
    return (
        <React.StrictMode>
            <StyleSheetManager disableVendorPrefixes>
                <ThemeProvider theme={DefaultTheme}>
                    <DragAndDropSurface>
                        <WorkspaceProvider>
                            <ClipboardProvider>
                                <GlobalStyle />
                                <Kale />
                            </ClipboardProvider>
                        </WorkspaceProvider>
                    </DragAndDropSurface>
                </ThemeProvider>
            </StyleSheetManager>
        </React.StrictMode>
    );
}

document.addEventListener("DOMContentLoaded", () => {
    TextMetrics.loadGlobal(DefaultTheme).then(() => {
        ReactDOM.render(<App />, document.getElementById("main"));
    });
});
