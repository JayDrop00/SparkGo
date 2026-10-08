"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { playSfx, type SfxKind } from "@/lib/sfx";

type Props = ComponentProps<typeof Link> & { sfx?: SfxKind };

/** next/link that plays a (opt-in) sound effect on click. */
export default function LaunchLink({ sfx = "launch", onClick, ...props }: Props) {
  return (
    <Link
      {...props}
      onClick={(e) => {
        playSfx(sfx);
        onClick?.(e);
      }}
    />
  );
}