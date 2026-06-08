import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Sparkles, Eye, EyeOff, Mail, Lock, User, AlertCircle, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

function friendlyAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials") || m.includes("invalid_credentials"))
    return "Incorrect email or password. Please check your credentials and try again.";
  if (m.includes("email not confirmed"))
    return "Your email isn't confirmed yet. Check your inbox for a confirmation link.";
  if (m.includes("user already registered"))
    return "An account with this email already exists. Sign in instead.";
  if (m.includes("unable to validate email address"))
    return "Please enter a valid email address.";
  if (m.includes("password should be at least"))
    return "Password must be at least 6 characters.";
  return msg;
}

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

type Mode = "signin" | "signup" | "magic";

// Shown after a successful action that requires checking email
const EmailSentScreen = ({
  email,
  title,
  description,
  onBack,
}: {
  email: string;
  title: string;
  description: string;
  onBack: () => void;
}) => (
  <div className="min-h-screen bg-background flex items-center justify-center px-4">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md text-center"
    >
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
        <Mail size={32} className="text-primary" />
      </div>
      <h2 className="text-2xl font-bold mb-3">{title}</h2>
      <p className="text-muted-foreground mb-2">{description}</p>
      <p className="font-semibold mb-6">{email}</p>
      <p className="text-sm text-muted-foreground mb-6">
        If you don't see it within a minute, check your spam folder.
      </p>
      <button onClick={onBack} className="text-sm text-primary hover:underline">
        Back to Sign In
      </button>
    </motion.div>
  </div>
);

const Auth = () => {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState<{ title: string; description: string } | null>(null);

  const { user, signIn, signUp, signInWithGoogle, signInWithMagicLink, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const from = (location.state as any)?.from ?? "/dashboard";

  // If already logged in, show a "continue" option instead of hard-redirecting
  // so the user can also choose to sign out and use a different account
  const [showAlreadyLoggedIn, setShowAlreadyLoggedIn] = useState(false);

  useEffect(() => {
    if (user) setShowAlreadyLoggedIn(true);
  }, [user]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setInlineError(null);
    setPassword("");
    setConfirmPassword("");
    setEmailSent(null);
  };

  // ── Password sign in / sign up ──────────────────────────────────────────────
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError(null);

    if (mode === "signup") {
      if (password !== confirmPassword) { setInlineError("Passwords do not match."); return; }
      if (password.length < 6) { setInlineError("Password must be at least 6 characters."); return; }
    }

    setLoading(true);
    if (mode === "signin") {
      const { error } = await signIn(email, password);
      if (error) {
        const msg = friendlyAuthError(error.message);
        setInlineError(msg);
      }
    } else {
      const { error } = await signUp(email, password, displayName.trim() || undefined);
      if (error) {
        const msg = friendlyAuthError(error.message);
        setInlineError(msg);
        toast({ title: "Sign up failed", description: msg, variant: "destructive" });
      } else {
        setEmailSent({
          title: "Check your email",
          description: "We sent a confirmation link to",
        });
      }
    }
    setLoading(false);
  };

  // ── Magic link ──────────────────────────────────────────────────────────────
  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineError(null);
    setLoading(true);
    const { error } = await signInWithMagicLink(email);
    if (error) {
      const msg = friendlyAuthError(error.message);
      setInlineError(msg);
    } else {
      setEmailSent({
        title: "Magic link sent!",
        description: "We sent a sign-in link to",
      });
    }
    setLoading(false);
  };

  // ── Google ──────────────────────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      toast({ title: "Google sign in failed", description: error.message, variant: "destructive" });
      setGoogleLoading(false);
    }
  };

  // ── Already logged in screen ───────────────────────────────────────────────
  if (showAlreadyLoggedIn && user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md text-center"
        >
          <div className="flex items-center justify-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <Sparkles size={20} className="text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold tracking-tight">BlitzNova AI</span>
          </div>
          <div className="card-elevated p-8">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <User size={22} className="text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-1">You're signed in</h2>
            <p className="text-sm text-muted-foreground mb-6">{user.email}</p>
            <div className="space-y-3">
              <button
                onClick={() => navigate(from, { replace: true })}
                className="w-full btn-primary"
              >
                Continue to Dashboard
              </button>
              <button
                onClick={async () => {
                  await signOut();
                  setShowAlreadyLoggedIn(false);
                }}
                className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-xl transition-colors"
              >
                Sign out and use a different account
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Email sent confirmation screen ─────────────────────────────────────────
  if (emailSent) {
    return (
      <EmailSentScreen
        email={email}
        title={emailSent.title}
        description={emailSent.description}
        onBack={() => { setEmailSent(null); setMode("signin"); }}
      />
    );
  }

  const tabs: { id: Mode; label: string }[] = [
    { id: "signin",  label: "Sign In"     },
    { id: "signup",  label: "Sign Up"     },
    { id: "magic",   label: "Magic Link"  },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-accent/10 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md relative"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-sm">
            <Sparkles size={20} className="text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold tracking-tight">BlitzNova AI</span>
        </div>

        <div className="card-elevated p-8">

          {/* Tab switcher */}
          <div className="flex rounded-xl bg-muted p-1 mb-6 gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => switchMode(tab.id)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  mode === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.id === "magic" ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <Zap size={13} />
                    {tab.label}
                  </span>
                ) : (
                  tab.label
                )}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* ── Sign In ── */}
            {mode === "signin" && (
              <motion.form
                key="signin"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
                onSubmit={handlePasswordSubmit}
                className="space-y-3"
              >
                <div className="relative">
                  <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="input-base pl-11"
                  />
                </div>

                <div className="relative">
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="input-base pl-11 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <div className="text-right">
                  <a href="/forgot-password" className="text-sm text-primary hover:underline">
                    Forgot password?
                  </a>
                </div>

                {inlineError && <InlineError message={inlineError} />}

                <button type="submit" disabled={loading} className="w-full btn-primary">
                  {loading ? "Signing in..." : "Sign In"}
                </button>

                <OAuthDivider />
                <GoogleButton loading={googleLoading} onClick={handleGoogleSignIn} />
              </motion.form>
            )}

            {/* ── Sign Up ── */}
            {mode === "signup" && (
              <motion.form
                key="signup"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
                onSubmit={handlePasswordSubmit}
                className="space-y-3"
              >
                <div className="relative">
                  <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Your name (optional)"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    className="input-base pl-11"
                  />
                </div>

                <div className="relative">
                  <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="input-base pl-11"
                  />
                </div>

                <div className="relative">
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password (min 6 characters)"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="input-base pl-11 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <div className="relative">
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="input-base pl-11"
                  />
                </div>

                {inlineError && <InlineError message={inlineError} />}

                <button type="submit" disabled={loading} className="w-full btn-primary">
                  {loading ? "Creating account..." : "Create Account"}
                </button>

                <OAuthDivider />
                <GoogleButton loading={googleLoading} onClick={handleGoogleSignIn} />
              </motion.form>
            )}

            {/* ── Magic Link ── */}
            {mode === "magic" && (
              <motion.div
                key="magic"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-center mb-5">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Zap size={22} className="text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Enter your email and we'll send a one-click sign-in link.<br />
                    No password needed — works for new and existing accounts.
                  </p>
                </div>

                <form onSubmit={handleMagicLink} className="space-y-3">
                  <div className="relative">
                    <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      placeholder="Email address"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoFocus
                      className="input-base pl-11"
                    />
                  </div>

                  {inlineError && <InlineError message={inlineError} />}

                  <button type="submit" disabled={loading} className="w-full btn-primary">
                    {loading ? "Sending..." : "Send Magic Link"}
                  </button>
                </form>

                <OAuthDivider />
                <GoogleButton loading={googleLoading} onClick={handleGoogleSignIn} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

// ── Shared sub-components ────────────────────────────────────────────────────

const InlineError = ({ message }: { message: string }) => (
  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
    <AlertCircle size={16} className="shrink-0 mt-0.5" />
    <span>{message}</span>
  </div>
);

const OAuthDivider = () => (
  <div className="relative my-4">
    <div className="absolute inset-0 flex items-center">
      <div className="w-full border-t border-border" />
    </div>
    <div className="relative flex justify-center text-xs uppercase">
      <span className="bg-card px-2 text-muted-foreground">Or</span>
    </div>
  </div>
);

const GoogleButton = ({ loading, onClick }: { loading: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={loading}
    className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-card border border-border rounded-xl text-foreground font-medium hover:bg-secondary/50 transition-all duration-200 disabled:opacity-60"
  >
    {loading ? (
      <span className="text-sm">Redirecting to Google...</span>
    ) : (
      <>
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </>
    )}
  </button>
);

export default Auth;
