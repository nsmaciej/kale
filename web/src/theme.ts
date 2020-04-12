import { Padding } from "geometry";
import { assert } from "utils";

type HighlightPair = [string | undefined, string | undefined];

export class Highlight {
    animates = false;
    droppable = false;
    private readonly focusedPair: HighlightPair;
    private blurredPair: HighlightPair;
    private blankPair?: HighlightPair;

    constructor(readonly name: string, fill?: string, stroke?: string) {
        this.focusedPair = [fill, stroke];
        this.blurredPair = [fill, stroke];
    }

    /** This highlight should animate when changed. */
    withAnimation(): this {
        this.animates = true;
        return this;
    }
    /** Enable drawing the drobbale-shadow for this highlight. */
    withDroppable(): this {
        this.droppable = true;
        return this;
    }
    /** Sets an alternative blurred appearance. */
    blurred(fill?: string, stroke?: string): this {
        this.blurredPair = [fill, stroke];
        return this;
    }
    /** Sets an alternative appearance for blanks. */
    blank(fill?: string, stroke?: string): this {
        this.blankPair = [fill, stroke];
        return this;
    }

    fill(focused: boolean) {
        return (focused ? this.focusedPair : this.blurredPair)[0];
    }
    stroke(focused: boolean) {
        return (focused ? this.focusedPair : this.blurredPair)[1];
    }
    blankFill(focused: boolean): string | undefined {
        return this.blankPair?.[0] ?? this.fill(focused);
    }
    blankStroke(focused: boolean): string | undefined {
        return this.blankPair?.[1] ?? this.stroke(focused);
    }
}

const colour = {
    /** Everything that needs to be clickable */
    clickable: "#1666ff",
    /** Even more clickable stuff, like context menus. */
    brightClickable: "#0672ff",
    /** Accent colour for less clickable stuff. */
    subtleClickable: "#e4e4e4",
    /** Search box etc. */
    subtleClickableDark: "#e8e8e8",
    active: "#003fb7",
    brand: "#0ba902",
    error: "#f44336",
    /** The main background used by the page */
    background: "#ffffff",
    /** Alternative background to suggest nesting, including buttons. */
    innerBackground: "#fafafb",
    /** Background used for pop-ups (brigher in dark mode) */
    popupBackground: "#ffffff",
    /** Disabled text colour */
    disabled: "#d8d8d8",
    /** Text that does not need to be as visible. */
    subtleText: "#7b7b7b",
    /**  Text inside buttons. */
    buttonText: "#232323",
    /** Text colour. */
    mainText: "#111111",
};

// This needs to be shared between SVG and HTML.
const droppable = {
    radius: 3,
    colour: colour.clickable,
};

// Until https://github.com/Popmotion/popmotion/pull/868 gets merged we have to use rgba notation.
const transparentWhite = "rgba(1, 1, 1, 0)";

export const DefaultTheme = {
    colour,
    droppable,

    general: {
        borderRadius: 5,
    },

    shadow: {
        normal: "0 0 0 1px #10161a1a, 0 2px 4px #10161a33, 0 8px 24px #10161a33",
        // Mostly used by popover's triangle, since the 24px spread shadow above clips.
        small: "0 0 0 1px #10161a1a, 0 2px 4px #10161a33",
    },

    expr: {
        fontSizePx: 12,
        fontFamily: "iA Writer Quattro",
    },

    exprList: {
        borderRadius: 8,
        padding: new Padding(0),
    },

    exprView: {
        // This can be used to horizontally align things like headings to the text inside ExprView.
        get padding() {
            return DefaultTheme.highlight.mainPadding.add(droppable.radius);
        },
        get widePadding() {
            return DefaultTheme.highlight.padding.add(droppable.radius).add(3);
        },
    },

    syntaxColour: {
        call: colour.mainText,
        comment: "#00b508",
        variable: "#248af0",
        literal: "#ef6c00",
        disabled: "#cccccc",
        underline: "#6a6a6a",
        listRuler: "#000000",
    },

    blank: {
        padding: new Padding(1, 10, 0),
        textColour: "#909090",
        resting: new Highlight("selection", "#f7f7f7", "#dcdcdc"),
        // Space out the blanks from the underlines and such.
        margin: new Padding(0, 0, 1),
    },

    highlight: {
        padding: new Padding(3),
        //TODO: Remove this.
        mainPadding: new Padding(3),
        radius: 3,
        selection: new Highlight("selection", "#f5f9ff", "#1b65f1")
            .blurred("#fcfdff", "#edeffc")
            .withAnimation(),
        hover: new Highlight("hover", undefined, "#cecece").blank("#efefef", "#dcdcdc"),
        contextMenu: new Highlight("context", undefined, "#248af0"),
        droppable: new Highlight("droppable", transparentWhite, colour.clickable).withDroppable(),
    },

    layout: {
        maxNesting: 4,
        lineBreakPoint: 300,
        underlineSpacing: 3,
        lineSpacing: 7, // Should be bigger than the selection padding.
    },

    feature: {
        exprListShortcuts: true,
        toyBox: true,
    },
};

export type KaleTheme = typeof DefaultTheme;

function updateTheme(partial: { [p in keyof KaleTheme]?: Partial<KaleTheme[p]> }): KaleTheme {
    const result = {} as { [k: string]: unknown };
    for (const category of Object.keys(DefaultTheme) as (keyof KaleTheme)[]) {
        result[category] = Object.assign({}, DefaultTheme[category], partial[category]);
    }
    return result as KaleTheme;
}

export const DarkTheme = updateTheme({
    colour: {
        clickable: "#70aeff",
        brightClickable: "#2483ff",
        subtleClickable: "#363636",
        subtleClickableDark: "#424242",
        active: "#2483ff",
        brand: "#0dde02",
        background: "#202020",
        innerBackground: "#282828",
        popupBackground: "#282828",
        disabled: "#424242",
        buttonText: "#dddddd",
        mainText: "#ffffff",
    },
    shadow: {
        normal: "0 0 0 1px #505050, 0 2px 4px #00000033, 0 8px 24px #00000033",
        small: "0 0 0 1px #505050, 0 2px 4px #00000033",
    },

    highlight: {
        hover: new Highlight("hover", undefined, "#515151").blank("#404040", "#525252"),
        selection: new Highlight("selection", "#2f2f2f", "#73c7ff")
            .blurred("#232323", "#004488")
            .withAnimation(),
    },
    blank: {
        textColour: "#d2d2d2",
        resting: new Highlight("selection", "#353535", "#404040"),
    },
    syntaxColour: {
        call: "#ffffff",
        comment: "#15d131",
        variable: "#2da3ff",
        literal: "#fd8b21",
        underline: "#d2d2d2",
        listRuler: "#ffffff",
    },
});

assert(
    DefaultTheme.highlight.padding.bottom + DefaultTheme.highlight.padding.top <
        DefaultTheme.layout.lineSpacing,
    "Vertical highlight padding needs to fit in the line-height",
);
assert(
    DefaultTheme.highlight.mainPadding.contains(DefaultTheme.highlight.padding),
    "Main padding needs to be at least as big as the normal padding",
);

// Augument the DefaultTheme type.
// See: https://github.com/styled-components/styled-components-website/issues/447
// and DefaultTheme comments for more.
declare module "styled-components" {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    export interface DefaultTheme extends KaleTheme {}
}
