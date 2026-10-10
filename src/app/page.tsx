import { SearchApp } from "@/components/search-app";
import { describeRtf } from "@/lib/plans";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";

export default async function Home() {
  const user = await currentUser();
  return <SearchApp rtf={describeRtf(user)} />;
}
