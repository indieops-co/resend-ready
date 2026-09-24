// Renders .resend-ready/report.html (and certificate.html) from progress.json. No dependencies, no network.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const STATUS_CLASS = { 'VERIFIED': 'ok', 'USER CONFIRMED': 'ok', 'INFERRED': 'inf', 'USER CONFIRMATION REQUIRED': 'need', 'UNKNOWN': 'unk', 'N/A': 'na' };

const CSS = `
:root{--bg:#f6f7f9;--panel:#ffffff;--ink:#17202a;--muted:#5c6b7a;--line:#e3e7ec;--accent:#1f5fbf;--ok:#1d7a4a;--okbg:#e5f4ec;--bad:#b3261e;--badbg:#fbe9e7;--inf:#7a5a00;--infbg:#fff3d1;--unk:#5c6b7a;--unkbg:#eef1f4;--ring:#d9dee4}
:root[data-theme=light]{--bg:#f6f7f9;--panel:#ffffff;--ink:#17202a;--muted:#5c6b7a;--line:#e3e7ec;--accent:#1f5fbf;--ok:#1d7a4a;--okbg:#e5f4ec;--bad:#b3261e;--badbg:#fbe9e7;--inf:#7a5a00;--infbg:#fff3d1;--unk:#5c6b7a;--unkbg:#eef1f4;--ring:#d9dee4}
:root[data-theme=dark]{--bg:#0f1418;--panel:#161d24;--ink:#e6ebf0;--muted:#98a6b4;--line:#243040;--accent:#7fb1ff;--ok:#6fd39a;--okbg:#12301f;--bad:#ff8a80;--badbg:#3a1613;--inf:#f2c96b;--infbg:#3a2d0c;--unk:#98a6b4;--unkbg:#1f2933;--ring:#243040}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#0f1418;--panel:#161d24;--ink:#e6ebf0;--muted:#98a6b4;--line:#243040;--accent:#7fb1ff;--ok:#6fd39a;--okbg:#12301f;--bad:#ff8a80;--badbg:#3a1613;--inf:#f2c96b;--infbg:#3a2d0c;--unk:#98a6b4;--unkbg:#1f2933;--ring:#243040}}
*{box-sizing:border-box}html{font-size:16px}body{margin:0;background:var(--bg);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1.5}
.wrap{max-width:1040px;margin:0 auto;padding:28px 20px 60px}
header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:24px}
h1{font-size:1.6rem;margin:0 0 4px;letter-spacing:-.01em}h2{font-size:1.1rem;margin:28px 0 10px}
.sub{color:var(--muted);font-size:.95rem;margin:0}
.toggle{display:inline-flex;gap:2px;padding:3px;border:1px solid var(--line);border-radius:8px;background:var(--panel)}
.toggle button{border:0;border-radius:5px;background:transparent;color:var(--muted);padding:5px 12px;cursor:pointer;font:inherit;font-size:.82rem;line-height:1.2}
.toggle button:hover{color:var(--ink)}
.toggle button[aria-pressed=true]{background:var(--ink);color:var(--panel);font-weight:600}
.grid{display:grid;grid-template-columns:220px 1fr;gap:20px}@media(max-width:720px){.grid{grid-template-columns:1fr}}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px}
.score{display:flex;flex-direction:column;align-items:center;text-align:center}
.ring{width:150px;height:150px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--accent) calc(var(--pct)*1%),var(--ring) 0);position:relative}
.ring::after{content:"";position:absolute;inset:12px;border-radius:50%;background:var(--panel)}
.ring b{position:relative;font-size:2.2rem;font-weight:700;letter-spacing:-.02em}.ring small{position:relative;font-size:.75rem;color:var(--muted)}
.score p{font-size:.85rem;color:var(--muted);margin:10px 0 0}
.missions{list-style:none;margin:0;padding:0}
.missions li{display:grid;grid-template-columns:28px 1fr auto;align-items:center;gap:10px;padding:10px 6px;border-bottom:1px solid var(--line)}
.missions li:last-child{border-bottom:0}
.m-ic{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:.8rem;font-weight:700;border:2px solid var(--line);color:var(--muted)}
.m-done .m-ic{background:var(--ok);border-color:var(--ok);color:#fff}.m-current .m-ic{border-color:var(--accent);color:var(--accent)}.m-na .m-ic{opacity:.5}
.m-title{font-weight:600}.m-current .m-title{color:var(--accent)}.m-file{font-size:.8rem;color:var(--muted)}
.bar{height:8px;background:var(--ring);border-radius:999px;overflow:hidden;margin:10px 0 4px}.bar i{display:block;height:100%;background:var(--ok);width:var(--w)}
table{width:100%;border-collapse:collapse;font-size:.92rem}th{text-align:left;color:var(--muted);font-weight:600;font-size:.8rem;padding:8px 8px;border-bottom:1px solid var(--line)}
td{padding:10px 8px;border-bottom:1px solid var(--line);vertical-align:top}tr:last-child td{border-bottom:0}
.badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:.72rem;font-weight:700;letter-spacing:.02em;white-space:nowrap}
.badge.ok{background:var(--okbg);color:var(--ok)}.badge.inf{background:var(--infbg);color:var(--inf)}.badge.need{background:var(--infbg);color:var(--inf)}.badge.unk{background:var(--unkbg);color:var(--unk)}.badge.na{background:var(--unkbg);color:var(--unk)}
.pf{font-weight:700}.pf.y{color:var(--ok)}.pf.n{color:var(--bad)}.pf.q{color:var(--muted)}
.detail{color:var(--muted);font-size:.85rem}.fix{font-size:.85rem;margin-top:4px}.fix code{background:var(--unkbg);padding:1px 5px;border-radius:5px;font-size:.8rem}
details{margin-top:14px}summary{cursor:pointer;color:var(--accent);font-size:.9rem}
.next{counter-reset:n;list-style:none;padding:0;margin:0}.next li{counter-increment:n;padding:10px 0 10px 34px;position:relative;border-bottom:1px solid var(--line)}.next li::before{content:counter(n);position:absolute;left:0;top:10px;width:24px;height:24px;border-radius:50%;background:var(--accent);color:#fff;font-size:.8rem;font-weight:700;display:grid;place-items:center}
.foot{color:var(--muted);font-size:.8rem;margin-top:34px;border-top:1px solid var(--line);padding-top:14px}
.mgroup{margin-top:18px}.mgroup h3{font-size:.95rem;margin:0 0 6px;display:flex;gap:8px;align-items:center}
code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
`;

const TOGGLE = `<div class="toggle" role="group" aria-label="Theme"><button data-t="light">Light</button><button data-t="dark">Dark</button><button data-t="auto">Auto</button></div>
<script>(function(){var k='rr-theme',r=document.documentElement,bs=document.querySelectorAll('.toggle button');
function get(){try{return localStorage.getItem(k)}catch(e){return null}}function put(v){try{localStorage.setItem(k,v)}catch(e){}}
function ap(t){if(t==='auto')r.removeAttribute('data-theme');else r.setAttribute('data-theme',t);bs.forEach(function(b){b.setAttribute('aria-pressed',b.dataset.t===t?'true':'false')});}
ap(get()||'auto');bs.forEach(function(b){b.addEventListener('click',function(){put(b.dataset.t);ap(b.dataset.t)})});})();</script>`;

export function renderReport(pr) {
  const doneCount = pr.missions.filter(m => m.status === 'done').length;
  const applicable = pr.missions.filter(m => m.status !== 'na').length;
  const pct = Math.round((doneCount / Math.max(1, applicable)) * 100);
  const failing = pr.checks.filter(c => c.pass === false && c.status !== 'N/A' && c.weight > 0).sort((a, b) => a.mission - b.mission || b.weight - a.weight);
  const byMission = {};
  for (const c of pr.checks) (byMission[c.mission] ||= []).push(c);
  const cur = pr.missions.find(m => m.status === 'current');

  const missionsHtml = pr.missions.map(m => `<li class="m-${m.status}"><span class="m-ic">${m.status === 'done' ? '✓' : m.status === 'na' ? '–' : m.id}</span><span><span class="m-title">${m.id}. ${esc(m.title)}</span><br><span class="m-file">${m.status === 'na' ? 'not applicable' : esc(m.file)}</span></span><span class="badge ${m.status === 'done' ? 'ok' : m.status === 'current' ? 'inf' : 'unk'}">${m.status}</span></li>`).join('');

  const checksHtml = Object.keys(byMission).sort((a, b) => a - b).map(mid => {
    const m = pr.missions.find(x => x.id === Number(mid));
    const rows = byMission[mid].map(c => `<tr><td><span class="pf ${c.pass === true ? 'y' : c.pass === false ? 'n' : 'q'}">${c.pass === true ? 'PASS' : c.pass === false ? 'FAIL' : '—'}</span></td><td><b>${esc(c.title)}</b><div class="detail"><code>${esc(c.id)}</code> · ${esc(c.detail)}</div>${c.pass !== true && c.fix ? `<div class="fix">Fix: ${esc(c.fix)}</div>` : ''}${c.note ? `<div class="detail">Note: ${esc(c.note)}</div>` : ''}</td><td><span class="badge ${STATUS_CLASS[c.status] || 'unk'}">${esc(c.status)}</span></td><td class="detail">${c.weight}</td></tr>`).join('');
    return `<div class="mgroup"><h3>Mission ${mid} — ${esc(m ? m.title : '')} ${m ? `<span class="badge ${m.status === 'done' ? 'ok' : m.status === 'current' ? 'inf' : 'unk'}">${m.status}</span>` : ''}</h3><div class="panel" style="padding:0 6px"><table><thead><tr><th>Result</th><th>Check</th><th>Classification</th><th>Wt</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }).join('');

  const nextHtml = failing.slice(0, 5).map(c => `<li><b>${esc(c.title)}</b> <span class="badge ${STATUS_CLASS[c.status] || 'unk'}">${esc(c.status)}</span><div class="detail">${esc(c.detail)}</div><div class="fix">${esc(c.fix)}</div></li>`).join('') || '<li><b>Nothing left to fix.</b> Run the Final Inspection confirmations if you haven\'t.</li>';

  const warmup = pr.warmup ? `<h2>Warm-up schedule</h2><div class="panel" style="padding:0 6px"><table><thead><tr><th>Day</th><th>Max per day</th><th>Max per hour</th></tr></thead><tbody>${pr.warmup.map(r => `<tr><td>${r.day}</td><td>${r.daily.toLocaleString()}</td><td>${r.hourly ? r.hourly.toLocaleString() : '—'}</td></tr>`).join('')}</tbody></table></div><p class="detail">Baselines from Resend's warm-up guide. Hold flat if bounces or complaints rise.</p>` : '';

  const cfg = pr.config || {};
  const cfgHtml = `<div class="detail">Auth: <b>${esc(cfg.authPlatform || 'not set')}</b> · Receiving: <b>${cfg.receiving === undefined ? 'not set' : cfg.receiving}</b> · Purposes: <b>${esc((cfg.purposes || []).join(', ') || 'not set')}</b> · Sending domains: <b>${esc((pr.sendingDomains || []).join(', ') || 'none known')}</b>${cfg.receivingDomain ? ` · Receiving domain: <b>${esc(cfg.receivingDomain)}</b>` : ''}</div>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Resend Ready — report</title><style>${CSS}</style></head><body><div class="wrap">
<header><div><h1>Resend Ready</h1><p class="sub">Report for <code>${esc(pr.project)}</code> · run #${pr.runs} · ${esc(pr.updatedAt)}</p>${cfgHtml}</div>${TOGGLE}</header>
<div class="grid">
  <div class="panel score"><div class="ring" style="--pct:${pr.score}"><b>${pr.score}</b><small>/ 100</small></div><p><b>Email Readiness Score</b><br>How much of the homework is done. Not a deliverability guarantee — inbox providers have the last word.</p></div>
  <div class="panel"><b>Missions</b> <span class="detail">${doneCount} of ${applicable} done${cur ? ` · current: ${cur.id}. ${esc(cur.title)}` : pr.complete ? ' · complete' : ''}</span><div class="bar"><i style="--w:${pct}%"></i></div><ul class="missions">${missionsHtml}</ul></div>
</div>
<h2>Next things to do</h2><div class="panel"><ol class="next">${nextHtml}</ol></div>
${warmup}
<h2>All checks</h2>${checksHtml}
<div class="foot">Classifications: <b>VERIFIED</b> = checked programmatically · <b>INFERRED</b> = heuristic code scan, strong signal not proof · <b>USER CONFIRMATION REQUIRED</b> = only a human can know; record with <code>--confirm id</code> · <b>UNKNOWN</b> = couldn't determine · <b>N/A</b> = excluded by Mission 0 config. Score history: ${pr.history.map(h => h.score).join(' → ')}.</div>
</div></body></html>`;
}

export function renderCertificate(pr) {
  const c = pr.certificate;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Certificate of Inbox Adulthood</title><style>${CSS}
.cert{max-width:760px;margin:40px auto;padding:48px 40px;border:6px double var(--accent);border-radius:8px;background:var(--panel);text-align:center;position:relative;overflow:hidden}
.cert h1{font-size:2rem;margin:0 0 8px}.cert .name{font-size:1.5rem;font-weight:700;margin:18px 0 6px}.cert p{margin:6px 0}.cert .seal{display:inline-block;margin-top:22px;padding:8px 14px;border-radius:999px;background:var(--okbg);color:var(--ok);font-weight:700}
.cf{position:absolute;top:-10px;width:10px;height:16px;opacity:.9;animation:fall linear forwards}@keyframes fall{to{transform:translateY(110vh) rotate(720deg);opacity:0}}</style></head><body><div class="wrap"><div style="text-align:right">${TOGGLE}</div>
<div class="cert" id="cert"><p class="detail">Resend Ready</p><h1>Certificate of Inbox Adulthood</h1><p>This is to certify that</p><div class="name">${esc(c.product)}</div><p>sends from a subdomain it actually owns, signs its mail, logs what happened to it, answers replies like a grown-up, and has read the rules.</p><p class="detail">Issued ${esc(c.issuedAt)} · Final score ${pr.score}/100 · Missions ${pr.missions.filter(m => m.status === 'done').length}/${pr.missions.filter(m => m.status !== 'na').length}</p><div class="seal">DKIM ✓ SPF ✓ DMARC ✓ Webhooks ✓ Humans ✓</div><p class="detail" style="margin-top:20px">Not a legal document. Not a deliverability guarantee. Suitable for framing anyway.</p></div>
<script>(function(){var cs=['#1f5fbf','#1d7a4a','#f2c96b','#ff8a80','#7fb1ff'];for(var i=0;i<120;i++){var d=document.createElement('i');d.className='cf';d.style.left=Math.random()*100+'vw';d.style.background=cs[i%cs.length];d.style.animationDuration=(2+Math.random()*3)+'s';d.style.animationDelay=(Math.random()*1.5)+'s';document.body.appendChild(d);}})();</script>
</div></body></html>`;
}
