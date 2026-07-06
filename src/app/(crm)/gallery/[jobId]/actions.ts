"use server";

import { revalidatePath } from "next/cache";
import { pairPhotosSchema } from "@/validators/media";
import { pairPhotos, unpairPhoto } from "@/services/media.service";

export type PairPhotosResult = { ok: true } | { ok: false; message: string };

export async function pairPhotosAction(jobId: string, photoId: string, pairWithId: string): Promise<PairPhotosResult> {
  const parsed = pairPhotosSchema.safeParse({ photoId, pairWithId });
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Pick two photos to pair." };

  await pairPhotos(parsed.data.photoId, parsed.data.pairWithId);
  revalidatePath(`/gallery/${jobId}`);
  return { ok: true };
}

export async function unpairPhotoAction(jobId: string, photoId: string): Promise<void> {
  await unpairPhoto(photoId);
  revalidatePath(`/gallery/${jobId}`);
}
