const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const mobileRoot = path.resolve(__dirname, "../..");
const workspaceRoot = path.resolve(__dirname, "../../../..");
const config = getDefaultConfig(__dirname);

config.watchFolders = [mobileRoot, workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(mobileRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
