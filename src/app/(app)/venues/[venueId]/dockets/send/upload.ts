import { resizeToJpeg } from "../../lists/[listId]/resize-image";

export type SentDocket = { documentId: string; created: boolean };

/** Images are resized to a 1600 px JPEG in the browser; a PDF is sent as it is. */
export async function sendDocket(
  venueId: string,
  file: File,
): Promise<SentDocket> {
  const isPdf = file.type === "application/pdf";
  const form = new FormData();
  if (isPdf) form.append("file", file, file.name || "docket.pdf");
  else form.append("file", await resizeToJpeg(file), "docket.jpg");
  const response = await fetch(`/venues/${venueId}/dockets/send/file`, {
    method: "POST",
    body: form,
    credentials: "same-origin",
  });
  const body = (await response.json().catch(() => null)) as {
    document_id?: unknown;
    created?: unknown;
    error?: { message?: unknown };
  } | null;
  if (
    !response.ok ||
    typeof body?.document_id !== "string" ||
    typeof body.created !== "boolean"
  )
    throw new Error(
      typeof body?.error?.message === "string"
        ? body.error.message
        : "The docket did not upload. Please try again.",
    );
  return { documentId: body.document_id, created: body.created };
}
