import { createSandboxServer } from './server.mjs';
const port=Number(process.env.SANDBOX_CRM_PORT||'4319');
if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid sandbox port');
const server=createSandboxServer({token:process.env.SANDBOX_CRM_TOKEN,dbPath:process.env.SANDBOX_CRM_DB||'sandbox-crm.sqlite'});
server.listen(port,'127.0.0.1',()=>console.log(`Synthetic sandbox CRM listening on 127.0.0.1:${port}`));
