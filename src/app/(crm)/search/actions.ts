"use server";

import { parseAndSearch, runSearch, type SearchOutcome } from "@/services/search.service";
import { searchQuerySchema, type SearchQuery } from "@/validators/search";

export async function aiSearchAction(question: string): Promise<SearchOutcome> {
  return parseAndSearch(question);
}

export async function structuredSearchAction(input: SearchQuery): Promise<SearchOutcome> {
  const parsed = searchQuerySchema.safeParse(input);
  const query: SearchQuery = parsed.success ? parsed.data : { entity: "jobs", filters: {} };
  return { query, results: await runSearch(query), understood: true };
}
