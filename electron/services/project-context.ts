import * as fs from 'fs';
import * as path from 'path';

export interface ProjectContext {
  path: string;
  name: string;
  gitBranch?: string;
  packageManager?: string;
  scripts: Array<{ name: string; command: string }>;
  markers: string[];
  suggestedCommands: string[];
}

function readJson(filePath: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function detectGitBranch(projectPath: string): string | undefined {
  const headPath = path.join(projectPath, '.git', 'HEAD');
  if (!fs.existsSync(headPath)) return undefined;
  const head = fs.readFileSync(headPath, 'utf-8').trim();
  const match = head.match(/^ref: refs\/heads\/(.+)$/);
  return match?.[1] || head.slice(0, 8);
}

function detectPackageManager(projectPath: string): string | undefined {
  if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(projectPath, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(projectPath, 'package-lock.json'))) return 'npm';
  return undefined;
}

export function getProjectContext(projectPath: string): ProjectContext {
  const packageJson = readJson(path.join(projectPath, 'package.json'));
  const packageManager = detectPackageManager(projectPath);
  const scriptsObj = packageJson?.scripts && typeof packageJson.scripts === 'object'
    ? packageJson.scripts as Record<string, unknown>
    : {};
  const scripts = Object.entries(scriptsObj)
    .filter(([, command]) => typeof command === 'string')
    .map(([name, command]) => ({ name, command: String(command) }))
    .slice(0, 10);

  const markers = [
    ['React', 'src'],
    ['Electron', 'electron'],
    ['TypeScript', 'tsconfig.json'],
    ['Webpack', 'webpack.renderer.config.js'],
    ['Vite', 'vite.config.ts'],
    ['Python', 'pyproject.toml'],
    ['Rust', 'Cargo.toml'],
  ]
    .filter(([, marker]) => fs.existsSync(path.join(projectPath, marker)))
    .map(([label]) => label);

  const suggestedCommands: string[] = [];
  const runPrefix = packageManager ? `${packageManager} run` : 'npm run';
  for (const name of ['dev', 'build', 'test', 'lint', 'typecheck']) {
    if (scripts.some((script) => script.name === name)) {
      suggestedCommands.push(`${runPrefix} ${name}`);
    }
  }

  return {
    path: projectPath,
    name: path.basename(projectPath),
    gitBranch: detectGitBranch(projectPath),
    packageManager,
    scripts,
    markers,
    suggestedCommands,
  };
}
