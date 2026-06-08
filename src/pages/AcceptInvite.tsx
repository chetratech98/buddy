import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Loader2, CheckCircle2, XCircle, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface InviteInfo {
  orgName: string;
  invitedEmail: string | null;
  role: string;
}

const AcceptInvite = () => {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading, refreshOrgs, switchOrg } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) {
      setFetchError("Invalid invite link.");
      return;
    }
    const load = async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("role, invited_email, invite_expires_at, organizations(name)")
        .eq("invite_token", token)
        .is("accepted_at", null)
        .single();

      if (error || !data) {
        setFetchError("This invite link is invalid or has already been used.");
        return;
      }
      if (data.invite_expires_at && new Date(data.invite_expires_at) < new Date()) {
        setFetchError("This invite link has expired. Ask the org admin to send a new one.");
        return;
      }
      setInvite({
        orgName: (data.organizations as any)?.name ?? "Unknown Organization",
        invitedEmail: data.invited_email,
        role: data.role,
      });
    };
    load();
  }, [token]);

  const handleAccept = async () => {
    if (!user) {
      // Save invite token and redirect to auth
      navigate("/auth", { state: { from: `/invite/${token}` } });
      return;
    }

    setAccepting(true);
    const { error } = await supabase
      .from("organization_members")
      .update({
        user_id: user.id,
        accepted_at: new Date().toISOString(),
      })
      .eq("invite_token", token)
      .is("accepted_at", null);

    if (error) {
      toast({ title: "Failed to accept invite", description: error.message, variant: "destructive" });
      setAccepting(false);
      return;
    }

    await refreshOrgs();
    setAccepted(true);

    setTimeout(async () => {
      // Switch to the new org and go to dashboard
      const { data: member } = await supabase
        .from("organization_members")
        .select("org_id")
        .eq("invite_token", token)
        .single();
      if (member?.org_id) switchOrg(member.org_id);
      navigate("/dashboard");
    }, 1500);
  };

  if (authLoading || (!invite && !fetchError)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Sparkles size={20} className="text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold tracking-tight">BlitzNova AI</span>
        </div>

        <div className="card-elevated p-8 text-center">
          {fetchError ? (
            <>
              <XCircle className="mx-auto text-destructive mb-4" size={48} />
              <h2 className="text-xl font-bold mb-2">Invite not found</h2>
              <p className="text-muted-foreground text-sm mb-6">{fetchError}</p>
              <button onClick={() => navigate("/")} className="text-sm text-primary hover:underline">
                Go to homepage
              </button>
            </>
          ) : accepted ? (
            <>
              <CheckCircle2 className="mx-auto text-primary mb-4" size={48} />
              <h2 className="text-xl font-bold mb-2">Welcome to {invite?.orgName}!</h2>
              <p className="text-muted-foreground text-sm">Redirecting to your dashboard...</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
                <Users size={32} className="text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">You're invited!</h2>
              <p className="text-muted-foreground text-sm mb-1">
                You've been invited to join
              </p>
              <p className="text-lg font-semibold mb-1">{invite?.orgName}</p>
              <p className="text-sm text-muted-foreground mb-6">
                as a <span className="capitalize font-medium text-foreground">{invite?.role}</span>
              </p>

              {!user && (
                <p className="text-sm text-muted-foreground bg-muted rounded-lg p-3 mb-5">
                  You'll need to sign in or create an account to accept this invite.
                </p>
              )}

              <button
                onClick={handleAccept}
                disabled={accepting}
                className="w-full btn-primary"
              >
                {accepting ? (
                  <><Loader2 size={16} className="animate-spin inline mr-2" />Joining...</>
                ) : user ? (
                  `Join ${invite?.orgName}`
                ) : (
                  "Sign in to Accept"
                )}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default AcceptInvite;
