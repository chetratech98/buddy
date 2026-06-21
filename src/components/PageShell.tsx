import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";

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
  backTo = "/",
  backLabel = "Back to home",
  wide = false,
  hideBack = false,
}: PageShellProps) => {
  const navigate = useNavigate();

  return (
    <div className="page-container">
      <Navbar />

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
