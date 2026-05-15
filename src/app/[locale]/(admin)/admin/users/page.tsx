"use client";
import { useQuery } from "@tanstack/react-query";
import { PageLoader } from "@/components/shared/LoadingScreen";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import type { Profile } from "@/lib/supabase/types";

export default function UsersPage() {
  const { data: users = [], isLoading } = useQuery<(Profile & { server_count: number })[]>({
    queryKey: ["admin-users"],
    queryFn: () => fetch("/api/users").then((r) => r.json()),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <PageHeader title="Users" description={`${users.length} registered users`} />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Servers</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium text-sm">{user.email}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {user.display_name ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      user.role === "admin"
                        ? "text-primary border-primary/30"
                        : ""
                    }
                  >
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{user.server_count}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(user.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
