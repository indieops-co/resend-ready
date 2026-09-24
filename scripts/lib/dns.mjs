import dns from 'node:dns/promises';

const withTimeout = (p, ms = 6000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

export async function txt(name) {
  try { return (await withTimeout(dns.resolveTxt(name))).map(parts => parts.join('')); }
  catch (e) { return e.code === 'ENOTFOUND' || e.code === 'ENODATA' ? [] : null; } // [] = definitively absent, null = couldn't tell
}
export async function mx(name) {
  try { return (await withTimeout(dns.resolveMx(name))).sort((a, b) => a.priority - b.priority); }
  catch (e) { return e.code === 'ENOTFOUND' || e.code === 'ENODATA' ? [] : null; }
}

// Web records on a name. Used to spot a DNS host that is managing the return-path
// subdomain as if it were a website — the tell that it may overwrite the SPF/MX
// Resend needs (see dns.return_path_clean).
export async function web(name) {
  const one = async fn => { try { return await withTimeout(fn(name)); } catch (e) { return e.code === 'ENOTFOUND' || e.code === 'ENODATA' ? [] : null; } };
  const [a, aaaa, cname] = await Promise.all([one(dns.resolve4), one(dns.resolve6), one(dns.resolveCname)]);
  if (a === null && aaaa === null && cname === null) return null;
  return [
    ...(a || []).map(v => `A ${v}`),
    ...(aaaa || []).map(v => `AAAA ${v}`),
    ...(cname || []).map(v => `CNAME ${v}`),
  ];
}

// Root/organizational domain, good enough for DMARC lookup on common two-level public suffixes.
const TWO_LEVEL = new Set(['co.uk','org.uk','ac.uk','gov.uk','com.au','net.au','org.au','co.nz','co.jp','com.br','com.mx','co.za','com.sg','co.in','com.tr','com.ar','co.kr','com.hk']);
export function rootDomain(host) {
  const parts = host.toLowerCase().split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  const last2 = parts.slice(-2).join('.');
  return TWO_LEVEL.has(last2) ? parts.slice(-3).join('.') : last2;
}
export const isApex = host => rootDomain(host) === host.toLowerCase();
