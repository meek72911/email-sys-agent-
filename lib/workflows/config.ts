/** Fail closed if an Inngest development endpoint is configured in production. */
export function durableJobsEnabled(env:Record<string,string|undefined>=process.env):boolean{
 if(env.RELAY_ENABLE_DURABLE_JOBS!=='true'||!env.INNGEST_EVENT_KEY||!env.INNGEST_SIGNING_KEY)return false;
 if(env.NODE_ENV==='production' && (env.INNGEST_DEV||env.INNGEST_DEVSERVER_URL))return false;
 return true;
}
