import { spawn } from 'node:child_process';
const env = {
  ...process.env,
  LEARNING_SAMPLE: '1',
  EXPO_NO_TELEMETRY: '1',
  EXPO_NO_DOTENV: '1',
  EXPO_PUBLIC_ENABLE_SENTRY: 'false',
  EXPO_PUBLIC_ENABLE_AMPLITUDE: 'false',
  EXPO_PUBLIC_ENABLE_CLARITY: 'false',
  EXPO_PUBLIC_ENABLE_AD_CONVERSION: 'false',
};
function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['exec', 'expo', ...args], { stdio: 'inherit', env });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
}
const args = process.argv.slice(2);
const platform = { 'run:ios': 'ios', 'run:android': 'android' }[args[0]];
// Regenerate sample configuration after a pull or a switch from the normal app.
// Do not use --clean: native folders may contain the developer's own changes.
if (platform) {
  const result = await run(['prebuild', '--platform', platform, '--no-install']);
  if (result !== 0) process.exit(result);
}
process.exit(await run(args));
