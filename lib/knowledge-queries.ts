// Deliberately bounded category queries; customer text is never interpolated into SQL.
export const knowledgeQueries:Record<string,string>={billing:'invoice OR billing OR price',access:'login OR account OR password',product:'product OR report OR feature',other:''};
