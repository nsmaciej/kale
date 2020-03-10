import * as ReactDOM from "react-dom";
import React, { useState } from "react";
import styled, {
    ThemeProvider,
    StyleSheetManager,
    createGlobalStyle,
    useTheme,
} from "styled-components";
import { AiOutlineGithub } from "react-icons/ai";

import DragAndDropSurface from "drag_and_drop";
import TextMetrics from "text_metrics";
import { DefaultTheme } from "theme";
import { WorkspaceProvider, ClipboardProvider } from "workspace";
import { Stack, Box } from "components";
import EditorStack, { OpenEditor } from "components/editor_stack";
import ToyBox from "components/toy_box";
import ClipboardList from "components/clipboard_list";
import EditorSuggestions from "components/editor_suggestions";
import { removeIndex } from "utils";

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
    font-size: 25px;
    color: #0ba902;
    letter-spacing: 2px;
`;

// function Help() {
//     const S = Shortcut;
//     const Sg = ShortcutGroup;
//     return (
//         <p style={{ maxWidth: "700px" }}>
//             Use{" "}
//             <Sg>
//                 <S>→</S> <S>↓</S> <S>←</S> <S>↑</S>
//             </Sg>{" "}
//             (or{" "}
//             <Sg>
//                 <S>H</S> <S>J</S> <S>K</S> <S>L</S>
//             </Sg>
//             ) to move around. Jump to the next blank with <S>Tab</S> and paste snippets from History
//             using{" "}
//             <Sg>
//                 <S>0</S>-<S>9</S>
//             </Sg>
//             . Right-click code for more options and shortcuts. <b>More help is on the way!</b>
//         </p>
//     );
// }

let GlobalEditorId = 1;

function Kale() {
    const theme = useTheme();
    const [editors, setEditors] = useState<OpenEditor[]>([
        { topLevel: "Sample 1", id: GlobalEditorId++ },
        { topLevel: "Sample 1", id: GlobalEditorId++ },
    ]);
    return (
        <Container>
            <HeaderGrid>
                <Stack gap={15} alignItems="center" width="300px" gridArea="branding">
                    <MainHeading>Kale</MainHeading>
                    <p>
                        A visual programming project made by{" "}
                        <a href="https://maciej.ie">Maciej Goszczycki</a>
                    </p>
                </Stack>
                <Box gridArea="search">
                    <EditorSuggestions
                        onCreateEditor={topLevel =>
                            setEditors(xs => [{ topLevel, id: GlobalEditorId++ }, ...xs])
                        }
                    />
                </Box>
                <Box gridArea="menu" justifySelf="end">
                    <a href="https://github.com/mgoszcz2/kale">
                        <AiOutlineGithub
                            size="2em"
                            // color={theme.clickableGrey}
                            title="Open on GitHub"
                        />
                    </a>
                </Box>
            </HeaderGrid>
            <ToyBox />
            <EditorStack editors={editors} onClose={i => setEditors(xs => removeIndex(xs, i))} />
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
