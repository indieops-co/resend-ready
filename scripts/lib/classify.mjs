// Status vocabulary. Every check carries exactly one of these.
export const VERIFIED = 'VERIFIED';                       // we checked it programmatically and it holds
export const INFERRED = 'INFERRED';                       // strong signal, not proof (heuristic code scan)
export const USER_CONFIRMATION_REQUIRED = 'USER CONFIRMATION REQUIRED'; // only a human can know
export const USER_CONFIRMED = 'USER CONFIRMED';           // a human said so (recorded with --confirm)
export const UNKNOWN = 'UNKNOWN';                         // we tried and couldn't tell (DNS timeout, no domain configured)
export const NA = 'N/A';                                  // not applicable given the Mission 0 config

/**
 * Build a check result.
 * pass: true | false | null (null = not determinable / not applicable)
 * weight: contribution to the Email Readiness Score (0 = informational)
 */
export function check({ id, mission, title, status, pass, detail = '', fix = '', weight = 1, evidence = [] }) {
  return { id, mission, title, status, pass, detail, fix, weight, evidence };
}

export const human = (id, mission, title, detail, fix, weight = 1) =>
  check({ id, mission, title, status: USER_CONFIRMATION_REQUIRED, pass: false, detail, fix, weight });

export const na = (id, mission, title, why) =>
  check({ id, mission, title, status: NA, pass: null, detail: why, weight: 0 });
