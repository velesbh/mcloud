"use client";
import { use } from "react";
import { FileManagerV2 } from "@/components/server/FileManagerV2";

export default function FilesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <FileManagerV2 serverId={id} />;
}
