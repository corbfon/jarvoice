const path = require("path");
const nodeExternals = require("webpack-node-externals");
const webpack = require("webpack");

module.exports = {
  target: "node",
  entry: "./handler.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "handler.js",
    libraryTarget: "commonjs2",
  },
  mode: "production",
  externals: [
    nodeExternals({
      allowlist: [/^@?(\w|[\u00C0-\u1FFF\u2C00-\uD7FF]|-|_)+(?<!aws-sdk)/], // Allow all dependencies except aws-sdk
    }),
  ],
  optimization: {
    minimize: false,
  },
};