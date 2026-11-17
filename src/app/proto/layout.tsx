import { notFound } from "next/navigation";
import { ProtoRoot } from "@/proto/components/proto-root";
import { protoEnabled } from "@/proto/guard";

export const metadata = { title: "Prototype (sample data)" };

export default function ProtoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!protoEnabled()) notFound();
  return <ProtoRoot>{children}</ProtoRoot>;
}
