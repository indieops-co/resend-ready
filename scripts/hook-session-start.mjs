// Local-only nudge. Prints one line if the project has unfinished Resend Ready progress. Silent otherwise.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const p = join(process.cwd(), '.resend-ready', 'progress.json');
if (existsSync(p)) {
  try {
    const pr = JSON.parse(readFileSync(p, 'utf8'));
    if (!pr.complete) {
      const cur = (pr.missions || []).find(m => m.status === 'current');
      const age = pr.updatedAt ? Math.round((Date.now() - Date.parse(pr.updatedAt)) / 86400000) : null;
      console.log(`Resend Ready: score ${pr.score}/100, current mission ${cur ? `${cur.id} (${cur.title})` : '?'}${age !== null ? `, last run ${age}d ago` : ''}. /resend-ready to resume, /resend-doctor to re-check.`);
    }
  } catch {}
}
