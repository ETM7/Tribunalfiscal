import { SearchApp } from "@/components/search-app";
import { initialSearchState, type ActionState } from "@/app/action-types";
import { searchTribunal } from "@/lib/official-search";
import { describeRtf } from "@/lib/plans";
import { parseSearchForm } from "@/lib/search-query";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 120;

export const metadata = {
  title: "Buscar · Tribunal Fiscal",
  description:
    "Busca jurisprudencia en el formulario público del Tribunal Fiscal. La sumilla aparece junto al expediente. No es el sitio oficial.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function BuscarPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const phrase = first(params.q);
  const user = await currentUser();
  const initial = phrase ? await searchPhrase(phrase) : initialSearchState;
  return (
    <SearchApp
      key={phrase || "vacio"}
      rtf={describeRtf(user)}
      initialQuery={phrase}
      initialState={initial}
    />
  );
}

async function searchPhrase(phrase: string): Promise<ActionState> {
  const form = new FormData();
  form.set("exacta", phrase);
  form.set("paso", "buscar");
  form.set("alcance", "completo");
  const parsed = parseSearchForm(form);
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

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value || "").trim();
}
