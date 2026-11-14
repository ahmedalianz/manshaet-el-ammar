import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const javaCandidates = [
  process.env.JAVA_HOME,
  '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
].filter(Boolean);
let javaHome;
for (const candidate of javaCandidates) {
  const java = join(
    candidate,
    'bin',
    process.platform === 'win32' ? 'java.exe' : 'java',
  );
  if (!existsSync(java)) continue;
  const result = spawnSync(java, ['-version'], { encoding: 'utf8' });
  const major = Number(
    `${result.stderr}${result.stdout}`.match(/version "(\d+)/)?.[1],
  );
  if (result.status === 0 && major >= 21) {
    javaHome = candidate;
    break;
  }
}
if (!javaHome) {
  const result = spawnSync('java', ['-version'], { encoding: 'utf8' });
  const major = Number(
    `${result.stderr}${result.stdout}`.match(/version "(\d+)/)?.[1],
  );
  if (result.status !== 0 || major < 21) {
    console.error(
      'Firestore emulator requires Java 21+. Set JAVA_HOME to a supported JDK.',
    );
    process.exit(1);
  }
}
const cli = join('node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
const env = { ...process.env };
if (javaHome) {
  env.JAVA_HOME = javaHome;
  env.PATH = `${join(javaHome, 'bin')}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`;
}
// A fixed demo project and local-only hosts prevent accidental production tests.
const result = spawnSync(
  process.execPath,
  [
    cli,
    'emulators:exec',
    '--project',
    'demo-manshaet',
    '--only',
    'auth,firestore',
    'node --test --test-concurrency=1 rules-tests/*.test.mjs',
  ],
  { stdio: 'inherit', env },
);
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
