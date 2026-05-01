import { SearchResponse } from '@/types';
import { runSmartSearch } from './search-engine';

export async function runSearchAgent(query: string): Promise<SearchResponse> {
  return runSmartSearch(query);
}
