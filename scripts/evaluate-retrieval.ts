import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFile,readdir,writeFile,mkdir } from 'node:fs/promises';
import { knowledgeQueries } from '../lib/knowledge-queries';
type Fixture={id:string;categories:string[];requiredEvidence:string[]};
async function main(){
 const fixtures=JSON.parse(await readFile('fixtures/cases.v1.json','utf8')) as {version:number;fixtures:Fixture[]};
 const db=new PGlite({extensions:{pgcrypto}});
 try{
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated; insert into auth.users values ('00000000-0000-0000-0000-000000000001');`);
  for(const migration of (await readdir('supabase/migrations')).filter(name=>name.endsWith('.sql')).sort())await db.exec(await readFile('supabase/migrations/'+migration,'utf8'));
  await db.exec("select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false); set role authenticated; select public.create_relay_workspace();");
  const search=new Map<string,string[]>();
  for(const [category,query] of Object.entries(knowledgeQueries)){
   if(!query){search.set(category,[]);continue;}
   const result=await db.query<{title:string}>('select title from public.relay_search_knowledge($1)',[query]);search.set(category,result.rows.slice(0,3).map(row=>row.title));
  }
  const cases=fixtures.fixtures.map(fixture=>{const returned=[...new Set(fixture.categories.flatMap(category=>search.get(category)??[]))];const missing=fixture.requiredEvidence.filter(title=>!returned.includes(title));return {id:fixture.id,expected:fixture.requiredEvidence,returned,missing};});
  const relevant=cases.filter(item=>item.expected.length>0),covered=relevant.filter(item=>item.missing.length===0);
  const report={datasetVersion:fixtures.version,method:'Oracle fixture categories, seeded knowledge, production category queries, first three search results per category. Does not test AI extraction, document relevance beyond authored labels, factual support, or customer outcomes.',totalCases:cases.length,casesWithExpectedEvidence:relevant.length,fullyCovered:covered.length,coverage:relevant.length?covered.length/relevant.length:null,failures:relevant.filter(item=>item.missing.length>0)};
  await mkdir('eval-results',{recursive:true});await writeFile('eval-results/retrieval.json',JSON.stringify(report,null,2)+'\n');
  console.log(`Oracle-category retrieval: ${covered.length}/${relevant.length} cases include all labeled evidence in the top three results per category. See eval-results/retrieval.json.`);
  if(covered.length!==relevant.length)process.exitCode=1;
 }finally{await db.close();}
}
main().catch(()=>{console.error('Retrieval evaluation failed.');process.exitCode=1;});
