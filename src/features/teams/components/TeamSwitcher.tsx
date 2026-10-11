"use client";

import { useRouter } from "next/navigation";
import DropdownMenu from "@/components/ui/DropdownMenu";
import Icon from "@/components/ui/Icon";
import type { TeamResponseDto } from "../dto/team-response.dto";

export default function TeamSwitcher({ teams, selectedTeam }: {
  teams: TeamResponseDto[];
  selectedTeam: TeamResponseDto;
}) {
  const router = useRouter();
  return (
    <DropdownMenu
      ariaLabel="Switch team"
      triggerClassName="flex min-w-56 items-center justify-between gap-3 px-3 py-2 text-sm text-white"
      items={teams.map((team) => ({
        id: team.id,
        label: team.name,
        icon: team.id === selectedTeam.id ? "check" : "users",
        onSelect: () => router.push(`/teams?team=${encodeURIComponent(team.id)}`),
      }))}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon name="users" className="h-4 w-4 text-theme-accent" />
        <span className="max-w-56 truncate">{selectedTeam.name}</span>
      </span>
    </DropdownMenu>
  );
}
