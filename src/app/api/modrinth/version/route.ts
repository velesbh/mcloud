import { NextRequest, NextResponse } from "next/server";
import { getProjectVersions } from "@/lib/modrinth/client";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get("projectId");
  const loaders = searchParams.get("loaders")?.split(",").filter(Boolean);
  const versions = searchParams.get("versions")?.split(",").filter(Boolean);

  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  try {
    const result = await getProjectVersions(projectId, loaders, versions);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to fetch versions from Modrinth" },
      { status: 500 }
    );
  }
}
