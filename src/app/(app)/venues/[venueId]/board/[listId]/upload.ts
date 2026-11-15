import { resizeToJpeg } from "../../lists/[listId]/resize-image";

/** Send the photo to this site's manager upload route; returns the backend's document id. */
export async function uploadPhoto(
  venueId: string,
  listId: string,
  file: File,
): Promise<string> {
  const jpeg = await resizeToJpeg(file);
  const form = new FormData();
  form.append("file", jpeg, "photo.jpg");
  const response = await fetch(`/venues/${venueId}/board/${listId}/photo`, {
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
