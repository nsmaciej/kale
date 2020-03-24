import { ThemeProvider } from "styled-components";
import React, { ReactNode, useContext } from "react";

import { DefaultTheme, DarkTheme } from "theme";
import { useMediaQuery } from "hooks";
import { assertSome } from "utils";

const Themes = {
    Light: DefaultTheme,
    Dark: DarkTheme,
};
type Theme = keyof typeof Themes;

const KaleTheme = React.createContext<{ theme: Theme } | null>(null);

export function KaleThemeProvider({ children }: { children: ReactNode }) {
    const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
    const theme = prefersDark ? "Dark" : "Light";
    return (
        <KaleTheme.Provider value={{ theme }}>
            <ThemeProvider theme={Themes[theme]}>{children}</ThemeProvider>
        </KaleTheme.Provider>
    );
}

/** Checks whether the user is using a dark theme. */
export function useUsesDarkTheme(): boolean {
    const { theme } = assertSome(useContext(KaleTheme));
    return theme === "Dark";
}
