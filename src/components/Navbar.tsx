import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const navLinks = [
  { label: "Features", href: "#features", isRoute: false, authOnly: false },
  { label: "How It Works", href: "#how-it-works", isRoute: false, authOnly: false },
  { label: "Pricing", href: "#pricing", isRoute: false, authOnly: false },
  { label: "Dashboard", href: "/dashboard", isRoute: true, authOnly: true },
  { label: "Billing", href: "/billing", isRoute: true, authOnly: true },
  { label: "Analyze My Site", href: "/get-started", isRoute: true, authOnly: true },
  { label: "SERP Analysis", href: "/seo-analysis", isRoute: true, authOnly: true },
  { label: "Content Plan", href: "/content-plan", isRoute: true, authOnly: true },
  { label: "Today's Blog", href: "/todays-blog", isRoute: true, authOnly: true },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Filter links based on authentication status
  const filteredLinks = navLinks.filter(link => !link.authOnly || user);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="sticky top-0 z-50 bg-background/70 backdrop-blur-2xl border-b border-border/40 shadow-sm"
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Enhanced Logo */}
        <a href="/" className="flex items-center gap-3 group">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
            <div className="absolute inset-0 rounded-xl bg-primary/30 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
            <Sparkles size={20} className="text-white relative z-10" />
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            BlitzNova <span className="text-primary">AI</span>
          </span>
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {filteredLinks.map((link) =>
            link.isRoute ? (
              <button
                key={link.label}
                onClick={() => navigate(link.href)}
                className="relative text-sm text-muted-foreground hover:text-foreground transition-colors font-medium group"
              >
                {link.label}
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-accent group-hover:w-full transition-all duration-300" />
              </button>
            ) : (
              <a
                key={link.label}
                href={link.href}
                className="relative text-sm text-muted-foreground hover:text-foreground transition-colors font-medium group"
              >
                {link.label}
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-accent group-hover:w-full transition-all duration-300" />
              </a>
            )
          )}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <>
              <button
                onClick={() => navigate("/profile")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                Profile
              </button>
              <button
                onClick={() => signOut()}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate("/auth")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium px-4 py-2"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate("/auth")}
                className="relative bg-gradient-to-r from-primary to-accent text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-primary/30 hover:scale-105 overflow-hidden group"
              >
                <span className="relative z-10">Get Started</span>
                <div className="absolute inset-0 bg-gradient-to-r from-accent to-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-foreground p-1"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden border-t border-border bg-background overflow-hidden"
          >
            <div className="p-6 flex flex-col gap-4">
              {filteredLinks.map((link) =>
                link.isRoute ? (
                  <button
                    key={link.label}
                    onClick={() => { navigate(link.href); setMobileOpen(false); }}
                    className="text-muted-foreground hover:text-foreground transition-colors font-medium text-left"
                  >
                    {link.label}
                  </button>
                ) : (
                  <a
                    key={link.label}
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground transition-colors font-medium"
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </a>
                )
              )}
              <div className="pt-2 border-t border-border">
                {user ? (
                  <button
                    onClick={() => { signOut(); setMobileOpen(false); }}
                    className="text-muted-foreground hover:text-foreground transition-colors font-medium text-left"
                  >
                    Sign Out
                  </button>
                ) : (
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => { navigate("/seo-analysis"); setMobileOpen(false); }}
                      className="text-muted-foreground hover:text-foreground transition-colors font-medium text-left"
                    >
                      Try Demo
                    </button>
                    <button
                      onClick={() => { navigate("/get-started"); setMobileOpen(false); }}
                      className="bg-primary text-primary-foreground font-semibold text-sm py-2.5 rounded-xl text-center"
                    >
                      Get Started
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;
