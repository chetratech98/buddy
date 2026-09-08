import { ReactNode } from "react";
import Navbar from "@/components/Navbar";

interface PageShellProps {
  children: ReactNode;
  headerActions?: ReactNode;
  wide?: boolean;
}

export const PageShell = ({
  children,
  headerActions,
  wide = false,
}: PageShellProps) => {
  return (
    <div className="page-container">
      <Navbar />

      {/* Content */}
      <main className={wide ? "page-content-wide" : "page-content"}>
        {headerActions && (
          <div className="flex items-center justify-end gap-2 flex-wrap mb-6">
            {headerActions}
          </div>
        )}
        <div className="page-enter">
          {children}
        </div>
      </main>
    </div>
  );
};
