"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { useActionState, useState } from "react";
import { recoveryCreate } from "../../actions";

/** Make the codes, show them once, and let the person carry on only after they say they saved them. */
export function RecoveryCodes({
  next,
  remaining,
}: {
  next: string;
  remaining: number | null;
}) {
  const [state, make, pending] = useActionState(recoveryCreate, null);
  const [saved, setSaved] = useState(false);
  const codes = state?.ok ? (state.data?.codes ?? "").split("\n") : null;

  if (!codes) {
    return (
      <form action={make}>
        <input type="hidden" name="next" value={next} />
        <VStack gap={3} hAlign="stretch">
          {state?.message ? (
            <Banner status="error" title={state.message} />
          ) : null}
          {remaining !== null ? (
            <Text type="body">
              You have {remaining} recovery codes left. Making new ones stops
              the old ones working.
            </Text>
          ) : null}
          <Button
            label={
              remaining === null ? "Make my recovery codes" : "Make new codes"
            }
            type="submit"
            variant="primary"
            size="lg"
            isLoading={pending}
          />
          {remaining !== null ? (
            <Link href={next}>Keep the ones I have</Link>
          ) : null}
        </VStack>
      </form>
    );
  }
  return (
    <VStack gap={3} hAlign="stretch">
      <Banner
        status="warning"
        title="Write these down or save them in a password manager"
        description="This is the only time they are shown. Each one works once."
      />
      <ul
        style={{ fontFamily: "monospace", fontSize: "1.1rem", lineHeight: 1.8 }}
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <CheckboxInput
        label="I have saved these codes"
        value={saved}
        onChange={setSaved}
      />
      {saved ? (
        <Link href={next}>Continue</Link>
      ) : (
        <Text type="supporting" color="secondary">
          Tick the box to continue.
        </Text>
      )}
    </VStack>
  );
}
