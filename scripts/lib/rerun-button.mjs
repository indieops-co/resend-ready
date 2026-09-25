#!/usr/bin/env node
/**
 * rerun-button — the "Check Again" button.
 *
 * Writes a double-click file into the user's project that re-runs one of a
 * Skilllet's read-only checks WITHOUT Claude. No chat, no tokens: the script
 * does the checking and prints its verdict, exactly as it would for Claude.
 *
 *   mac     → Check-Email-Readiness.command   (double-click in Finder)
 *   linux   → Check-Email-Readiness.sh
 *   windows → no file; returns the one-line command to show the user instead
 *
 * Master copy: IndieOps-Co/indieops-brand/scripts/rerun-button.mjs
 * Ship it inside a Skilllet as scripts/lib/rerun-button.mjs. Zero dependencies.
 *
 * Why the Skilllet writes the button on the user's machine instead of shipping
 * it in the zip: macOS flags files downloaded from the internet, and
 * double-clicking a downloaded script throws a Gatekeeper warning (on recent
 * macOS, a trip to System Settings). A file written locally isn't flagged.
 *
 * Built to keep working:
 *   - The button finds its project from its own location, not a baked path, so
 *     it works when made from a sandbox (Cowork) and after the folder moves.
 *   - It looks for the newest installed copy of the Skilllet first, and falls
 *     back to a snapshot of the check copied into <project>/.check-again/, so a
 *     plugin update or a Cowork-only install never leaves it stranded.
 *
 * Rules, enforced here rather than trusted:
 *   - Read-only checks only: flags listed in `forbid` are refused.
 *   - Never a secret in the file: secret-shaped args are refused. The check reads
 *     .env itself, at run time.
 *   - Plain-English header: what it does, who made it, safe to delete.
 *   - Personal to this computer, so it goes in .gitignore when there is one.
 */
import { writeFileSync, readFileSync, existsSync, chmodSync, appendFileSync, cpSync, mkdirSync, rmSync } from 'node:fs'
import { join, resolve, isAbsolute } from 'node:path'
import { homedir } from 'node:os'

const SECRETISH = /(\bre_[A-Za-z0-9_]{8,}|\bsk_(live|test)_|\bsk-[A-Za-z0-9-]{12,}|\bghp_[A-Za-z0-9]{10,}|\bAKIA[0-9A-Z]{12}|\bwhsec_|\beyJhbGciOi|(KEY|SECRET|TOKEN|PASSWORD|PASSWD)\s*=)/i
const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'` // bash single-quote
const RUNNERS = {
  node: { label: 'Node.js', places: ['/opt/homebrew/bin/node', '/usr/local/bin/node'] },
  python3: { label: 'Python 3', places: ['/opt/homebrew/bin/python3', '/usr/local/bin/python3', '/usr/bin/python3'] },
}
const SNAPSHOT_DIR = '.check-again'

/** Which computer will the user double-click on? Inside a sandbox we can't tell, so we ask. */
export function detectTarget() {
  const sandboxed = process.platform === 'linux' && (!!process.env.SANDBOX_RUNTIME || homedir().startsWith('/sessions/'))
  if (sandboxed) return null
  return process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'windows' : 'linux'
}

export function makeRerunButton(opts) {
  const {
    title,               // "Check Email Readiness": becomes the file name
    skill,               // "resend-ready": the Skilllet's slug, used to find it again after updates
    skillName = skill,   // "Resend Ready": for the header
    skillRoot,           // absolute path of the Skilllet folder, right now
    scriptRel,           // the check, relative to skillRoot, e.g. "scripts/doctor.mjs"
    snapshot = [],       // paths (relative to skillRoot) the check needs to run on its own, e.g. ["scripts"]
    runner = 'node',     // 'node' | 'python3'
    args = [],           // arguments; the whole-word "{project}" becomes the project folder
    project = '.',
    explain,             // one to three plain sentences: what it checks
    openAfter = null,    // file (relative to the project) to open when done, e.g. a report
    forbid = [],         // flags that change things: refused if they appear in args
    target = detectTarget(), // 'mac' | 'linux' | 'windows'
  } = opts

  const fail = (m) => { throw new Error(`rerun-button: ${m}`) }
  if (!title || !/^[A-Za-z0-9][A-Za-z0-9 ]{2,48}$/.test(title)) fail('title must be 3–49 letters, digits or spaces')
  if (!skill || !/^[a-z0-9][a-z0-9-]*$/.test(skill)) fail('skill must be the kebab-case slug')
  if (!skillRoot || !isAbsolute(skillRoot) || !existsSync(skillRoot)) fail(`skillRoot not found: ${skillRoot}`)
  const safeRel = (p) => p && !isAbsolute(p) && !p.split(/[\\/]/).includes('..')
  if (!safeRel(scriptRel) || !existsSync(join(skillRoot, scriptRel))) fail(`scriptRel must be a file inside the Skilllet: ${scriptRel}`)
  if (!snapshot.every(safeRel)) fail('snapshot paths must be relative to the Skilllet')
  if (snapshot.length && !snapshot.some((p) => scriptRel === p || scriptRel.startsWith(`${p}/`))) fail('snapshot must include the script itself')
  if (!RUNNERS[runner]) fail(`runner must be one of ${Object.keys(RUNNERS).join(', ')}`)
  if (!explain || explain.length > 400) fail('explain is required (max 400 chars)')
  if (openAfter && !safeRel(openAfter)) fail('openAfter must be relative to the project')
  if (!target) fail("running inside a sandbox (like Cowork), so I can't tell which computer the button is for. Pass target: 'mac', 'windows' or 'linux'.")
  if (!['mac', 'linux', 'windows'].includes(target)) fail(`unknown target: ${target}`)
  for (const a of args) {
    if (typeof a !== 'string') fail('args must be strings')
    if (a !== '{project}' && a.includes('{project}')) fail('"{project}" must be a whole argument on its own')
    if (forbid.some((f) => a === f || a.startsWith(`${f}=`))) fail(`"${a}" changes things. A Check Again button only runs read-only checks.`)
    if (SECRETISH.test(a)) fail('an argument looks like a secret. The check must read secrets from .env at run time, never from the button.')
  }

  const projectDir = resolve(project)
  if (!existsSync(projectDir)) fail(`project folder not found: ${projectDir}`)

  // The snapshot: the check's own files, copied into the project, so the button
  // still works when the Skilllet isn't installed on this computer (Cowork) or moved.
  let snapshotted = false
  if (snapshot.length) {
    const dest = join(projectDir, SNAPSHOT_DIR, skill)
    rmSync(dest, { recursive: true, force: true })
    for (const p of snapshot) {
      mkdirSync(join(dest, p, '..'), { recursive: true })
      cpSync(join(skillRoot, p), join(dest, p), { recursive: true, filter: (src) => !/(^|[\\/])(node_modules|\.git|\.env[^\\/]*)$/.test(src) })
    }
    writeFileSync(join(projectDir, SNAPSHOT_DIR, 'README.txt'),
      'Copies of IndieOps Skilllet checks, so the Check Again buttons in this folder keep working\n' +
      'even when the Skilllet itself moves or updates. Safe to delete; the buttons will then use the\n' +
      'installed Skilllet, or you can ask the Skilllet to make a new button.\n')
    snapshotted = true
  }

  if (target === 'windows') {
    const winArgs = args.map((a) => (a === '{project}' ? '.' : /[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a))
    const where = snapshotted ? `${SNAPSHOT_DIR}\\${skill}\\${scriptRel.replace(/\//g, '\\')}` : join(skillRoot, scriptRel)
    return { written: null, fileName: null, snapshotted, oneLiner: [runner === 'python3' ? 'python' : 'node', `"${where}"`, ...winArgs].join(' '),
      note: 'Windows: no button file. Open a terminal in the project folder and paste this line:' }
  }

  const ext = target === 'mac' ? '.command' : '.sh'
  const fileName = title.trim().replace(/\s+/g, '-') + ext
  const out = join(projectDir, fileName)
  const today = new Date().toISOString().slice(0, 10)
  const explainLines = explain.replace(/\r/g, '').split('\n').map((l) => `#  ${l}`).join('\n')
  const opener = target === 'mac' ? 'open' : 'xdg-open'
  const R = RUNNERS[runner]
  const bakedRunner = runner === 'node' && detectTarget() === target ? process.execPath : ''
  const argList = args.map((a) => (a === '{project}' ? '"$PROJECT"' : q(a))).join(' ')

  const body = `#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  ${fileName}
#  Made by the ${skillName} Skilllet (IndieOps) on ${today}.
#
#  Double-click to run this check again without Claude. No chat, no tokens.
${explainLines}
#
#  It checks and reports. It doesn't change your code, your settings or any
#  account. Safe to delete: ask ${skillName} for a new one any time.
# ─────────────────────────────────────────────────────────────────────────────
PROJECT="$(cd "$(dirname "$0")" && pwd)"   # the button lives in the project folder
cd "$PROJECT" || exit 1
pause() { echo; read -r -p "Press Return to close." _; }

# Find ${R.label}: the usual places, then the one used when this button was made.
RUN=""
for r in "$(command -v ${runner} 2>/dev/null)" ${R.places.map(q).join(' ')}${runner === 'node' ? ' "$(ls -d "$HOME"/.nvm/versions/node/*/bin/node 2>/dev/null | sort -V 2>/dev/null | tail -1)"' : ''} ${q(bakedRunner)}; do
  [ -n "$r" ] && [ -x "$r" ] && { RUN="$r"; break; }
done
[ -n "$RUN" ] || { echo "${R.label} isn't installed, or can't be found. Install it, then double-click again."; pause; exit 1; }

# Find the check: the newest installed ${skillName} first, then the copy saved next to this button.
SCRIPT=""
for s in "$(ls -td "$HOME"/.claude/plugins/cache/*/${skill}/*/${scriptRel} 2>/dev/null | head -1)" \\
  ${q(join(skillRoot, scriptRel))} \\
  "$HOME/.claude/skills/${skill}/${scriptRel}" \\
  "$PROJECT/.claude/skills/${skill}/${scriptRel}" \\
  "$PROJECT/${skill}/${scriptRel}" \\
  "$PROJECT/${SNAPSHOT_DIR}/${skill}/${scriptRel}"; do
  [ -n "$s" ] && [ -f "$s" ] && { SCRIPT="$s"; break; }
done
[ -n "$SCRIPT" ] || { echo "Can't find the ${skillName} Skilllet any more. Ask Claude to run it once and make a new button."; pause; exit 1; }

echo
echo "  ${title}  ·  ${skillName}"
"$RUN" "$SCRIPT" ${argList}
STATUS=$?
${openAfter ? `[ -f "$PROJECT"/${q(openAfter)} ] && ${opener} "$PROJECT"/${q(openAfter)} >/dev/null 2>&1\n` : ''}pause
exit $STATUS
`
  if (SECRETISH.test(body.replace(/^#.*$/gm, ''))) fail('refusing to write: the button would contain something secret-shaped')
  writeFileSync(out, body, { mode: 0o755 })
  chmodSync(out, 0o755)

  // Personal to this computer: keep the button and the snapshot out of git.
  let gitignored = false
  const gi = join(projectDir, '.gitignore')
  if (existsSync(gi)) {
    const lines = readFileSync(gi, 'utf8').split(/\r?\n/).map((l) => l.trim())
    const want = [`/${fileName}`, ...(snapshotted ? [`/${SNAPSHOT_DIR}/`] : [])].filter((w) => !lines.includes(w))
    if (want.length) {
      const cur = readFileSync(gi, 'utf8')
      appendFileSync(gi, `${cur.endsWith('\n') ? '' : '\n'}\n# Check Again button made by an IndieOps Skilllet (personal to this computer)\n${want.join('\n')}\n`)
    }
    gitignored = true
  }
  return { written: out, fileName, snapshotted, gitignored }
}

// ─── CLI: for Skilllets whose check isn't a Node script ──────────────────────
//   node rerun-button.mjs --title "Audit My Folder" --skill press-ready --skill-name "Press Ready" \
//        --skill-root /abs/press-ready --script-rel engine/audit_dir.py --snapshot engine --runner python3 \
//        --project . --arg {project} --explain "Scans the folder for invisible characters and metadata." [--target mac]
if (process.argv[1] && /rerun-button\.mjs$/.test(process.argv[1])) {
  const argv = process.argv.slice(2)
  const o = { args: [], forbid: [], snapshot: [] }
  const map = { '--title': 'title', '--skill': 'skill', '--skill-name': 'skillName', '--skill-root': 'skillRoot', '--script-rel': 'scriptRel', '--runner': 'runner', '--project': 'project', '--explain': 'explain', '--open-after': 'openAfter', '--target': 'target' }
  for (let i = 0; i < argv.length; i++) {
    if (map[argv[i]]) o[map[argv[i]]] = argv[++i]
    else if (argv[i] === '--arg') o.args.push(argv[++i])
    else if (argv[i] === '--forbid') o.forbid.push(argv[++i])
    else if (argv[i] === '--snapshot') o.snapshot.push(argv[++i])
  }
  if (o.target === undefined) delete o.target
  try {
    const r = makeRerunButton(o)
    console.log(r.written ? `Made ${r.fileName}${r.gitignored ? ' (added to .gitignore)' : ''}` : `${r.note}\n  ${r.oneLiner}`)
  } catch (e) { console.error(e.message); process.exit(1) }
}
