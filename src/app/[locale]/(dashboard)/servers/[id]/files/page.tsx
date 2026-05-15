"use client";
import { use } from "react";
import { FileManager } from "@/components/server/FileManager";

export default function FilesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <FileManager serverId={id} />;
}
