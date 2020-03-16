import { AiOutlineGithub } from "react-icons/ai";
import { ToastProvider } from "react-toast-notifications";
import * as ReactDOM from "react-dom";
import React, { useState, useRef } from "react";
import styled, { ThemeProvider, StyleSheetManager, createGlobalStyle } from "styled-components";

import { DefaultTheme } from "theme";
import { removeIndex } from "utils";
import { Stack, Box } from "components";
import DragAndDropSurface from "drag_and_drop";
import TextMetrics from "text_metrics";

import { ClipboardProvider } from "contexts/clipboard";
import { WorkspaceProvider } from "contexts/workspace";

import { DebuggerProvider } from "contexts/debugger";
import ClipboardList from "components/clipboard_list";
import EditorStack, { OpenedEditor } from "components/editor_stack";
import EditorSuggestions from "components/editor_suggestions";
import ErrorBoundary from "components/error_boundary";
import ToyBox from "components/toy_box";
import { useIndex } from "hooks";

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
}
h1, h2, h3 {
    user-select: none;
}
a {
    color: ${p => p.theme.clickableColour};
    display: inline-block;
    text-decoration: none;
    /* In case we embed SVGs etc. */
    cursor: pointer;
    &:hover {
        color: ${p => p.theme.activeColour};
    }
}
`;

const Container = styled.div`
    display: grid;
    grid-template:
        "nav nav nav" min-content
        "toybox editor history" 1fr /
        max-content minmax(min-content, 1fr) max-content;
    gap: 20px 40px;
    padding: 15px 20px 0;
    height: 100%;
    position: relative;
`;

const HeaderGrid = styled.div`
    grid-area: nav;
    display: grid;
    padding-bottom: 15px;
    border-bottom: 1px solid ${p => p.theme.grey};
    grid-template: "branding search menu" / minmax(max-content, 1fr) max-content minmax(
            max-content,
            1fr
        );
    align-items: center;
    gap: 40px;
`;

const MainHeading = styled.h1`
    font-weight: 900;
    color: #0ba902;
    letter-spacing: 2px;
`;

let GlobalEditorId = 1;

function Kale() {
    const [editors, setEditors] = useState<OpenedEditor[]>(() => [
        { name: "Hello-World", key: GlobalEditorId++, ref: React.createRef() },
        { name: "Sample-1", key: GlobalEditorId++, ref: React.createRef() },
        { name: "Sample-2", key: GlobalEditorId++, ref: React.createRef() },
    ]);
    const functionSearchRef = useRef<HTMLInputElement>(null);
    const [focused, setFocused, moveFocused] = useIndex(editors.length, 0);

    function keyDown(event: React.KeyboardEvent) {
        if (event.key === "N") {
            functionSearchRef.current?.focus();
        } else if (event.key === "J") {
            moveFocused(1);
        } else if (event.key === "K") {
            moveFocused(-1);
        } else {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
    }

    function createEditor(name: string) {
        setEditors(xs => [{ name, key: GlobalEditorId++, ref: React.createRef() }, ...xs]);
        setFocused(0);
    }

    function closeEditor(index: number) {
        setEditors(xs => removeIndex(xs, index));
        // Right now every way we can close an editor already does this, but in the future it might
        // be possible to close an editor without switching focus.
        //TODO: Try select a sibling editor instead.
        setFocused(null);
    }

    return (
        <Container onKeyDown={keyDown}>
            <HeaderGrid>
                <Stack gap={15} alignItems="center" width="300px" gridArea="branding">
                    <MainHeading>Kale</MainHeading>
                    <p>
                        A visual programming project made by{" "}
                        <a href="https://maciej.ie">Maciej Goszczycki</a>
                    </p>
                </Stack>
                <Box gridArea="search">
                    <EditorSuggestions ref={functionSearchRef} onOpenEditor={createEditor} />
                </Box>
                <Box gridArea="menu" justifySelf="end">
                    <a href="https://github.com/mgoszcz2/kale">
                        <AiOutlineGithub size="2em" title="Open on GitHub" />
                    </a>
                </Box>
            </HeaderGrid>
            <ToyBox />
            <EditorStack
                editors={editors}
                focused={focused}
                changeFocus={setFocused}
                closeEditor={closeEditor}
                openEditor={createEditor}
            />
            <ClipboardList />
        </Container>
    );
}

function App() {
    return (
        <React.StrictMode>
            <StyleSheetManager disableVendorPrefixes>
                <ThemeProvider theme={DefaultTheme}>
                    <GlobalStyle />
                    <ToastProvider>
                        <ErrorBoundary>
                            <DragAndDropSurface>
                                <WorkspaceProvider>
                                    <DebuggerProvider>
                                        <ClipboardProvider>
                                            <Kale />
                                        </ClipboardProvider>
                                    </DebuggerProvider>
                                </WorkspaceProvider>
                            </DragAndDropSurface>
                        </ErrorBoundary>
                    </ToastProvider>
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
