import { spawn } from 'node:child_process';
const child = spawn('pnpm', ['exec', 'expo', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: {
    ...process.env,
    LEARNING_SAMPLE: '1',
    EXPO_NO_TELEMETRY: '1',
    EXPO_NO_DOTENV: '1',
    EXPO_PUBLIC_ENABLE_SENTRY: 'false',
    EXPO_PUBLIC_ENABLE_AMPLITUDE: 'false',
    EXPO_PUBLIC_ENABLE_CLARITY: 'false',
    EXPO_PUBLIC_ENABLE_AD_CONVERSION: 'false',
  },
});
child.on('exit', (code) => process.exit(code ?? 1));
