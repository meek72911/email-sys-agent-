import { serve } from 'inngest/next';
import { inngest } from '@/lib/workflows/client';
import { durableJobsEnabled } from '@/lib/workflows/config';
import { workflowPayloadWithinLimit } from '@/lib/workflows/request-limit';
import { runSandboxJob } from '@/lib/workflows/functions';
import { runExternalSandboxAction, reconcileExternalSandboxAction } from '@/lib/workflows/external';
import { purgeExpiredGmail } from '@/lib/workflows/retention';
const handlers=serve({client:inngest,functions:[runSandboxJob,runExternalSandboxAction,reconcileExternalSandboxAction,purgeExpiredGmail]});
// Explicit opt-in only. Worker execution and dependency compatibility remain unverified in hosted use.
function enabled(){return durableJobsEnabled();}
const unavailable=()=>Response.json({error:'Background execution is disabled'},{status:503});
export const GET:typeof handlers.GET=async (...args)=>enabled()?handlers.GET(...args):unavailable();
export const POST:typeof handlers.POST=async (...args)=>{if(!enabled())return unavailable();if(!await workflowPayloadWithinLimit(args[0]))return Response.json({error:'Workflow request is too large or invalid'},{status:413});return handlers.POST(...args);};
export const PUT:typeof handlers.PUT=async (...args)=>{if(!enabled())return unavailable();if(!await workflowPayloadWithinLimit(args[0]))return Response.json({error:'Workflow request is too large or invalid'},{status:413});return handlers.PUT(...args);};
