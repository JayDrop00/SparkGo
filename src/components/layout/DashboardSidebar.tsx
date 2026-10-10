"use client";

import { usePathname } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { focusRing } from "@/components/ui/styles";
import LaunchLink from "@/components/ui/LaunchLink";
import { NAV_SECTIONS } from "./nav";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function DashboardSidebar({ open, onClose }: Props) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-ink-base/80 backdrop-blur-sm md:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 overflow-y-auto border-r border-ink-border/70 bg-ink-surface/95 pt-14 backdrop-blur-xl transition-transform md:static md:z-auto md:translate-x-0 md:bg-ink-surface/60 md:pt-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <nav aria-label="Main navigation" className="flex flex-col gap-4 p-4">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="border-b border-ink-border/70 pb-1.5 font-data text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                {section.label}
              </p>
              {section.items.length === 0 ? (
                <p className="mt-2 font-data text-[11px] text-slate-600">
                  Nothing here yet
                </p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {section.items.map((item) => {
                    const active =
                      pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <li key={item.href}>
                        <LaunchLink
                          href={item.href}
                          sfx="tab"
                          onClick={onClose}
                          aria-current={active ? "page" : undefined}
                          className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${focusRing} ${
                            active
                              ? "border-theme-accent/40 bg-theme-accent/10 text-theme-accent"
                              : "border-transparent text-slate-300 hover:bg-ink-border/50 hover:text-white"
                          }`}
                        >
                          <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                          {item.label}
                        </LaunchLink>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
