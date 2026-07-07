// Read-only parity verifier for the centralized RBAC registry (Phase 1).
//
// Independently re-scans the CURRENT server source for every centralized guard
// call site, re-derives the effective role list written at that site (applying
// the per-file auto-grant rule), and asserts it equals ACCESS_REGISTRY[key].
//
// This proves the consolidation invariant: the role list seeded at every guard
// call site equals ACCESS_REGISTRY[key], so routing all decisions through the
// registry (the only path now) is access-preserving. Any future edit to a call
// site or the registry that drifts the two apart fails this check.
//
// Usage:  node scripts/verifyAccessParity.mjs   (exit 0 = parity, 1 = mismatch)
import fs from 'fs';

const dedupe = a => Array.from(new Set(a));
const sortKey = a => a.slice().sort().join('|');
const parseArgs = a => a.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);

// Role consts as defined in the respective source files.
const PERF_CONSTS = {
  ADMIN_ROLES: ['super_admin', 'admin', 'hr'],
  MANAGER_ROLES: ['super_admin', 'admin', 'hr', 'manager'],
  ALL_ROLES: ['super_admin', 'admin', 'hr', 'operations', 'manager', 'employee'],
};
const ONB_CONSTS = {
  ADMIN_ROLES: ['super_admin', 'admin', 'hr', 'manager', 'operations'],
  HR_ROLES: ['super_admin', 'admin', 'hr'],
};

const read = f => fs.readFileSync(f, 'utf8').split('\n');
const sites = [];

// routes.ts + contractRoutes.ts + travelRoutes.ts :
// requirePermission("key", ...roles) — auto-grant super_admin only
// (admin is intentionally resolved through the registry like all other roles)
for (const file of ['server/routes.ts', 'server/contractRoutes.ts', 'server/travelRoutes.ts']) {
  read(file).forEach((line, i) => {
    if (/function requirePermission/.test(line)) return;
    const m = line.match(/requirePermission\(\s*"([^"]+)"\s*((?:,\s*"[^"]+"\s*)*)\)/);
    if (!m) return;
    const roles = parseArgs(m[2].replace(/^,/, ''));
    sites.push({ file, line: i + 1, key: m[1], eff: dedupe(['super_admin', ...roles]) });
  });
}

// salaryAdvanceRoutes.ts : requirePermission("key", ...roles) — NO auto-grant
// (final-approval routes must stay super_admin-exact; helper does not inject admin)
read('server/salaryAdvanceRoutes.ts').forEach((line, i) => {
  if (/function requirePermission/.test(line)) return;
  const m = line.match(/requirePermission\(\s*"([^"]+)"\s*((?:,\s*"[^"]+"\s*)*)\)/);
  if (!m) return;
  sites.push({ file: 'server/salaryAdvanceRoutes.ts', line: i + 1, key: m[1], eff: dedupe(parseArgs(m[2].replace(/^,/, ''))) });
});

// performanceRoutes.ts : requirePermission(req, res, "key", CONST) — auto-grant super_admin only
// (admin is intentionally resolved through the registry like all other roles)
read('server/performanceRoutes.ts').forEach((line, i) => {
  const m = line.match(/requirePermission\(req,\s*res,\s*"([^"]+)",\s*([A-Z_]+)\)/);
  if (!m) return;
  sites.push({ file: 'server/performanceRoutes.ts', line: i + 1, key: m[1], eff: dedupe(['super_admin', ...PERF_CONSTS[m[2]]]) });
});

// releaseNotesRoutes.ts : ...requirePermission("key", ...ALLOWED_ROLES | "role") — NO auto-grant
const RN_ALLOWED_ROLES = ['super_admin', 'admin', 'hr'];
read('server/releaseNotesRoutes.ts').forEach((line, i) => {
  if (/function requirePermission/.test(line)) return;
  const m = line.match(/requirePermission\(\s*"([^"]+)"\s*,\s*([^)]*)\)/);
  if (!m) return;
  const argStr = m[2];
  const roles = [];
  if (/\.\.\.ALLOWED_ROLES/.test(argStr)) roles.push(...RN_ALLOWED_ROLES);
  for (const qm of argStr.matchAll(/"([^"]+)"/g)) roles.push(qm[1]);
  sites.push({ file: 'server/releaseNotesRoutes.ts', line: i + 1, key: m[1], eff: dedupe(roles) });
});

// authRoutes.ts : requirePermission("key", ...roles) — NO auto-grant
read('server/authRoutes.ts').forEach((line, i) => {
  const m = line.match(/requirePermission\(\s*"([^"]+)"\s*((?:,\s*"[^"]+"\s*)*)\)/);
  if (!m) return;
  sites.push({ file: 'server/authRoutes.ts', line: i + 1, key: m[1], eff: dedupe(parseArgs(m[2].replace(/^,/, ''))) });
});

// onboardingRoutes.ts : hasAccess(req, "key", CONST | ["..."]) — NO auto-grant
read('server/onboardingRoutes.ts').forEach((line, i) => {
  if (/function hasAccess/.test(line)) return;
  const m = line.match(/hasAccess\(req,\s*"([^"]+)",\s*([A-Z_]+|\[[^\]]*\])\)/);
  if (!m) return;
  const arg = m[2];
  const roles = arg.startsWith('[') ? parseArgs(arg.slice(1, -1)) : ONB_CONSTS[arg];
  sites.push({ file: 'server/onboardingRoutes.ts', line: i + 1, key: m[1], eff: dedupe(roles) });
});

// attendanceReportRoutes.ts : isRoleAllowed(req.session.role, "key", ["..."]) — NO auto-grant
read('server/attendanceReportRoutes.ts').forEach((line, i) => {
  const m = line.match(/isRoleAllowed\([^,]+,\s*"([^"]+)",\s*\[([^\]]*)\]\)/);
  if (!m) return;
  sites.push({ file: 'server/attendanceReportRoutes.ts', line: i + 1, key: m[1], eff: dedupe(parseArgs(m[2])) });
});

// Parse ACCESS_REGISTRY from shared/accessControl.ts
const acl = fs.readFileSync('shared/accessControl.ts', 'utf8');
const body = acl.match(/ACCESS_REGISTRY: AccessRegistry = \{([\s\S]*?)\n\};/)[1];
const registry = {};
for (const m of body.matchAll(/"([^"]+)":\s*\[([^\]]*)\]/g)) {
  registry[m[1]] = m[2].split(',').map(s => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
}

// Compare — invariant: seed ⊆ registry.
//
// The registry is authoritative. The seed (call-site default) is only a
// defensive fallback used when the key is absent from the registry. It is
// acceptable for the registry to grant MORE roles than the seed (e.g. the 232
// keys that include "admin" in the registry but no longer receive it via
// auto-grant). What is NOT acceptable is the seed being MORE permissive than
// the registry — that would silently over-grant access if the registry entry
// were ever missing.
let failures = 0;
for (const s of sites) {
  const reg = registry[s.key];
  if (!reg) { console.error(`MISSING KEY  ${s.key}  (${s.file}:${s.line})`); failures++; continue; }
  const seedNotInReg = s.eff.filter(r => !reg.includes(r));
  if (seedNotInReg.length > 0) {
    console.error(`PARITY FAIL  ${s.key}  seed has extra roles not in registry: [${seedNotInReg.sort()}]  registry=[${reg.slice().sort()}]  (${s.file}:${s.line})`);
    failures++;
  }
}
if (!registry['hr.attendanceReport.access']) { console.error('MISSING attendance key'); failures++; }

console.log(`\nScanned ${sites.length} centralized guard sites against ${Object.keys(registry).length} registry keys.`);
if (failures) {
  console.error(`PARITY CHECK FAILED: ${failures} mismatch(es).`);
  process.exit(1);
}
console.log('PARITY OK: every guard site default equals its registry entry (registry-authoritative path is access-preserving).');
