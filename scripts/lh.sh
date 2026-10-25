#!/bin/sh
# Lighthouse, mobile (simulated slow 4G, 4x CPU), N runs, prints the median.
#   sh scripts/lh.sh <name> <path> [runs]     e.g. sh scripts/lh.sh home / 3
# Reports go to .lighthouse/<name>-<n>.json (git-ignored). Needs npm run serve.
name=$1; path=$2; runs=${3:-3}
mkdir -p .lighthouse
for i in $(seq 1 "$runs"); do
  npx --yes lighthouse@12 "http://localhost:4173$path" --quiet --output=json --output-path=".lighthouse/$name-$i.json" \
    --chrome-path="C:/Program Files/Google/Chrome/Application/chrome.exe" --chrome-flags="--headless=new" >/dev/null 2>&1
done
node -e '
const fs=require("fs");const [name,runs]=process.argv.slice(1);
const rows=[];for(let i=1;i<=+runs;i++){const r=JSON.parse(fs.readFileSync(`.lighthouse/${name}-${i}.json`));const c=r.categories,a=r.audits;
rows.push({perf:Math.round(c.performance.score*100),a11y:Math.round(c.accessibility.score*100),bp:Math.round(c["best-practices"].score*100),seo:Math.round(c.seo.score*100),fcp:a["first-contentful-paint"].numericValue,lcp:a["largest-contentful-paint"].numericValue,tbt:a["total-blocking-time"].numericValue,si:a["speed-index"].numericValue,cls:a["cumulative-layout-shift"].numericValue});}
rows.forEach((r,i)=>console.log(`run ${i+1}: perf ${r.perf} a11y ${r.a11y} bp ${r.bp} seo ${r.seo} | FCP ${(r.fcp/1000).toFixed(1)}s LCP ${(r.lcp/1000).toFixed(1)}s TBT ${Math.round(r.tbt)}ms SI ${(r.si/1000).toFixed(1)}s CLS ${r.cls.toFixed(3)}`));
const med=rows.map(r=>r.perf).sort((a,b)=>a-b)[Math.floor(rows.length/2)];const m=rows.find(r=>r.perf===med);
console.log(`median: perf ${m.perf} a11y ${m.a11y} bp ${m.bp} seo ${m.seo} | FCP ${(m.fcp/1000).toFixed(1)}s LCP ${(m.lcp/1000).toFixed(1)}s TBT ${Math.round(m.tbt)}ms SI ${(m.si/1000).toFixed(1)}s CLS ${m.cls.toFixed(3)}`);
' "$name" "$runs"
