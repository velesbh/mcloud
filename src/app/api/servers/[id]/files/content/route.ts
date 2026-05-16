import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * GET /api/servers/[id]/files/content?path=/server.properties
 * Returns the raw text content of a file stored in Supabase Storage.
 *
 * PUT /api/servers/[id]/files/content?path=/server.properties
 * Overwrites the file with the request body (text/plain).
 */

async function checkOwnership(userId: string, serverId: string) {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("servers")
    .select("id")
    .eq("id", serverId)
    .eq("clerk_user_id", userId)
    .single();
  return !!data;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const path = req.nextUrl.searchParams.get("path");
  if (!path) return new NextResponse("Missing path", { status: 400 });

  if (!(await checkOwnership(userId, id))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const admin = createAdminSupabaseClient();

  // Look up the storage_path for this file
  const { data: fileRow } = await admin
    .from("server_files")
    .select("storage_path, is_directory")
    .eq("server_id", id)
    .eq("path", path)
    .single();

  if (!fileRow || fileRow.is_directory) {
    return new NextResponse("Not found", { status: 404 });
  }

  // If we have a real storage path, fetch from Supabase Storage
  if (fileRow.storage_path) {
    const { data, error } = await admin.storage
      .from("server-files")
      .download(fileRow.storage_path);

    if (error || !data) {
      return new NextResponse("Storage error", { status: 500 });
    }

    const text = await data.text();
    return new NextResponse(text, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // No storage path yet — return empty placeholder
  const name = path.split("/").pop() ?? "file";
  return new NextResponse(
    `# ${name}\n# This file has no content yet. Start editing and save to write it.\n`,
    { headers: { "Content-Type": "text/plain; charset=utf-8" } }
  );
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const path = req.nextUrl.searchParams.get("path");
  if (!path) return new NextResponse("Missing path", { status: 400 });

  if (!(await checkOwnership(userId, id))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const content = await req.text();
  const storagePath = `${id}${path}`;
  const admin = createAdminSupabaseClient();

  // Upsert to Supabase Storage
  const { error: uploadError } = await admin.storage
    .from("server-files")
    .upload(storagePath, new Blob([content], { type: "text/plain" }), {
      upsert: true,
      contentType: "text/plain",
    });

  if (uploadError) {
    console.error("[file content PUT]", uploadError);
    return new NextResponse("Storage upload failed", { status: 500 });
  }

  const name = path.split("/").pop() ?? "file";

  // Update metadata row with storage path and size
  await admin
    .from("server_files")
    .upsert(
      {
        server_id: id,
        path,
        name,
        is_directory: false,
        storage_path: storagePath,
        size_bytes: Buffer.byteLength(content, "utf8"),
      },
      { onConflict: "server_id,path" }
    );

  return new NextResponse("OK");
}
