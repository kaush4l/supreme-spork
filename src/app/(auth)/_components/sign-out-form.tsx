"use client";

import { Button } from "@astryxdesign/core/Button";
import { useActionState } from "react";
import { signOut } from "../actions";

/** Ends this device's session (or every device's, with `scope="global"`) and goes to the sign-in page. */
export function SignOutForm({
  label = "Sign out",
  scope = "local",
}: {
  label?: string;
  scope?: "local" | "global";
}) {
  const [, action, pending] = useActionState(signOut, null);
  return (
    <form action={action}>
      <input type="hidden" name="scope" value={scope} readOnly />
      <Button label={label} type="submit" variant="ghost" isLoading={pending} />
    </form>
  );
}
