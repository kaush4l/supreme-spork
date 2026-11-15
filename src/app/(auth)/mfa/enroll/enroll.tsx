"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { VStack } from "@astryxdesign/core/Layout";
import { Text } from "@astryxdesign/core/Text";
import { useActionState } from "react";
import { AuthForm } from "../../_components/auth-form";
import { mfaConfirm, mfaStart } from "../../actions";

/** Two steps: ask for a new authenticator secret (shown as a QR image and as text), then check the first code. */
export function Enroll({ next }: { next: string }) {
  const [state, start, pending] = useActionState(mfaStart, null);
  const enrolled = state?.ok ? state.data : undefined;

  if (!enrolled) {
    return (
      <form action={start}>
        <VStack gap={3} hAlign="stretch">
          {state?.message ? (
            <Banner status="error" title={state.message} />
          ) : null}
          <Button
            label="Set up an authenticator app"
            type="submit"
            variant="primary"
            size="lg"
            isLoading={pending}
          />
        </VStack>
      </form>
    );
  }
  return (
    <VStack gap={3} hAlign="stretch">
      <Text type="body">
        Scan this with an authenticator app (Google Authenticator, 1Password,
        Authy), then type the code it shows.
      </Text>
      {/* biome-ignore lint/performance/noImgElement: a data: image from the login service, nothing to optimise */}
      <img
        src={enrolled.qr}
        alt="QR code for your authenticator app"
        width={192}
        height={192}
      />
      <Text type="supporting" color="secondary">
        Cannot scan it? Type this key into the app instead:{" "}
        <strong>{enrolled.secret}</strong>
      </Text>
      <AuthForm
        action={mfaConfirm}
        submitLabel="Turn on"
        hidden={{ factorId: enrolled.factorId as string, next }}
        fields={[
          {
            name: "code",
            label: "6-digit code",
            autoComplete: "one-time-code",
            inputMode: "numeric",
          },
        ]}
      />
    </VStack>
  );
}
