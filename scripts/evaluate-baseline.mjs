import { readFile, writeFile, mkdir } from 'node:fs/promises';
const { version, fixtures }=JSON.parse(await readFile(new URL('../fixtures/cases.v1.json',import.meta.url),'utf8'));
const rules=[['billing',/invoice|bill(?:ing)?|charge|refund|price/i],['access',/log[ -]?in|sign[ -]?in|password|access.*account|account.*access/i],['product',/report|export|feature/i]];
const counts={}; const failures=[]; let exact=0; let multiple=0; let multiExact=0;
for(const sample of fixtures){
 const found=rules.filter(([,re])=>re.test(sample.message)).map(([name])=>name);
 // No matching category is an explicit abstention for the deterministic baseline.
 const expected=sample.categories.filter(x=>x!=='other').sort(); const predicted=[...found].sort();
 const match=JSON.stringify(expected)===JSON.stringify(predicted); exact+=Number(match);
 if(sample.group==='multi'){multiple++;multiExact+=Number(match);}
 const group=counts[sample.group]??={total:0,exact:0};group.total++;group.exact+=Number(match);
 if(!match) failures.push({id:sample.id,group:sample.group,expected,predicted});
}
const result={datasetVersion:version,datasetCases:fixtures.length,method:'Deterministic keyword baseline; other is treated as abstention. No live AI or factual accuracy measured.',issueCategoryExact:{correct:exact,total:fixtures.length,rate:exact/fixtures.length},multiIssueExact:{correct:multiExact,total:multiple,rate:multiExact/multiple},byGroup:counts,failures};
await mkdir(new URL('../eval-results/',import.meta.url),{recursive:true});
await writeFile(new URL('../eval-results/baseline.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(`Baseline: ${exact}/${fixtures.length} exact; multi-issue: ${multiExact}/${multiple}. Results: eval-results/baseline.json`);
