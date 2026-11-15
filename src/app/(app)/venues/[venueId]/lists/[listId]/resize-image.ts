import { fitWithin } from "./image-size";

/** Resize a chosen photo to at most 1600 px on the long side and re-encode it as a JPEG (also drops its location data). */
export async function resizeToJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const { width, height } = fitWithin(bitmap.width, bitmap.height, 1600);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no canvas");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!blob) throw new Error("no jpeg");
  return blob;
}

/** Send the photo to this site's upload route; returns the backend's document id. */
export async function uploadPhoto(
  venueId: string,
  listId: string,
  file: File,
): Promise<string> {
  const jpeg = await resizeToJpeg(file);
  const form = new FormData();
  form.append("file", jpeg, "photo.jpg");
  const response = await fetch(`/venues/${venueId}/lists/${listId}/photo`, {
    method: "POST",
    body: form,
    credentials: "same-origin",
  });
  const body = (await response.json().catch(() => null)) as {
    document_id?: unknown;
    error?: { message?: unknown };
  } | null;
  if (!response.ok || typeof body?.document_id !== "string")
    throw new Error(
      typeof body?.error?.message === "string"
        ? body.error.message
        : "The photo did not upload. Please try again.",
    );
  return body.document_id;
}
