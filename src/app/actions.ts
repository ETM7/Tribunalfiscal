"use server";

import { searchTribunal } from "@/lib/official-search";
import { parseSearchForm } from "@/lib/search-query";
import type { ActionState } from "./action-types";

export async function searchAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseSearchForm(formData);
  if (!parsed.ok) {
    return {
      status: "error",
      message: parsed.message,
      officialUrl: "",
      query: null,
      result: null,
    };
  }

  const outcome = await searchTribunal(parsed.query, parsed.count);
  if (outcome.status === "error") {
    return {
      status: "error",
      message: outcome.message,
      officialUrl: outcome.officialUrl,
      query: parsed.query,
      result: null,
    };
  }

  return {
    status: "ok",
    message: "",
    officialUrl: outcome.officialUrl,
    query: parsed.query,
    result: outcome,
  };
}
