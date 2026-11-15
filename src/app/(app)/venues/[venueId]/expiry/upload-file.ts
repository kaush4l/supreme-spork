import { resizeToJpeg } from "../lists/[listId]/resize-image";

/** Send a PDF as it is, or a photo resized to a 1600 px JPEG, to this site's upload route; returns the document id. */
export async function uploadExpiryFile(
  venueId: string,
  file: File,
  scope: "venue" | "person",
): Promise<string> {
  const form = new FormData();
  if (file.type.startsWith("image/"))
    form.append("file", await resizeToJpeg(file), "photo.jpg");
  else form.append("file", file, file.name || "file");
  const response = await fetch(
    `/venues/${venueId}/expiry/upload?scope=${scope}`,
    {
      method: "POST",
      body: form,
      credentials: "same-origin",
    },
  );
  const body = (await response.json().catch(() => null)) as {
    document_id?: unknown;
    error?: { message?: unknown };
  } | null;
  if (!response.ok || typeof body?.document_id !== "string")
    throw new Error(
      typeof body?.error?.message === "string"
        ? body.error.message
        : "The file did not upload. Please try again.",
    );
  return body.document_id;
}
