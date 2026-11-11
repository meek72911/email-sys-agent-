export function canOperate(role:unknown):boolean{return role==='owner'||role==='operator';}
export function canManageKnowledge(role:unknown):boolean{return role==='owner';}
