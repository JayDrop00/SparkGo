"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import type { ProfileSummaryDto } from "../dto/profile.dto";
import { updateProfileAction } from "../actions/profile.actions";

const MAX_AVATAR_SIZE = 3 * 1024 * 1024;
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function avatarObjectPath(url: string | null, userId: string): string | null {
  if (!url) return null;
  try {
    const path = decodeURIComponent(new URL(url).pathname);
    const marker = "/storage/v1/object/public/avatars/";
    const markerIndex = path.indexOf(marker);
    if (markerIndex < 0) return null;
    const objectPath = path.slice(markerIndex + marker.length);
    return objectPath.startsWith(`${userId}/`) ? objectPath : null;
  } catch {
    return null;
  }
}

export default function ProfileDialog({
  open,
  onClose,
  userId,
  email,
  profile,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  email: string;
  profile: ProfileSummaryDto;
  onSaved: (profile: ProfileSummaryDto) => void;
}) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDisplayName(profile.displayName ?? "");
    setAvatarUrl(profile.avatarUrl ?? "");
    setAvatarFile(null);
    setPreviewUrl(null);
    setRemoveAvatar(false);
    setError("");
  }, [open, profile.displayName, profile.avatarUrl]);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const initial = (displayName.trim()[0] ?? email.trim()[0] ?? "U").toUpperCase();
  const shownAvatar = previewUrl ?? (removeAvatar ? null : avatarUrl || null);

  function chooseAvatar(file: File | undefined) {
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      setAvatarFile(null);
      setPreviewUrl(null);
      setError("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setAvatarFile(null);
      setPreviewUrl(null);
      setError("Profile photos must be 3 MB or smaller.");
      return;
    }
    setError("");
    setAvatarFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setRemoveAvatar(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");

    const supabase = createClient();
    let uploadedPath: string | null = null;
    let nextAvatarUrl = removeAvatar ? null : avatarUrl.trim() || null;

    try {
      if (avatarFile) {
        const extension = EXTENSIONS[avatarFile.type];
        uploadedPath = `${userId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(uploadedPath, avatarFile, {
            cacheControl: "3600",
            contentType: avatarFile.type,
          });
        if (uploadError) throw uploadError;
        nextAvatarUrl = supabase.storage.from("avatars").getPublicUrl(uploadedPath).data.publicUrl;
      }

      const result = await updateProfileAction({
        displayName: displayName.trim(),
        avatarUrl: nextAvatarUrl,
      });
      if (!result.ok) {
        if (uploadedPath) await supabase.storage.from("avatars").remove([uploadedPath]);
        setError(result.error.message);
        return;
      }

      const previousPath = avatarObjectPath(profile.avatarUrl, userId);
      if (previousPath && (avatarFile || removeAvatar)) {
        await supabase.storage.from("avatars").remove([previousPath]);
      }

      const savedProfile = {
        displayName: result.data.displayName || null,
        avatarUrl: result.data.avatarUrl,
      };
      onSaved(savedProfile);
      toast.success("Profile updated.");
      onClose();
    } catch {
      if (uploadedPath) await supabase.storage.from("avatars").remove([uploadedPath]);
      setError("Could not save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit profile"
      description="Update the name and photo shown on your account."
      maxWidth="max-w-md"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="profile-form" loading={saving}>
            Save profile
          </Button>
        </>
      }
    >
      <form id="profile-form" onSubmit={handleSubmit} className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-theme-accent/40 bg-ink-input font-display text-xl font-black text-theme-accent">
            {shownAvatar ? (
              <Image src={shownAvatar} alt="Profile photo preview" width={64} height={64} unoptimized className="h-full w-full object-cover" />
            ) : initial}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              tabIndex={-1}
              onChange={(event) => chooseAvatar(event.target.files?.[0])}
            />
            <Button type="button" size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={saving}>
              Change photo
            </Button>
            {shownAvatar && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAvatarFile(null);
                  setPreviewUrl(null);
                  setAvatarUrl("");
                  setRemoveAvatar(true);
                }}
                disabled={saving}
              >
                Remove
              </Button>
            )}
            <p className="w-full text-xs text-slate-500">JPG, PNG, or WebP · max 3 MB</p>
          </div>
        </div>

        <Field label="Display name">
          <Input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength={80}
            autoFocus
            autoComplete="name"
            placeholder="Your name"
            required
          />
        </Field>

        <Field label="Email">
          <Input value={email} readOnly />
        </Field>

        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      </form>
    </Dialog>
  );
}
