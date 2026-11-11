import { gmailConfig } from './config';
import { durableJobsEnabled } from '@/lib/workflows/config';
export function gmailImportEnabled(){return !!gmailConfig() && durableJobsEnabled() && process.env.RELAY_ENABLE_GMAIL_IMPORT==='true' && process.env.GMAIL_RETENTION_VERIFIED==='true';}
