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
  hideBack?: boolean;
}

export const PageShell = ({
  children,
  headerActions,
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
        {(!hideBack || headerActions) && (
          <div className="flex items-center justify-between gap-4 mb-6">
            {!hideBack ? (
              <button
                onClick={() => navigate(backTo)}
                className="back-button"
              >
                <ArrowLeft size={14} />
                <span>{backLabel}</span>
              </button>
            ) : <div />}
            {headerActions && (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {headerActions}
              </div>
            )}
          </div>
        )}
        <div className="page-enter">
          {children}
        </div>
      </main>
    </div>
  );
};
