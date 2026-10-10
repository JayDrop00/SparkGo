import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import GroupBoard from "@/features/grouped-personal-task/components/GroupBoard";
import { getBoard } from "@/features/grouped-personal-task/services/group.service";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "My Task — SparkGo",
};

// Session-gated route with no static shell worth prerendering: render per-request.
export const instant = false;

export default async function TasksPage() {
  await connection();

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) {
    redirect("/auth?mode=login&next=/tasks");
  }

  const uid = claims.sub as string;
  const board = await getBoard(uid);

  return <GroupBoard initialBoard={board} />;
}
