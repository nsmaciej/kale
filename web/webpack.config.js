const path = require("path");

module.exports = {
    context: path.resolve(__dirname, "src"),
    entry: "./main.tsx",
    devtool: "source-map",
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: "ts-loader",
            },
        ],
    },
    devServer: {
        publicPath: "/dist/",
        overlay: true,
        hot: true,
        quiet: true,
        open: true,
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
