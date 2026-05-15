"use client";
import { use } from "react";
import dynamic from "next/dynamic";
import { PageLoader } from "@/components/shared/LoadingScreen";

const ConsoleTerminal = dynamic(
  () =>
    import("@/components/server/ConsoleTerminal").then(
      (m) => m.ConsoleTerminal
    ),
  { ssr: false, loading: () => <PageLoader /> }
);

export default function ConsolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <div style={{ height: "calc(100vh - 220px)" }} className="min-h-[400px]">
      <ConsoleTerminal serverId={id} />
    </div>
  );
}
