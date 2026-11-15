"use client";

import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { VStack } from "@astryxdesign/core/Layout";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { blankToNull, splitSkills } from "@/server/data/person-text";
import { saveProfile } from "./actions";

type Initial = {
  displayName: string;
  phone: string;
  headline: string;
  about: string;
  skills: string[];
};

/** Edit your own profile. Only what you changed is sent; a box you empty is cleared. */
export function ProfileForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(initial);
  const [name, setName] = useState(initial.displayName);
  const [phone, setPhone] = useState(initial.phone);
  const [headline, setHeadline] = useState(initial.headline);
  const [about, setAbout] = useState(initial.about);
  const [skills, setSkills] = useState(initial.skills.join(", "));
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = () =>
    start(async () => {
      setMessage(null);
      setDone(false);
      const list = splitSkills(skills);
      const changed = {
        ...(name.trim() !== saved.displayName.trim()
          ? { displayName: blankToNull(name) }
          : {}),
        ...(phone.trim() !== saved.phone.trim()
          ? { phone: blankToNull(phone) }
          : {}),
        ...(headline.trim() !== saved.headline.trim()
          ? { headline: blankToNull(headline) }
          : {}),
        ...(about.trim() !== saved.about.trim()
          ? { about: blankToNull(about) }
          : {}),
        ...(list.join("\n") !== saved.skills.join("\n")
          ? { skills: list }
          : {}),
      };
      if (Object.keys(changed).length === 0) {
        setDone(true);
        return;
      }
      const result = await saveProfile({ key, ...changed });
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      setKey(crypto.randomUUID());
      setSaved({
        displayName: name.trim(),
        phone: phone.trim(),
        headline: headline.trim(),
        about: about.trim(),
        skills: list,
      });
      setDone(true);
      router.refresh();
    });

  return (
    <VStack gap={3} hAlign="stretch">
      {message ? <Banner status="error" title={message} /> : null}
      {done ? <Banner status="success" title="Profile saved." /> : null}
      <TextInput label="Name" value={name} onChange={setName} size="lg" />
      <TextInput
        label="Phone"
        type="tel"
        value={phone}
        onChange={setPhone}
        isOptional
        size="lg"
      />
      <TextInput
        label="Headline"
        description="One line about you, for example: Bartender, five years."
        value={headline}
        onChange={setHeadline}
        isOptional
        size="lg"
      />
      <TextArea
        label="About you"
        value={about}
        onChange={setAbout}
        maxLength={2000}
        isOptional
      />
      <TextInput
        label="Skills"
        description="Separate them with commas, for example: cocktails, coffee."
        value={skills}
        onChange={setSkills}
        isOptional
        size="lg"
      />
      <Button
        label="Save profile"
        variant="primary"
        size="lg"
        isLoading={pending}
        onClick={submit}
      />
    </VStack>
  );
}
