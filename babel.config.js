module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          native: {
            // React Native 0.88 ships modern JS (e.g. `#private` class fields) that only Hermes V1
            // understands. Older runtimes (an Expo Go / dev client with legacy Hermes) crash with
            // "SyntaxError: private properties are not supported". This profile transpiles that
            // syntax so the bundle runs on both old and new Hermes.
            unstable_transformProfile: 'hermes-v0',
          },
        },
      ],
    ],
  };
};
