"use client";
import { use, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Trash2, Crown, Users } from "lucide-react";
import { PixelPanel, PixelButton } from "@/components/pixel/PixelPanel";
import { LoadingSpinner } from "@/components/shared/MinecraftLoader";
import { toast } from "sonner";
import type { ServerCollaborator } from "@/lib/supabase/types";
import { useAuth } from "@clerk/nextjs";
import { formatDistanceToNow } from "date-fns";

export default function UsersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const { userId } = useAuth();
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const { data: server } = useQuery({
    queryKey: ["server", id],
    queryFn: () => fetch(`/api/servers/${id}`).then((r) => r.json()),
  });

  const { data: collaborators = [], isLoading } = useQuery<ServerCollaborator[]>({
    queryKey: ["collaborators", id],
    queryFn: async () => {
      const res = await fetch(`/api/servers/${id}/collaborators`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const isOwner = server?.clerk_user_id === userId;

  async function addCollaborator() {
    if (!email.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/servers/${id}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${email.trim()} can now access this server`);
        setEmail("");
        qc.invalidateQueries({ queryKey: ["collaborators", id] });
      } else {
        toast.error(data.error ?? "Failed to add collaborator");
      }
    } finally {
      setAdding(false);
    }
  }

  async function removeCollaborator(collaboratorId: string, collabEmail: string) {
    setRemoving(collaboratorId);
    try {
      const res = await fetch(`/api/servers/${id}/collaborators`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collaboratorId }),
      });
      if (res.ok) {
        toast.success(`${collabEmail} removed`);
        qc.invalidateQueries({ queryKey: ["collaborators", id] });
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed to remove");
      }
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Owner */}
      <PixelPanel variant="stone" title="Owner" className="p-4">
        <div className="flex items-center gap-3">
          <Crown className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-medium">{server?.clerk_user_id === userId ? "You" : "Server owner"}</p>
            <p className="text-xs text-muted-foreground font-mono">{server?.clerk_user_id?.slice(0, 18)}…</p>
          </div>
          <span className="ml-auto text-[10px] font-minecraft text-amber-400 uppercase">Owner</span>
        </div>
      </PixelPanel>

      {/* Collaborators list */}
      <PixelPanel variant="stone" title={`Collaborators (${collaborators.length})`} className="p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-6"><LoadingSpinner size={20} /></div>
        ) : collaborators.length === 0 ? (
          <div className="text-center py-6 space-y-2">
            <Users className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">No collaborators yet.</p>
            {isOwner && <p className="text-xs text-muted-foreground">Add someone below to give them access.</p>}
          </div>
        ) : (
          collaborators.map((c) => (
            <div key={c.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{c.email}</p>
                <p className="text-xs text-muted-foreground">
                  Added {formatDistanceToNow(new Date(c.added_at), { addSuffix: true })}
                </p>
              </div>
              {(isOwner || c.clerk_user_id === userId) && (
                <button
                  onClick={() => removeCollaborator(c.id, c.email)}
                  disabled={removing === c.id}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  title={c.clerk_user_id === userId ? "Leave server" : "Remove collaborator"}
                >
                  {removing === c.id ? <LoadingSpinner size={14} /> : <Trash2 className="w-4 h-4" />}
                </button>
              )}
            </div>
          ))
        )}
      </PixelPanel>

      {/* Add collaborator — owner only */}
      {isOwner && (
        <PixelPanel variant="stone" title="Add Collaborator" className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Enter their MCloud account email. They must have signed up first.
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCollaborator()}
              placeholder="friend@example.com"
              className="flex-1 px-3 py-2 text-sm bg-background border-2 border-border focus:border-primary outline-none"
              style={{ borderRadius: 0 }}
            />
            <PixelButton
              variant="green"
              onClick={addCollaborator}
              disabled={adding || !email.trim()}
            >
              {adding ? <LoadingSpinner size={12} /> : <UserPlus className="w-3.5 h-3.5" />}
              Add
            </PixelButton>
          </div>
        </PixelPanel>
      )}
    </div>
  );
}
