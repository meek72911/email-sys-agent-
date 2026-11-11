import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { extractCustomerMessage } from '../lib/openai-extraction';
import { scoreCase, summarizeEvaluation, type EvalCase, type EvalFixture } from '../lib/evaluation';

type Fixture=EvalFixture & {message:string};
async function main(){
 const args=process.argv.slice(2);
 if(!args.includes('--run-live'))throw Error('Live evaluation is disabled. Add --run-live and --max-cases N to explicitly authorize paid synthetic model calls.');
 const index=args.indexOf('--max-cases');const maximum=index>=0?Number(args[index+1]):NaN;
 if(!Number.isInteger(maximum)||maximum<1||maximum>50)throw Error('Specify --max-cases from 1 to 50.');
 if(!process.env.OPENAI_API_KEY||!process.env.OPENAI_MODEL)throw Error('OPENAI_API_KEY and OPENAI_MODEL must be set locally.');
 const data=JSON.parse(await readFile('fixtures/cases.v1.json','utf8')) as {version:number;fixtures:Fixture[]};
 if(data.fixtures.length!==50)throw Error('Expected exactly 50 versioned fixtures.');
 const selected=data.fixtures.slice(0,maximum),cases:EvalCase[]=[];
 console.log(`Evaluating ${selected.length} synthetic cases with ${process.env.OPENAI_MODEL}. Each case is one paid request; this local runner does not use the app quota.`);
 for(const fixture of selected){
  const start=performance.now();
  try{const result=await extractCustomerMessage(fixture.message);cases.push(scoreCase(fixture,result,Math.round(performance.now()-start)));}
  catch{cases.push(scoreCase(fixture,null,Math.round(performance.now()-start),'provider_or_validation_error'));}
  console.log(`Processed ${cases.length}/${selected.length}`);
 }
 const summary=summarizeEvaluation(cases);
 const report={datasetVersion:data.version,model:process.env.OPENAI_MODEL,generatedAt:new Date().toISOString(),partial:selected.length!==data.fixtures.length,limitations:'Author-created synthetic labels; extraction only. Errors count as non-matches. No draft faithfulness, retrieval, authorization, injection compliance or customer outcomes measured.',summary,cases};
 await mkdir('eval-results',{recursive:true});await writeFile('eval-results/live-extraction.json',JSON.stringify(report,null,2)+'\n');
 console.log(`Completed ${summary.total} cases, ${summary.errors} errors; issue sets exact ${summary.issueCategoryExact.correct}/${summary.issueCategoryExact.total}. Results: eval-results/live-extraction.json`);
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Evaluation failed');process.exitCode=1;});
