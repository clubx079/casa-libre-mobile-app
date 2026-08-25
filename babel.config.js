module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo (SDK 54) auto-configures react-native-worklets/reanimated
    // and expo-router — no manual plugins needed.
    presets: ['babel-preset-expo'],
  };
};
