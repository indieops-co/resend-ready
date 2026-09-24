import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname, basename } from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'out', '.turbo', '.vercel', 'coverage', '.resend-ready', 'resend-ready']);
const SRC_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.sql', '.md']);
const MAX_FILE = 600 * 1024;

export function walk(root) {
  const files = [];
  (function rec(dir, depth) {
    if (depth > 12) return;
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.') && e.name !== '.env' && !e.name.startsWith('.env') && e.name !== '.gitignore') continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) rec(p, depth + 1); continue; }
      if (!e.isFile()) continue;
      const ext = extname(e.name);
      const isEnv = e.name.startsWith('.env');
      if (!SRC_EXT.has(ext) && !isEnv && e.name !== '.gitignore' && e.name !== 'package.json') continue;
      try { if (statSync(p).size > MAX_FILE) continue; } catch { continue; }
      files.push({ path: p, rel: relative(root, p), name: e.name, ext, isEnv });
    }
  })(root, 0);
  return files;
}

export function readText(p) { try { return readFileSync(p, 'utf8'); } catch { return ''; } }

export function loadProject(root) {
  const files = walk(root);
  const pkgPath = join(root, 'package.json');
  let pkg = null;
  if (existsSync(pkgPath)) { try { pkg = JSON.parse(readText(pkgPath)); } catch { pkg = null; } }
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };

  const envFiles = files.filter(f => f.isEnv).map(f => ({ ...f, vars: parseEnv(readText(f.path)) }));
  const envKeys = new Set(envFiles.flatMap(f => Object.keys(f.vars)));
  const envValue = key => envFiles.filter(f => !/example|sample|template/.test(f.name)).map(f => f.vars[key]).find(v => v) ?? process.env[key] ?? envFiles.map(f => f.vars[key]).find(v => v);

  const source = files.filter(f => !f.isEnv && f.name !== 'package.json' && f.name !== '.gitignore' && f.ext !== '.md')
    .map(f => ({ ...f, text: readText(f.path) }));
  const gitignore = readText(join(root, '.gitignore'));

  return { root, files, pkg, deps, envFiles, envKeys, envValue, source, gitignore };
}

export function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

export const grep = (source, re) => source.filter(f => re.test(f.text));
export const short = f => f.rel;
