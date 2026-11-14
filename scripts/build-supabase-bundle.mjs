import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const directory = 'supabase/migrations';
const files = (await readdir(directory)).filter(name => /^\d{12}_.*\.sql$/.test(name)).sort();
if (!files.length || files[0] !== '202611110001_initial.sql' || files.length < 2) {
  throw Error('Expected the initial migration and pending migrations.');
}

function section(file, content) {
  const hash = createHash('sha256').update(content + '\n').digest('hex');
  return `\n-- BEGIN ${file} sha256=${hash}\n${content}\n-- END ${file}\n`;
}

const existingHeader = `-- GENERATED FILE. Review RUNBOOK.md before use.\n-- For an existing project with migration 001 fully applied and no later Relay migration.\n-- This bundle does not update Supabase CLI migration history. Do not blindly run db push afterward.\n-- No secrets are included. If any statement fails, the transaction must roll back.\n\nbegin;\ndo $$\nbegin\n if pg_catalog.to_regclass('public.organizations') is null or pg_catalog.to_regclass('public.memberships') is null or pg_catalog.to_regclass('public.cases') is null or pg_catalog.to_regprocedure('public.create_relay_workspace()') is null then\n  raise exception 'Relay migration 001 is missing or incomplete; stop and inspect the database';\n end if;\n if pg_catalog.to_regclass('public.crm_actions') is not null or pg_catalog.to_regclass('public.knowledge_documents') is not null or exists(select 1 from information_schema.columns where table_schema='public' and table_name='cases' and column_name='ticket_status') then\n  raise exception 'A later Relay migration appears present; stop and inspect the database';\n end if;\nend $$;\n`;

const freshHeader = `-- GENERATED FILE. Review RUNBOOK.md before use.\n-- For a new, empty Supabase project. Applies every Relay migration in order.\n-- This bundle does not update Supabase CLI migration history. Do not blindly run db push afterward.\n-- No secrets are included. If any statement fails, the transaction must roll back.\n\nbegin;\ndo $$\nbegin\n if pg_catalog.to_regclass('public.organizations') is not null then\n  raise exception 'Relay tables already exist; use the existing-project bundle or inspect the database';\n end if;\nend $$;\n`;

let existing = existingHeader;
for (const file of files.slice(1)) {
  const content = (await readFile(`${directory}/${file}`, 'utf8')).replace(/\r\n/g, '\n').trimEnd();
  existing += section(file, content);
}
existing += '\ncommit;\n';

let fresh = freshHeader;
for (const file of files) {
  const content = (await readFile(`${directory}/${file}`, 'utf8')).replace(/\r\n/g, '\n').trimEnd();
  fresh += section(file, content);
}
fresh += '\ncommit;\n';

const outputs = [
  { path: 'supabase/hosted-existing-project.sql', content: existing, label: `${files.length - 1} pending migrations` },
  { path: 'supabase/fresh-project.sql', content: fresh, label: `${files.length} migrations` },
];

if (process.argv.includes('--check')) {
  for (const output of outputs) {
    let current = '';
    try { current = await readFile(output.path, 'utf8'); } catch {}
    if (current.replace(/\r\n/g, '\n') !== output.content) {
      console.error(`${output.path} is missing or stale. Run npm run db:bundle.`);
      process.exitCode = 1;
    } else {
      console.log(`${output.path} matches ${output.label}.`);
    }
  }
} else {
  for (const output of outputs) {
    await writeFile(output.path, output.content);
    console.log(`Wrote ${output.path} from ${output.label}. No hosted database was changed.`);
  }
}
