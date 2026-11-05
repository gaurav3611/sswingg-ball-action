const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// The pose model is a bundled .tflite file.
config.resolver.assetExts.push('tflite');

module.exports = config;
