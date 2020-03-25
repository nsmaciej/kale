import React from "react";

import { KaleTheme, Theme } from "contexts/theme";
import { useContextChecked } from "hooks";
import SegmentButton from "components/segment_button";

export default function ThemeSwitcher() {
    const { theme, setTheme } = useContextChecked(KaleTheme);
    const themes: Theme[] = ["Auto", "Dark", "Light"];
    return <SegmentButton labels={themes} active={theme} onClick={(label) => setTheme(label)} />;
}
