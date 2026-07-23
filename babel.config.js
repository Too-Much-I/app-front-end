module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
    plugins: [
      [
        "module-resolver",
        {
          root: ["./"],
          alias: {
            "@": "./src",
          },
        },
      ],
      // react-native-worklets/plugin은 반드시 plugins 배열의 마지막에 와야 한다.
      "react-native-worklets/plugin",
    ],
  };
};
