import { ThemeProvider } from "styled-components";
import React, { ReactNode, useContext } from "react";

import { DefaultTheme, DarkTheme } from "theme";
import { useMediaQuery, usePersistedState } from "hooks";
import { assertSome } from "utils";

const Themes = {
    Light: DefaultTheme,
    Dark: DarkTheme,
};

export type Theme = keyof typeof Themes | "Auto";

export interface KaleThemeContext {
    theme: Theme;
    actualTheme: keyof typeof Themes;
    setTheme(theme: Theme): void;
}

export const KaleTheme = React.createContext<KaleThemeContext | null>(null);

export function KaleThemeProvider({ children }: { children: ReactNode }) {
    const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
    const [preference, setPreference] = usePersistedState<Theme>("theme", "Auto");
    const theme = preference === "Auto" ? (prefersDark ? "Dark" : "Light") : preference;
    return (
        <KaleTheme.Provider
            value={{ theme: preference, actualTheme: theme, setTheme: setPreference }}
        >
            <ThemeProvider theme={Themes[theme]}>{children}</ThemeProvider>
        </KaleTheme.Provider>
    );
}

/** Checks whether the user is using a dark theme. */
export function useUsesDarkTheme(): boolean {
    const { actualTheme } = assertSome(useContext(KaleTheme));
    return actualTheme === "Dark";
}
