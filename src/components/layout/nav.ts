import type { IconName } from "@/components/ui/Icon";

export type NavItem = {
  label: string;
  href: string;
  icon: IconName;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Personal",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "home" },
      { label: "My Task", href: "/tasks", icon: "list" },
      { label: "Calendar", href: "/calendar", icon: "calendar" },
    ],
  },
  {
    label: "Collaborative",
    items: [
      { label: "MyTeam", href: "/teams", icon: "users" },
      { label: "Team Task", href: "/team-tasks", icon: "chart" },
    ],
  },
  {
    label: "Tools",
    items: [],
  },
];

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/tasks": "My Task",
  "/calendar": "Calendar",
  "/teams": "MyTeam",
  "/team-tasks": "Team Task",
};

export function pageTitle(pathname: string): string {
  return TITLES[pathname] ?? "SparkGo";
}
