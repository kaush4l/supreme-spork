"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { VStack } from "@astryxdesign/core/Layout";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useActionState, useEffect, useState } from "react";
import type { FormState } from "@/server/public-action";
import { Turnstile } from "./turnstile";

export type FieldSpec = {
  name: string;
  label: string;
  type?: "email" | "password" | "text";
  autoComplete?: string;
  inputMode?: "numeric" | "text";
};

type Props = {
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  fields: FieldSpec[];
  submitLabel: string;
  /** Values the form sends along that the person does not type (where to go next). */
  hidden?: Record<string, string>;
  captcha?: { siteKey: string; nonce?: string };
  /** Shown instead of the form after a success that does not redirect (a reset email was sent). */
  doneTitle?: string;
};

/**
 * One form for every signed-out page: fields drawn from a list, the server action's answer shown as a banner and under
 * the field it names, password fields emptied after every answer, and the CAPTCHA widget when a site key is set.
 */
export function AuthForm({
  action,
  fields,
  submitLabel,
  hidden,
  captcha,
  doneTitle,
}: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [captchaToken, setCaptchaToken] = useState("");

  // Whatever the answer, a password never stays in the page.
  useEffect(() => {
    if (state === null) return;
    setValues((current) => {
      const cleared = { ...current };
      for (const field of fields)
        if (field.type === "password") cleared[field.name] = "";
      return cleared;
    });
  }, [state, fields]);

  if (state?.ok && doneTitle) {
    return (
      <Banner status="success" title={doneTitle} description={state.message} />
    );
  }

  return (
    <form action={formAction} noValidate>
      <VStack gap={3} hAlign="stretch">
        {state?.message && !state.ok ? (
          <Banner status="error" title={state.message} />
        ) : null}
        {state?.ok && state.message ? (
          <Banner status="success" title={state.message} />
        ) : null}
        {fields.map((field) => (
          <TextInput
            key={field.name}
            label={field.label}
            htmlName={field.name}
            type={field.type ?? "text"}
            autoComplete={field.autoComplete}
            inputMode={field.inputMode}
            value={values[field.name] ?? ""}
            onChange={(value: string) =>
              setValues((current) => ({ ...current, [field.name]: value }))
            }
            isRequired
            size="lg"
            status={
              state?.fields?.[field.name]
                ? { type: "error", message: state.fields[field.name] as string }
                : undefined
            }
          />
        ))}
        {Object.entries(hidden ?? {}).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} readOnly />
        ))}
        {captcha ? (
          <Turnstile
            siteKey={captcha.siteKey}
            nonce={captcha.nonce}
            onToken={setCaptchaToken}
          />
        ) : null}
        <Button
          label={submitLabel}
          type="submit"
          variant="primary"
          size="lg"
          isLoading={pending}
          isDisabled={pending || (captcha !== undefined && captchaToken === "")}
        />
      </VStack>
    </form>
  );
}
