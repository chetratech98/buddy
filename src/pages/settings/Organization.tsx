import { useState } from "react";
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
import { Building2, Loader2, Plus, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Organization = () => {
  const { user, currentOrg, organizations, createOrg, leaveOrg, refreshOrgs } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [newOrgName, setNewOrgName] = useState("");
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameName, setRenameName] = useState(currentOrg?.name ?? "");
  const [showCreate, setShowCreate] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setCreating(true);
    try {
      await createOrg(newOrgName.trim());
      toast({ title: "Organization created!", description: `"${newOrgName}" is ready.` });
      setNewOrgName("");
      setShowCreate(false);
    } catch (e) {
      toast({ title: "Failed to create", description: (e as Error).message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !renameName.trim()) return;
    setRenaming(true);
    const { error } = await supabase
      .from("organizations")
      .update({ name: renameName.trim() })
      .eq("id", currentOrg.id);

    if (error) {
      toast({ title: "Failed to rename", description: error.message, variant: "destructive" });
    } else {
      await refreshOrgs();
      toast({ title: "Organization renamed" });
    }
    setRenaming(false);
  };

  const handleLeave = async () => {
    if (!currentOrg) return;
    if (currentOrg.owner_id === user?.id) {
      toast({
        title: "Cannot leave",
        description: "You're the owner. Transfer ownership or delete the org instead.",
        variant: "destructive",
      });
      return;
    }
    if (!confirm(`Leave "${currentOrg.name}"? You'll lose access to all shared content.`)) return;
    setLeaving(true);
    try {
      await leaveOrg(currentOrg.id);
      toast({ title: "Left organization" });
      navigate("/dashboard");
    } catch (e) {
      toast({ title: "Failed to leave", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLeaving(false);
    }
  };

  return (
    <PageShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Organization</h1>
          <p className="text-muted-foreground mt-1">Manage your team workspace</p>
        </div>

        {/* Current org settings */}
        {currentOrg ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 size={20} className="text-primary" />
                {currentOrg.name}
                <Badge variant="outline" className="ml-auto capitalize">{currentOrg.userRole}</Badge>
              </CardTitle>
              <CardDescription>
                Subscription: <span className="capitalize font-medium">{currentOrg.subscription_tier}</span>
                {" · "}
                {currentOrg.posts_used_this_month} / {
                  currentOrg.subscription_tier === "enterprise" ? "∞" : currentOrg.posts_quota_monthly
                } posts used this month
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {(currentOrg.userRole === "owner" || currentOrg.userRole === "admin") && (
                <form onSubmit={handleRename} className="space-y-3">
                  <Label>Organization Name</Label>
                  <div className="flex gap-2">
                    <Input
                      value={renameName}
                      onChange={e => setRenameName(e.target.value)}
                      placeholder="Organization name"
                      required
                    />
                    <Button type="submit" disabled={renaming || renameName === currentOrg.name}>
                      {renaming ? <Loader2 className="animate-spin" size={16} /> : "Rename"}
                    </Button>
                  </div>
                </form>
              )}

              <div className="flex gap-3 flex-wrap">
                <Button variant="outline" onClick={() => navigate("/settings/members")}>
                  Manage Members
                </Button>
                <Button variant="outline" onClick={() => navigate("/settings/sites")}>
                  WordPress Sites
                </Button>
              </div>

              {currentOrg.userRole !== "owner" && (
                <div className="pt-2 border-t">
                  <Button
                    variant="destructive"
                    onClick={handleLeave}
                    disabled={leaving}
                  >
                    {leaving ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                    Leave Organization
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You're not part of any organization yet. Create one below to collaborate with your team.
            </AlertDescription>
          </Alert>
        )}

        {/* All orgs list */}
        {organizations.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle>All Organizations</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {organizations.map(org => (
                  <li key={org.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium">{org.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{org.userRole}</p>
                    </div>
                    {currentOrg?.id !== org.id && (
                      <Button size="sm" variant="outline" onClick={() => navigate("/settings/organization")}>
                        Switch
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Create new org */}
        {!showCreate ? (
          <Button variant="outline" onClick={() => setShowCreate(true)} className="w-full">
            <Plus size={16} className="mr-2" />
            Create New Organization
          </Button>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Create Organization</CardTitle>
              <CardDescription>A new workspace for your team</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-3">
                <div>
                  <Label>Organization Name</Label>
                  <Input
                    className="mt-1.5"
                    placeholder="e.g. Acme Agency"
                    value={newOrgName}
                    onChange={e => setNewOrgName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={creating}>
                    {creating ? <Loader2 className="animate-spin mr-2" size={16} /> : <Plus size={16} className="mr-2" />}
                    Create
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </PageShell>
  );
};

export default Organization;
