// Dev tool: what is inside the long tasks of a saved Lighthouse trace.
//   npx lighthouse ... --save-assets --output-path=.lighthouse/x.json   then
//   node scripts/lh-tasks.mjs .lighthouse/x-0.trace.json
import { readFileSync } from 'node:fs';
const { traceEvents } = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const mains = traceEvents.filter((e) => e.name === 'thread_name' && e.args?.name === 'CrRendererMain').map((e) => e.pid + ':' + e.tid);
const counts = {};
traceEvents.filter((e) => /RunTask/.test(e.name) && mains.includes(e.pid + ':' + e.tid)).forEach((e) => { counts[e.pid + ':' + e.tid] = (counts[e.pid + ':' + e.tid] || 0) + e.dur; });
const mt = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
const nav = traceEvents.find((e) => e.name === 'navigationStart' && mains.includes(e.pid + ':' + e.tid))?.ts || traceEvents[0].ts;
const on = traceEvents.filter((e) => e.pid + ':' + e.tid === mt);
const tasks = on.filter((e) => /RunTask/.test(e.name) && e.dur > 30000);
const seen = new Set();
for (const t of tasks) {
  if (seen.has(t.ts)) continue; seen.add(t.ts);
  console.log(`${Math.round((t.ts - nav) / 1000)}ms  ${Math.round(t.dur / 1000)}ms`);
  on.filter((e) => e.ts >= t.ts && e.ts + (e.dur || 0) <= t.ts + t.dur && e.dur > 4000 && !/RunTask/.test(e.name))
    .slice(0, 16).forEach((e) => console.log(`    ${e.name} ${Math.round(e.dur / 1000)}ms ${e.args?.data?.url || ''} ${e.args?.data?.functionName || ''} ${e.args?.data?.type || ''} ${(e.args?.beginData?.stackTrace || []).slice(0, 3).map((f) => f.functionName + '@' + f.url.replace(/^.*\//, '') + ':' + f.lineNumber).join(' < ')}`));
}
