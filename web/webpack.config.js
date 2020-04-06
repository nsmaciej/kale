const path = require("path");

const createStyledComponentsTransformer = require("typescript-plugin-styled-components").default;
const styledComponentsTransformer = createStyledComponentsTransformer({ minify: true });

module.exports = {
    context: path.resolve(__dirname, "src"),
    entry: "./main.tsx",
    devtool: "source-map",
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: {
                    loader: "ts-loader",
                    options: {
                        getCustomTransformers: () => ({ before: [styledComponentsTransformer] }),
                    },
                },
            },
        ],
    },
    devServer: {
        publicPath: "/dist/",
        overlay: true,
        hot: true,
    },
    resolve: {
        modules: [path.resolve(__dirname, "src"), "node_modules"],
        extensions: [".tsx", ".ts", ".js"],
    },
    output: {
        filename: "main.js",
        path: path.resolve(__dirname, "dist"),
    },
};
