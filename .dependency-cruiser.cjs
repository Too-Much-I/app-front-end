/** @type {import("dependency-cruiser").IConfiguration} */
module.exports = {
  // 그래프 생성과 scripts/check-architecture.mjs가 같은 의존성 해석 기준을 공유한다.
  // 이름 단위 경계까지 함께 판단해야 하므로 차단과 경고 분류는 검사 스크립트가 맡는다.
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
