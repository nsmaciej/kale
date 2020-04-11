import { AiOutlineGithub } from "react-icons/ai";
import { createStore } from "redux";
import { Provider } from "react-redux";
import { ToastProvider } from "react-toast-notifications";
import React, { useRef } from "react";
import ReactDOM from "react-dom";
import styled, { createGlobalStyle } from "styled-components";

import { DefaultTheme } from "theme";
import { mod } from "utils";
import { Stack, Box } from "components";
import { useContextChecked } from "hooks";
import TextMetrics from "text_metrics";
import Root from "state/root";

import { DebuggerProvider } from "contexts/debugger";
import { DragAndDropSurface } from "contexts/drag_and_drop";
import { KaleThemeProvider } from "contexts/theme";
import EditorStack, { EditorStackProvider } from "contexts/editor_stack";

import ClipboardList from "components/clipboard_list";
import EditorList from "components/editor_list";
import EditorSuggestions from "components/editor_suggestions";
import ErrorBoundary from "components/error_boundary";
import ThemeSwitcher from "components/theme_switcher";
import ToyBox from "components/toy_box";

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
    color: ${(p) => p.theme.colour.mainText};
    background: ${(p) => p.theme.colour.background};
    /* Nothing is selectable by default. This used to not be true, but Safari is overzealous with
    selection while dragging. In the future this should be fixed to allow selecting p and a. */
    user-select: none;
    /* Prevent body scrolling on mobile. */
    overflow: hidden;
}
p {
    line-height: 1.5;
    font-variant-numeric: oldstyle-nums;
}
a {
    color: ${(p) => p.theme.colour.clickable};
    display: inline-block;
    text-decoration: none;
    /* In case we embed SVGs etc. */
    cursor: pointer;
    &:hover {
        color: ${(p) => p.theme.colour.active};
    }
}
/* Reset most of the button styles */
button {
    font: inherit;
    color: inherit;
    background: none;
    border: none;
    font-weight: 600;
    display: block;
    outline: none;
}
`;

const Container = styled.div`
    display: grid;
    grid-template:
        "nav nav nav" min-content
        "toybox editor history" 1fr
        "hints hints hints" min-content /
        max-content minmax(300px, 1fr) max-content;
    gap: 20px;
    height: 100%;
    position: relative;
`;

const HeaderGrid = styled.div`
    grid-area: nav;
    display: grid;
    grid-template: "branding search menu" / minmax(max-content, 1fr) max-content minmax(
            max-content,
            1fr
        );
    align-items: center;
    gap: 10px;
    padding: 10px 20px;
    background: ${(p) => p.theme.colour.innerBackground};
    border-bottom: 1px solid ${(p) => p.theme.colour.subtleClickable};
`;

const MainHeading = styled.h1`
    font-weight: 900;
    color: ${(p) => p.theme.colour.brand};
    letter-spacing: 2px;
`;

function Kale() {
    // eslint-disable-next-line no-console
    console.log("Rendering everything");
    const functionSearchRef = useRef<HTMLInputElement>(null);
    const editorStack = useContextChecked(EditorStack);

    function moveFocus(move: 1 | -1) {
        if (!editorStack.stack.length) return;
        let index;
        if (editorStack.lastFocus === null) {
            index = move === 1 ? 0 : editorStack.stack.length - 1;
        } else {
            index = mod(
                editorStack.stack.findIndex((x) => x.key === editorStack.lastFocus) + move,
                editorStack.stack.length,
            );
        }
        editorStack.refs.get(editorStack.stack[index].key)?.current.focus();
    }

    function keyDown(event: React.KeyboardEvent) {
        const key = event.key;
        if (key === "/") {
            functionSearchRef.current?.focus();
        } else if (key === "J" || (key === "ArrowDown" && event.shiftKey)) {
            moveFocus(1);
        } else if (key === "K" || (key === "ArrowUp" && event.shiftKey)) {
            moveFocus(-1);
        } else if (key === "D") {
            if (editorStack.lastFocus !== null) {
                editorStack.removeEditor(editorStack.lastFocus);
            }
        } else if (key === "O") {
            editorStack.jumpBack();
        } else {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
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
                    <EditorSuggestions ref={functionSearchRef} />
                </Box>
                <Stack gap={15} alignItems="center" gridArea="menu" justifySelf="end">
                    <ThemeSwitcher />
                    <a
                        href="https://github.com/mgoszcz2/kale"
                        target="_blank"
                        rel="noreferrer noopener"
                    >
                        <AiOutlineGithub size="2em" title="Open on GitHub" />
                    </a>
                </Stack>
            </HeaderGrid>
            <Box paddingLeft={20}>
                <ToyBox />
            </Box>
            <EditorList />
            <Box paddingRight={20}>
                <ClipboardList />
            </Box>
            {/* <Hints /> */}
        </Container>
    );
}

const store = createStore(
    Root.reducer,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__REDUX_DEVTOOLS_EXTENSION__ && (window as any).__REDUX_DEVTOOLS_EXTENSION__(),
);
function App() {
    return (
        <React.StrictMode>
            <Provider store={store}>
                <KaleThemeProvider>
                    <GlobalStyle />
                    <ToastProvider>
                        <ErrorBoundary>
                            <DragAndDropSurface>
                                <EditorStackProvider>
                                    <DebuggerProvider>
                                        <Kale />
                                    </DebuggerProvider>
                                </EditorStackProvider>
                            </DragAndDropSurface>
                        </ErrorBoundary>
                    </ToastProvider>
                </KaleThemeProvider>
            </Provider>
        </React.StrictMode>
    );
}

document.addEventListener("DOMContentLoaded", () => {
    TextMetrics.loadGlobal(DefaultTheme).then(() => {
        ReactDOM.render(<App />, document.getElementById("main"));
    });
});
