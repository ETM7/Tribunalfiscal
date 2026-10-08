import type { SearchSuccess } from "@/lib/official-search";
import type { SearchQuery } from "@/lib/search-query";

export type ActionState = {
  status: "idle" | "error" | "ok";
  message: string;
  officialUrl: string;
  query: SearchQuery | null;
  result: SearchSuccess | null;
};

export const initialSearchState: ActionState = {
  status: "idle",
  message: "",
  officialUrl: "",
  query: null,
  result: null,
};
