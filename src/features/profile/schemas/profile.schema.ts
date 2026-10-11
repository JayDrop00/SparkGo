import { z } from "zod";

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1, "Enter a display name.").max(80),
  avatarUrl: z.string().url().max(2048).nullable(),
});
