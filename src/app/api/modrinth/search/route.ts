import { NextRequest, NextResponse } from "next/server";
import { searchModrinth } from "@/lib/modrinth/client";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const query = searchParams.get("query") ?? "";
  const type = searchParams.get("type");
  const loader = searchParams.get("loader");
  const version = searchParams.get("version");
  const offset = parseInt(searchParams.get("offset") ?? "0");
  const limit = parseInt(searchParams.get("limit") ?? "20");

  const facets: string[][] = [];
  if (type) facets.push([`project_type:${type}`]);
  if (loader) facets.push([`categories:${loader}`]);
  if (version) facets.push([`versions:${version}`]);

  try {
    const result = await searchModrinth({
      query,
      facets: facets.length > 0 ? facets : undefined,
      offset,
      limit,
      index: "relevance",
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to fetch from Modrinth" },
      { status: 500 }
    );
  }
}
