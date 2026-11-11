export type Evidence = {id:string;title:string;section:string;content:string;version:number};
export type AnalysisState = {
 error?:string;
 remaining?:number;
 model?:string;
 issues?:{category:string;summary:string;sourceQuote:string;evidence:Evidence[];evidenceUnavailable:boolean}[];
 claims?:{kind:string;value:string;sourceQuote:string}[];
 draft?:{sentences:{text:string;sourceIds:string[]}[]};
 draftError?:string;
};
