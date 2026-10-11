"use client";

import { useRouter } from "next/navigation";
import type { DashboardData } from "../dto/dashboard.dto";

type TeamOption = DashboardData["managedTeams"][number];

export default function DashboardTeamSelect({
  teams,
  selectedTeamId,
  scope,
}: {
  teams: TeamOption[];
  selectedTeamId: string | null;
  scope: DashboardData["scope"];
}) {
  const router = useRouter();

  function handleChange(teamId: string) {
    const params = new URLSearchParams({ scope, team: teamId });
    router.replace(`/dashboard?${params.toString()}`);
  }

  return (
    <select
      value={selectedTeamId ?? ""}
      onChange={(event) => handleChange(event.currentTarget.value)}
      aria-label="Dashboard team"
      className="max-w-[14rem] rounded-lg border border-ink-border bg-ink-input px-3 py-2 text-sm text-white"
    >
      {teams.map((team) => (
        <option key={team.id} value={team.id}>
          {team.name}
        </option>
      ))}
    </select>
  );
}
