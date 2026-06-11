import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Sparkles, ArrowLeft, LogOut } from "lucide-react";

interface PageShellProps {
  children: ReactNode;
  headerActions?: ReactNode;
  backTo?: string;
  backLabel?: string;
  wide?: boolean;
  showSignOut?: boolean;
  hideBack?: boolean;
}

export const PageShell = ({
  children,
  headerActions,
  backTo = "/",
  backLabel = "Back to home",
  wide = false,
  showSignOut = false,
  hideBack = false,
}: PageShellProps) => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  return (
    <div className="page-container">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-border"
        style={{ boxShadow: "0 1px 0 0 hsl(var(--border))" }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 group-hover:scale-105"
              style={{ background: "var(--gradient-primary)" }}>
              <Sparkles size={13} className="text-white" />
            </div>
            <span className="text-[15px] font-extrabold tracking-tight text-foreground">
              BlitzNova <span style={{ color: "hsl(var(--primary))" }}>AI</span>
            </span>
          </a>

          {/* Right */}
          <div className="flex items-center gap-2">
            {headerActions}
            {showSignOut && (
              <button
                onClick={async () => { await signOut(); navigate("/"); }}
                className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-secondary/80"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className={wide ? "page-content-wide" : "page-content"}>
        {!hideBack && (
          <button
            onClick={() => navigate(backTo)}
            className="back-button"
          >
            <ArrowLeft size={14} />
            <span>{backLabel}</span>
          </button>
        )}
        <div className="page-enter">
          {children}
        </div>
      </main>
    </div>
  );
};
