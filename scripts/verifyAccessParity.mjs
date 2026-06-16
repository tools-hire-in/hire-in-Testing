// Read-only parity verifier for the centralized RBAC registry (Phase 1).
//
// Independently re-scans the CURRENT server source for every centralized guard
// call site, re-derives the effective role list written at that site (applying
// the per-file auto-grant rule), and asserts it equals ACCESS_REGISTRY[key].
//
// This proves the invariant that keeps `CENTRALIZED_ACCESS_CONTROL` safe to flip
// ON: registry value == legacy fallback for every migrated site. Any future edit
// to a call site or the registry that drifts the two apart fails this check.
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

// routes.ts + contractRoutes.ts : requirePermission("key", ...roles) — auto-grant super_admin+admin
for (const file of ['server/routes.ts', 'server/contractRoutes.ts']) {
  read(file).forEach((line, i) => {
    if (/function requirePermission/.test(line)) return;
    const m = line.match(/requirePermission\(\s*"([^"]+)"\s*((?:,\s*"[^"]+"\s*)*)\)/);
    if (!m) return;
    const roles = parseArgs(m[2].replace(/^,/, ''));
    sites.push({ file, line: i + 1, key: m[1], eff: dedupe(['super_admin', 'admin', ...roles]) });
  });
}

// performanceRoutes.ts : requireRole(req, res, "key", CONST) — auto-grant super_admin+admin
read('server/performanceRoutes.ts').forEach((line, i) => {
  const m = line.match(/requireRole\(req,\s*res,\s*"([^"]+)",\s*([A-Z_]+)\)/);
  if (!m) return;
  sites.push({ file: 'server/performanceRoutes.ts', line: i + 1, key: m[1], eff: dedupe(['super_admin', 'admin', ...PERF_CONSTS[m[2]]]) });
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

// Compare
let failures = 0;
for (const s of sites) {
  const reg = registry[s.key];
  if (!reg) { console.error(`MISSING KEY  ${s.key}  (${s.file}:${s.line})`); failures++; continue; }
  if (sortKey(reg) !== sortKey(s.eff)) {
    console.error(`PARITY FAIL  ${s.key}  site=[${s.eff.sort()}]  registry=[${reg.slice().sort()}]  (${s.file}:${s.line})`);
    failures++;
  }
}
if (!registry['hr.attendanceReport.access']) { console.error('MISSING attendance key'); failures++; }

console.log(`\nScanned ${sites.length} centralized guard sites against ${Object.keys(registry).length} registry keys.`);
if (failures) {
  console.error(`PARITY CHECK FAILED: ${failures} mismatch(es).`);
  process.exit(1);
}
console.log('PARITY OK: every guard site fallback equals its registry entry (flag ON == flag OFF).');
