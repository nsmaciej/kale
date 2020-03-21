import ReactDOM from "react-dom";
import { AiOutlineGithub } from "react-icons/ai";
import { ToastProvider } from "react-toast-notifications";
import React, { useRef, useEffect } from "react";
import styled, { ThemeProvider, createGlobalStyle } from "styled-components";

import { DefaultTheme } from "theme";
import { Stack, Box } from "components";
import DragAndDropSurface from "contexts/drag_and_drop";
import TextMetrics from "text_metrics";

import { ClipboardProvider } from "contexts/clipboard";
import { WorkspaceProvider } from "contexts/workspace";

import { DebuggerProvider } from "contexts/debugger";
import ClipboardList from "components/clipboard_list";
import EditorList from "components/editor_list";
import EditorSuggestions from "components/editor_suggestions";
import ErrorBoundary from "components/error_boundary";
import ToyBox from "components/toy_box";
import useEditorStack from "hooks/editor_stack";

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
    color: ${p => p.theme.colour.mainText};
    background: ${p => p.theme.colour.background};
    /* Nothing is selectable by default. This used to not be true, but Safari is overzealous with
    selection while dragging. In the future this should be fixed to allow selecting p and a. */
    user-select: none;
}
p {
    line-height: 1.8;
    font-variant-numeric: oldstyle-nums;
}
a {
    color: ${p => p.theme.colour.clickable};
    display: inline-block;
    text-decoration: none;
    /* In case we embed SVGs etc. */
    cursor: pointer;
    &:hover {
        color: ${p => p.theme.colour.active};
    }
}
`;

const Container = styled.div`
    display: grid;
    grid-template:
        "nav nav nav" min-content
        "toybox editor history" 1fr /
        max-content 1fr max-content;
    gap: 20px 40px;
    padding: 15px 20px 0;
    height: 100%;
    position: relative;
`;

const HeaderGrid = styled.div`
    grid-area: nav;
    display: grid;
    padding-bottom: 15px;
    border-bottom: 1px solid ${p => p.theme.colour.grey};
    grid-template: "branding search menu" / minmax(max-content, 1fr) max-content minmax(
            max-content,
            1fr
        );
    align-items: center;
    gap: 40px;
`;

const MainHeading = styled.h1`
    font-weight: 900;
    color: ${p => p.theme.colour.brand};
    letter-spacing: 2px;
`;

function Kale() {
    // eslint-disable-next-line no-console
    console.log("Rendering everything");
    const functionSearchRef = useRef<HTMLInputElement>(null);
    const { focus, refs, stack, dispatch } = useEditorStack();

    function keyDown(event: React.KeyboardEvent) {
        const key = event.key;
        if (key === "/") {
            functionSearchRef.current?.focus();
        } else if (key === "J" || (key === "ArrowDown" && event.shiftKey)) {
            dispatch({ type: "moveFocus", move: 1 });
        } else if (key === "K" || (key === "ArrowUp" && event.shiftKey)) {
            dispatch({ type: "moveFocus", move: -1 });
        } else if (key === "D") {
            dispatch({ type: "closeFocusedEditor" });
        } else if (key === "Backspace") {
            dispatch({ type: "jumpBack" });
        } else {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
    }

    // Beware, focus logic relies on being cosistant, if for any reason the focus state
    // does not match the element being focused, a horrible infinite loop might occur.
    useEffect(() => {
        if (focus != null) {
            refs.get(stack[focus].key)?.current?.focus();
        }
    }, [focus, stack, refs]);

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
                    <EditorSuggestions ref={functionSearchRef} editorStackDispatch={dispatch} />
                </Box>
                <Box gridArea="menu" justifySelf="end">
                    <a href="https://github.com/mgoszcz2/kale">
                        <AiOutlineGithub size="2em" title="Open on GitHub" />
                    </a>
                </Box>
            </HeaderGrid>
            <ToyBox />
            <EditorList
                editors={stack}
                editorRefs={refs}
                focused={focus}
                editorStackDispatch={dispatch}
            />
            <ClipboardList />
        </Container>
    );
}

function App() {
    return (
        <React.StrictMode>
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
        </React.StrictMode>
    );
}

document.addEventListener("DOMContentLoaded", () => {
    TextMetrics.loadGlobal(DefaultTheme).then(() => {
        ReactDOM.render(<App />, document.getElementById("main"));
    });
});
