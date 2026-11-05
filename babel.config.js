// The worklets plugin turns functions marked 'worklet' into code that the camera's frame
// processor can run on its own thread.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets-core/plugin'],
  };
};
