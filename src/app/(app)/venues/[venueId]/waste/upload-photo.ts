import { resizeToJpeg } from "../lists/[listId]/resize-image";

/** Resize the chosen photo and send it to this site's waste photo route; returns the backend's document id. */
export async function uploadWastePhoto(
  venueId: string,
  file: File,
): Promise<string> {
  const jpeg = await resizeToJpeg(file);
  const form = new FormData();
  form.append("file", jpeg, "waste.jpg");
  const response = await fetch(`/venues/${venueId}/waste/photo`, {
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
