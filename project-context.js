"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProjectContext = getProjectContext;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function readJson(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    catch {
        return null;
    }
}
function detectGitBranch(projectPath) {
    const headPath = path.join(projectPath, '.git', 'HEAD');
    if (!fs.existsSync(headPath))
        return undefined;
    const head = fs.readFileSync(headPath, 'utf-8').trim();
    const match = head.match(/^ref: refs\/heads\/(.+)$/);
    return match?.[1] || head.slice(0, 8);
}
function detectPackageManager(projectPath) {
    if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml')))
        return 'pnpm';
    if (fs.existsSync(path.join(projectPath, 'yarn.lock')))
        return 'yarn';
    if (fs.existsSync(path.join(projectPath, 'bun.lockb')))
        return 'bun';
    if (fs.existsSync(path.join(projectPath, 'package-lock.json')))
        return 'npm';
    return undefined;
}
function getProjectContext(projectPath) {
    const packageJson = readJson(path.join(projectPath, 'package.json'));
    const packageManager = detectPackageManager(projectPath);
    const scriptsObj = packageJson?.scripts && typeof packageJson.scripts === 'object'
        ? packageJson.scripts
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
    const suggestedCommands = [];
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
//# sourceMappingURL=project-context.js.map