import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { SIGN_UP_SENT } from "@/server/auth/messages";
import { AuthShell } from "../../_components/auth-shell";

export const metadata = { title: "Check your email" };

export default function CheckEmailPage() {
  return (
    <AuthShell
      title="Check your email"
      footer={
        <>
          Confirmed it? <Link href="/sign-in">Sign in</Link>
        </>
      }
    >
      <Text type="body">{SIGN_UP_SENT}</Text>
      <Text type="supporting" color="secondary">
        The link works for 30 minutes. Nothing here tells you whether an address
        already had an account, on purpose.
      </Text>
    </AuthShell>
  );
}
