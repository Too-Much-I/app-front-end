/** @type {import("dependency-cruiser").IConfiguration} */
module.exports = {
  // 이 설정은 구조를 관찰하기 위한 스냅샷용이다. 금지 규칙과 CI 게이트는 의도적으로 두지 않는다.
  forbidden: [],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    includeOnly: {
      path: "^(?:index[.]ts|App[.]tsx|src/)",
    },
    tsConfig: {
      fileName: "tsconfig.json",
    },
    // 타입 경계도 구조의 일부다. 런타임 의존성과 구분할 수 있도록 표시해 함께 수집한다.
    tsPreCompilationDeps: "specify",
    enhancedResolveOptions: {
      conditionNames: ["react-native", "browser", "import", "require", "default", "types"],
      extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
    },
  },
};
