import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Sparkles, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

const VerifyEmail = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    if (!user?.email) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: user.email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      toast({ title: "Failed to resend", description: error.message, variant: "destructive" });
    } else {
      setResent(true);
      toast({ title: "Email sent!", description: "Check your inbox for the confirmation link." });
    }
    setResending(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md text-center"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Sparkles size={20} className="text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold tracking-tight">BlitzNova AI</span>
        </div>

        <div className="card-elevated p-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <Mail size={32} className="text-primary" />
          </div>

          <h2 className="text-2xl font-bold mb-2">Confirm your email</h2>
          <p className="text-muted-foreground text-sm mb-2">
            We sent a verification link to
          </p>
          <p className="font-semibold mb-5">{user?.email}</p>
          <p className="text-muted-foreground text-sm mb-7">
            Click the link in the email to activate your account.
            If you don't see it, check your spam folder.
          </p>

          <div className="space-y-3">
            <button
              onClick={handleResend}
              disabled={resending || resent}
              className="w-full flex items-center justify-center gap-2 btn-primary disabled:opacity-60"
            >
              <RefreshCw size={16} className={resending ? "animate-spin" : ""} />
              {resent ? "Email sent!" : resending ? "Sending..." : "Resend confirmation email"}
            </button>

            <button
              onClick={handleSignOut}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in with a different account
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default VerifyEmail;
