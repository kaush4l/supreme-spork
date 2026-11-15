import { VStack } from "@astryxdesign/core/Layout";
import { Link } from "@astryxdesign/core/Link";
import { Heading, Text } from "@astryxdesign/core/Text";
import { requirePrincipal } from "@/server/auth/principal";
import { myProfile } from "@/server/data/person";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "My profile" };

export default async function ProfilePage() {
  const principal = await requirePrincipal();
  const profile = await myProfile(principal.accessToken);
  return (
    <VStack gap={4} padding={6} hAlign="stretch">
      <VStack gap={1}>
        <Heading level={1}>My profile</Heading>
        <Text type="body" color="secondary">
          This is yours, not a venue's. The venues you work at can see it. What
          a venue keeps about you is separate and never shows here.
        </Text>
      </VStack>
      <Text type="supporting" color="secondary">
        Signed in as {profile.email ?? "you"}
      </Text>
      <ProfileForm
        initial={{
          displayName: profile.display_name ?? "",
          phone: profile.phone ?? "",
          headline: profile.headline ?? "",
          about: profile.about ?? "",
          skills: profile.skills,
        }}
      />
      <Link href="/">Back</Link>
    </VStack>
  );
}
