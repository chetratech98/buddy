import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, UserPlus, Copy, Check, Trash2, AlertCircle, Users, Crown, Shield } from "lucide-react";

interface Member {
  id: string;
  user_id: string | null;
  role: string;
  invited_email: string | null;
  invite_token: string;
  accepted_at: string | null;
  profiles?: { display_name: string } | null;
}

const RoleIcon = ({ role }: { role: string }) => {
  if (role === "owner") return <Crown size={14} className="text-yellow-500" />;
  if (role === "admin") return <Shield size={14} className="text-blue-500" />;
  return null;
};

const Members = () => {
  const { user, currentOrg } = useAuth();
  const { toast } = useToast();

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviting, setInviting] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const canManage = currentOrg?.userRole === "owner" || currentOrg?.userRole === "admin";

  const fetchMembers = async () => {
    if (!currentOrg) return;
    const { data, error } = await supabase
      .from("organization_members")
      .select("id, user_id, role, invited_email, invite_token, accepted_at")
      .eq("org_id", currentOrg.id)
      .order("created_at");

    if (!error && data) setMembers(data as Member[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchMembers();
  }, [currentOrg]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !inviteEmail.trim()) return;
    setInviting(true);

    const { error } = await supabase.from("organization_members").insert({
      org_id: currentOrg.id,
      role: inviteRole,
      invited_email: inviteEmail.trim().toLowerCase(),
    });

    if (error) {
      toast({ title: "Failed to create invite", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Invite created!", description: "Copy the invite link to share with them." });
      setInviteEmail("");
      await fetchMembers();
    }
    setInviting(false);
  };

  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
    toast({ title: "Invite link copied!" });
  };

  const handleRemove = async (memberId: string, memberUserId: string | null) => {
    if (memberUserId === user?.id) {
      toast({ title: "Use 'Leave Organization' from org settings to leave.", variant: "destructive" });
      return;
    }
    if (!confirm("Remove this member?")) return;
    setRemovingId(memberId);
    const { error } = await supabase.from("organization_members").delete().eq("id", memberId);
    if (error) {
      toast({ title: "Failed to remove", description: error.message, variant: "destructive" });
    } else {
      setMembers(prev => prev.filter(m => m.id !== memberId));
      toast({ title: "Member removed" });
    }
    setRemovingId(null);
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    const { error } = await supabase
      .from("organization_members")
      .update({ role: newRole })
      .eq("id", memberId);

    if (error) {
      toast({ title: "Failed to update role", description: error.message, variant: "destructive" });
    } else {
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
      toast({ title: "Role updated" });
    }
  };

  if (!currentOrg) {
    return (
      <PageShell>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You're not part of any organization. <a href="/settings/organization" className="text-primary underline">Create one first.</a>
          </AlertDescription>
        </Alert>
      </PageShell>
    );
  }

  const accepted = members.filter(m => m.accepted_at);
  const pending = members.filter(m => !m.accepted_at);

  return (
    <PageShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Team Members</h1>
          <p className="text-muted-foreground mt-1">{currentOrg.name}</p>
        </div>

        {/* Invite form */}
        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus size={18} className="text-primary" />
                Invite a Member
              </CardTitle>
              <CardDescription>
                Enter their email and copy the invite link to share.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInvite} className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label>Email address</Label>
                    <Input
                      type="email"
                      placeholder="colleague@example.com"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      required
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <select
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value as "admin" | "member")}
                      className="mt-1.5 h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <Button type="submit" disabled={inviting}>
                  {inviting ? <Loader2 className="animate-spin mr-2" size={16} /> : <UserPlus size={16} className="mr-2" />}
                  Create Invite
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Active members */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users size={18} />
              Active Members ({accepted.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="animate-spin text-muted-foreground" />
              </div>
            ) : accepted.length === 0 ? (
              <p className="text-muted-foreground text-sm">No members yet.</p>
            ) : (
              <ul className="space-y-3">
                {accepted.map(m => (
                  <li key={m.id} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {(m.invited_email ?? "?")[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{m.invited_email ?? "Unknown"}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <RoleIcon role={m.role} />
                          <span className="capitalize">{m.role}</span>
                        </div>
                      </div>
                    </div>
                    {canManage && m.user_id !== user?.id && m.role !== "owner" && (
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={m.role}
                          onChange={e => handleRoleChange(m.id, e.target.value)}
                          className="text-xs h-7 rounded border border-input bg-background px-2"
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive h-7 w-7 p-0"
                          onClick={() => handleRemove(m.id, m.user_id)}
                          disabled={removingId === m.id}
                        >
                          {removingId === m.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Pending invites */}
        {pending.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Pending Invites ({pending.length})</CardTitle>
              <CardDescription>Share the invite link with each person.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {pending.map(m => (
                  <li key={m.id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{m.invited_email ?? "No email"}</p>
                      <p className="text-xs text-muted-foreground capitalize">{m.role} · Pending</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyInviteLink(m.invite_token)}
                        className="h-7 text-xs"
                      >
                        {copiedToken === m.invite_token ? (
                          <Check size={12} className="mr-1 text-green-500" />
                        ) : (
                          <Copy size={12} className="mr-1" />
                        )}
                        Copy Link
                      </Button>
                      {canManage && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive h-7 w-7 p-0"
                          onClick={() => handleRemove(m.id, m.user_id)}
                          disabled={removingId === m.id}
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </PageShell>
  );
};

export default Members;
