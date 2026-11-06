export interface Source { id: string; title: string; url: string; license: string; kind: string; attribution: string }
export interface Entry { id: string; word: string; latin: string; partOfSpeech: string; definition: string; audioUrl: string | null; reviewStatus: 'draft' | 'reviewed'; sourceIds: string[] }
export interface Dataset { metadata: { name: string; version: string; language: string; definitionLanguage: string; license: string; reviewStatus: 'draft' | 'reviewed'; createdAt: string; description: string; latinNote: string; sources: Source[] }; entries: Entry[] }
export interface Meta { datasetVersion: string; reviewStatus: string; totalEntries: number; sources: Source[]; query?: string; total?: number; limit?: number; date?: string; timeZone?: string }
export interface Result<T> { data: T; meta: Meta }
export type Suggestion = Pick<Entry, 'id' | 'word' | 'latin'>;
export interface Options { limit?: number }
export interface LocalLughet {
  metadata(): Dataset['metadata'];
  search(query: string, options?: Options): Result<Entry[]>;
  suggest(query: string, options?: Options): Result<Suggestion[]>;
  getWord(id: string): Result<Entry>;
  wordOfTheDay(date?: Date): Result<Entry>;
}
export interface LughetClient {
  search(query: string, options?: Options): Promise<Result<Entry[]>>;
  suggest(query: string, options?: Options): Promise<Result<Suggestion[]>>;
  getWord(id: string): Promise<Result<Entry>>;
  wordOfTheDay(): Promise<Result<Entry>>;
}
export function normalizeLookup(value: string): string;
export class LughetError extends Error { status: number; code: string; constructor(message: string, status?: number, code?: string); }
export function createLocalLughet(dataset: Dataset): LocalLughet;
export function createLughetClient(options: { baseUrl: string; fetch?: typeof globalThis.fetch; signal?: AbortSignal }): LughetClient;
