"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import type { IncomingInviteResponseDto } from "../dto/invite-response.dto";
import { respondToInviteAction } from "../actions/invite.actions";
import { useToast } from "@/components/ui/Toast";

export default function InvitationsBanner({ invites }: { invites: IncomingInviteResponseDto[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  if (!invites.length) return null;

  function respond(invite: IncomingInviteResponseDto, accept: boolean) {
    startTransition(async () => {
      const result = await respondToInviteAction({ inviteId: invite.id, accept });
      if (!result.ok) return toast.error(result.error.message);
      toast.success(accept ? `You joined ${invite.teamName}.` : `Invitation to ${invite.teamName} declined.`);
      if (accept) router.push(`/teams?team=${encodeURIComponent(invite.teamId)}`);
      router.refresh();
    });
  }

  return (
    <section aria-label="Team invitations" className="mb-5 space-y-3">
      {invites.map((invite) => (
        <article key={invite.id} className="hud-card flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4">
          <div><p className="font-display font-bold text-white">Invitation to {invite.teamName}</p><p className="mt-1 text-sm text-slate-400">Join as {invite.role} · Expires {new Date(invite.expiresAt).toLocaleDateString()}</p></div>
          <div className="flex gap-2"><Button size="sm" loading={pending} onClick={() => respond(invite, true)}>Accept</Button><Button size="sm" variant="ghost" disabled={pending} onClick={() => respond(invite, false)}>Decline</Button></div>
        </article>
      ))}
    </section>
  );
}
