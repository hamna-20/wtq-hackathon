import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';

const ROOT = process.cwd();
const SUB = path.join(ROOT, 'submission');
const ZIP = path.join(ROOT, 'submission.zip');

const SOURCE_ENTRIES = [
  'app',
  'lib',
  'scripts',
  'public',
  'next.config.ts',
  'next.config.js',
  'next.config.mjs',
  'tsconfig.json',
  'package.json',
  'package-lock.json',
  'postcss.config.mjs',
  'postcss.config.js',
  'eslint.config.mjs',
  '.env.example',
  '.gitignore',
  'README.md',
];

const OUTPUT_CSVS = ['level1.csv', 'level2.csv'];

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function clean(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}

async function build(): Promise<void> {
  loadEnvConfig(ROOT);

  await clean(SUB);
  const sourceDir = path.join(SUB, 'source');
  const outputDir = path.join(SUB, 'output');
  await fs.mkdir(sourceDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });

  for (const entry of SOURCE_ENTRIES) {
    const from = path.join(ROOT, entry);
    if (!(await pathExists(from))) {
      continue;
    }
    await fs.cp(from, path.join(sourceDir, entry), { recursive: true });
  }

  let copiedCsv = 0;
  for (const csv of OUTPUT_CSVS) {
    const from = path.join(ROOT, 'output', csv);
    if (await pathExists(from)) {
      await fs.cp(from, path.join(outputDir, csv));
      copiedCsv += 1;
    }
  }
  if (copiedCsv === 0) {
    console.warn('Warning: no output/level*.csv found. Run level1 + level2 first.');
  }

  const demoDir = path.join(SUB, 'demo');
  if (await pathExists(path.join(ROOT, 'demo'))) {
    await fs.cp(path.join(ROOT, 'demo'), demoDir, { recursive: true });
  }

  await fs.rm(ZIP, { force: true });
  if (process.platform === 'win32') {
    execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Compress-Archive -Path '${SUB}\\*' -DestinationPath '${ZIP}' -Force`,
      ],
      { stdio: 'inherit' },
    );
  } else {
    execFileSync('zip', ['-r', '-9', ZIP, '.'], { cwd: SUB, stdio: 'inherit' });
  }

  const stats = await fs.stat(ZIP);
  const sizeMb = stats.size / (1024 * 1024);
  console.log(`Built ${ZIP} (${sizeMb.toFixed(2)} MB)`);
  if (sizeMb > 15) {
    console.error('Warning: ZIP exceeds the 15 MB submission limit.');
  }
}

build().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});