import fs from 'fs';

const camel = s => s.replace(/-([a-z])/g, (_, x) => x.toUpperCase());
function keyFor(path) {
  return path.replace(/^\/api\//, '').split('/').filter(s => s && !s.startsWith(':')).map(camel).join('.');
}
const dedupe = a => Array.from(new Set(a));
const eff = (roles, autoGrant) => autoGrant ? dedupe(['super_admin', 'admin', ...roles]) : dedupe(roles);
const parseArgs = a => a.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);

const PERF_CONSTS = {
  ADMIN_ROLES: ['super_admin', 'admin', 'hr'],
  MANAGER_ROLES: ['super_admin', 'admin', 'hr', 'manager'],
  ALL_ROLES: ['super_admin', 'admin', 'hr', 'operations', 'manager', 'employee'],
};
const ONB_ADMIN = ['super_admin', 'admin', 'hr', 'manager', 'operations'];
const ONB_HR = ['super_admin', 'admin', 'hr'];

// ---- collect sites: {file, line, method, path, roles, autoGrant, kind, raw} ----
const sites = [];
function routeAbove(lines, i) {
  for (let j = i; j >= 0; j--) {
    const m = lines[j].match(/app\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/);
    if (m) return { method: m[1], path: m[2] };
  }
  return null;
}

// routes.ts + contractRoutes.ts : middleware requireRole(...)
for (const file of ['server/routes.ts', 'server/contractRoutes.ts']) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/requireRole\(([^)]*)\)/);
    if (!m || /function requireRole/.test(lines[i])) continue;
    const r = routeAbove(lines, i);
    sites.push({ file, line: i, method: r.method, path: r.path, roles: parseArgs(m[1]), autoGrant: true, kind: 'mw' });
  }
}
// performanceRoutes.ts : requireRole(req, res, CONST)
{
  const file = 'server/performanceRoutes.ts';
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/requireRole\(req,\s*res,\s*([A-Z_]+)\)/);
    if (!m) continue;
    const r = routeAbove(lines, i);
    sites.push({ file, line: i, method: r.method, path: r.path, roles: PERF_CONSTS[m[1]], autoGrant: true, kind: 'perf', constName: m[1] });
  }
}
// authRoutes.ts : requireRole("..") — NO auto-grant
{
  const file = 'server/authRoutes.ts';
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/requireRole\(([^)]*)\)/);
    if (!m) continue;
    const r = routeAbove(lines, i);
    sites.push({ file, line: i, method: r.method, path: r.path, roles: parseArgs(m[1]), autoGrant: false, kind: 'auth' });
  }
}
// onboardingRoutes.ts : inline primary guards (return 403) — NO auto-grant
{
  const file = 'server/onboardingRoutes.ts';
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (!/return res\.status\(403\)/.test(L)) continue;
    let roles, cond;
    if (/!ADMIN_ROLES\.includes\(role\)/.test(L)) { roles = ONB_ADMIN; cond = '!ADMIN_ROLES.includes(role)'; }
    else if (/!ADMIN_ROLES\.includes\(req\.session\.role!\)/.test(L)) { roles = ONB_ADMIN; cond = '!ADMIN_ROLES.includes(req.session.role!)'; }
    else if (/!HR_ROLES\.includes\(req\.session\.role!\)/.test(L)) { roles = ONB_HR; cond = '!HR_ROLES.includes(req.session.role!)'; }
    else if (/!HR_ROLES\.includes\(myRole\)/.test(L)) { roles = ONB_HR; cond = '!HR_ROLES.includes(myRole)'; }
    else if (/req\.session\.role !== "super_admin"/.test(L)) { roles = ['super_admin']; cond = 'req.session.role !== "super_admin"'; }
    else continue;
    const r = routeAbove(lines, i);
    sites.push({ file, line: i, method: r.method, path: r.path, roles, autoGrant: false, kind: 'onb', cond });
  }
}
// attendanceReportRoutes.ts : single shared middleware -> one logical key
const ATTENDANCE_KEY = 'hr.attendanceReport.access';
const ATTENDANCE_ROLES = ['super_admin', 'admin', 'hr'];

// ---- assign keys with conflict resolution ----
for (const s of sites) { s.eff = eff(s.roles, s.autoGrant); s.baseKey = keyFor(s.path); }
const byBase = {};
for (const s of sites) (byBase[s.baseKey] = byBase[s.baseKey] || []).push(s);
for (const base in byBase) {
  const variants = new Set(byBase[base].map(s => s.eff.slice().sort().join('|')));
  const conflict = variants.size > 1;
  for (const s of byBase[base]) s.key = conflict ? `${base}.${s.method}` : base;
}
// residual conflict check
const reg = {};
let residual = 0;
for (const s of sites) {
  const sig = s.eff.slice().sort().join('|');
  if (reg[s.key] && reg[s.key].sig !== sig) { residual++; console.log('RESIDUAL CONFLICT', s.key, reg[s.key].sig, '!=', sig); }
  reg[s.key] = { roles: s.eff, sig };
}
reg[ATTENDANCE_KEY] = { roles: ATTENDANCE_ROLES, sig: ATTENDANCE_ROLES.slice().sort().join('|') };
if (residual) { console.error('ABORT: residual conflicts'); process.exit(1); }

// ---- build registry literal ----
const keys = Object.keys(reg).sort();
const lines = keys.map(k => `  ${JSON.stringify(k)}: [${reg[k].roles.map(r => `"${r}"`).join(', ')}],`);
let acl = fs.readFileSync('shared/accessControl.ts', 'utf8');
acl = acl.replace(/export const ACCESS_REGISTRY: AccessRegistry = \{[\s\S]*?\n\};/,
  `export const ACCESS_REGISTRY: AccessRegistry = {\n${lines.join('\n')}\n};`);
fs.writeFileSync('shared/accessControl.ts', acl);
console.log(`Registry written: ${keys.length} keys, ${sites.length} sites + attendance.`);

// ---- rewrite source files ----
function rewrite(file, fn) {
  const arr = fs.readFileSync(file, 'utf8').split('\n');
  for (const s of sites.filter(x => x.file === file)) fn(arr, s);
  fs.writeFileSync(file, arr.join('\n'));
}
rewrite('server/routes.ts', (arr, s) => { arr[s.line] = arr[s.line].replace(/requireRole\(/, `requirePermission(${JSON.stringify(s.key)}, `); });
rewrite('server/contractRoutes.ts', (arr, s) => { arr[s.line] = arr[s.line].replace(/requireRole\(/, `requirePermission(${JSON.stringify(s.key)}, `); });
rewrite('server/performanceRoutes.ts', (arr, s) => { arr[s.line] = arr[s.line].replace(/requireRole\(req,\s*res,\s*/, `requireRole(req, res, ${JSON.stringify(s.key)}, `); });
rewrite('server/authRoutes.ts', (arr, s) => { arr[s.line] = arr[s.line].replace(/requireRole\(/, `requirePermission(${JSON.stringify(s.key)}, `); });
rewrite('server/onboardingRoutes.ts', (arr, s) => {
  arr[s.line] = arr[s.line].replace(s.cond, () => {
    if (s.cond === 'req.session.role !== "super_admin"') return `!hasAccess(req, ${JSON.stringify(s.key)}, ["super_admin"])`;
    const constName = s.roles === ONB_ADMIN ? 'ADMIN_ROLES' : 'HR_ROLES';
    return `!hasAccess(req, ${JSON.stringify(s.key)}, ${constName})`;
  });
});
console.log('Source files rewritten.');

// emit mapping report
fs.writeFileSync('/tmp/access_map.json', JSON.stringify(sites.map(s => ({ file: s.file.split('/').pop(), line: s.line + 1, method: s.method.toUpperCase(), path: s.path, key: s.key, roles: s.eff })), null, 1));
