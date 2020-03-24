import React, { useContext } from "react";

import { assertSome } from "utils";
import { KaleTheme, Theme } from "contexts/theme";
import SegmentButton from "components/segment_button";

export default function ThemeSwitcher() {
    const { theme, setTheme } = assertSome(useContext(KaleTheme));
    const themes: Theme[] = ["Auto", "Dark", "Light"];
    return (
        <SegmentButton
            labels={themes}
            active={theme}
            onClick={(label) => setTheme(label as Theme)}
        />
    );
}
