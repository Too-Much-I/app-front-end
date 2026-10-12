const path = require('node:path');

// Substitute only the learning I/O boundaries and entry point. No production file changes.
module.exports = function withLearningSample(config, root) {
  const paths = [
    'src/features/learning/api/get-learning-unit.ts',
    'src/features/learning/api/get-learning-units.ts',
    'src/features/learning/api/put-learning-completion.ts',
    'src/features/learning/api/resolve-learning-media.ts',
    'src/features/learning/learning-submission-api.ts',
  ];
  const replacements = new Map(
    paths.map((file) => [
      path.join(root, file),
      path.join(root, 'examples/learning-sample/sample-api.ts'),
    ]),
  );
  replacements.set(
    path.join(root, 'index.ts'),
    path.join(root, 'examples/learning-sample/index.tsx'),
  );
  const previous = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const resolved = previous
      ? previous(context, moduleName, platform)
      : context.resolveRequest(context, moduleName, platform);
    return resolved.type === 'sourceFile' && replacements.has(resolved.filePath)
      ? { ...resolved, filePath: replacements.get(resolved.filePath) }
      : resolved;
  };
  return config;
};
