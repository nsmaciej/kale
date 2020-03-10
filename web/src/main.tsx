import * as ReactDOM from "react-dom";
import React from "react";
import styled, { ThemeProvider, StyleSheetManager, createGlobalStyle } from "styled-components";

import DragAndDropSurface from "drag_and_drop";
import TextMetrics from "text_metrics";
import { DefaultTheme } from "theme";
import { WorkspaceProvider, ClipboardProvider } from "workspace";
import { Stack, Shortcut, ShortcutGroup } from "components";
import EditorStack from "components/editor_stack";
import ToyBox from "components/toy_box";
import ClipboardList from "components/clipboard_list";

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
a {
    color: ${p => p.theme.clickableColour};
}
`;

const Container = styled.div`
    display: grid;
    grid-template-areas:
        "nav nav nav"
        "toybox editor history";
    grid-template-rows: min-content auto;
    grid-template-columns: max-content minmax(min-content, 1fr) max-content;
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
    const Sg = ShortcutGroup;
    return (
        <p style={{ maxWidth: "700px" }}>
            Use{" "}
            <Sg>
                <S>→</S> <S>↓</S> <S>←</S> <S>↑</S>
            </Sg>{" "}
            (or{" "}
            <Sg>
                <S>H</S> <S>J</S> <S>K</S> <S>L</S>
            </Sg>
            ) to move around. Jump to the next blank with <S>Tab</S> and paste snippets from History
            using{" "}
            <Sg>
                <S>0</S>-<S>9</S>
            </Sg>
            . Right-click code for more options and shortcuts. <b>More help is on the way!</b>
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
