import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Sparkles, ChevronDown, Building2, Plus, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const navLinks = [
  { label: "Features",     href: "#features",      isRoute: false, authOnly: false },
  { label: "How It Works", href: "#how-it-works",  isRoute: false, authOnly: false },
  { label: "Pricing",      href: "#pricing",        isRoute: false, authOnly: false },
  { label: "Dashboard",    href: "/dashboard",      isRoute: true,  authOnly: true  },
  { label: "Billing",      href: "/billing",        isRoute: true,  authOnly: true  },
  { label: "Analyze Site", href: "/get-started",    isRoute: true,  authOnly: true  },
  { label: "SERP Analysis",href: "/seo-analysis",   isRoute: true,  authOnly: true  },
  { label: "Content Plan", href: "/content-plan",   isRoute: true,  authOnly: true  },
  { label: "Today's Blog", href: "/todays-blog",    isRoute: true,  authOnly: true  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Org Switcher Dropdown
// ─────────────────────────────────────────────────────────────────────────────
const OrgSwitcher = () => {
  const { currentOrg, organizations, switchOrg, createOrg } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  if (!currentOrg && organizations.length === 0) {
    return (
      <button
        onClick={() => navigate("/settings/organization")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-secondary/50"
      >
        <Building2 size={15} />
        <span>Personal</span>
      </button>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createOrg(newName.trim());
      setNewName("");
      setOpen(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
      >
        <Building2 size={14} className="text-primary" />
        <span className="max-w-[140px] truncate">{currentOrg?.name ?? "Select Org"}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-64 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden"
            >
              {/* Existing orgs */}
              {organizations.length > 0 && (
                <div className="p-2 border-b border-border">
                  <p className="text-xs font-medium text-muted-foreground px-2 py-1 uppercase tracking-wide">
                    Organizations
                  </p>
                  {organizations.map(org => (
                    <button
                      key={org.id}
                      onClick={() => { switchOrg(org.id); setOpen(false); }}
                      className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors ${
                        currentOrg?.id === org.id
                          ? "bg-primary/10 text-primary font-medium"
                          : "hover:bg-secondary/50 text-foreground"
                      }`}
                    >
                      <Building2 size={14} />
                      <span className="truncate flex-1 text-left">{org.name}</span>
                      <span className="text-xs text-muted-foreground capitalize shrink-0">{org.userRole}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Create org form */}
              <div className="p-2 border-b border-border">
                {creating ? (
                  <form onSubmit={handleCreate} className="flex gap-1">
                    <input
                      autoFocus
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      placeholder="Org name"
                      className="flex-1 text-sm px-2 py-1.5 rounded-lg border border-border bg-background outline-none focus:border-primary"
                    />
                    <button type="submit" className="text-xs px-2 py-1.5 bg-primary text-primary-foreground rounded-lg">
                      Create
                    </button>
                    <button type="button" onClick={() => setCreating(false)} className="text-xs px-2 py-1.5 rounded-lg hover:bg-secondary">
                      ✕
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => setCreating(true)}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <Plus size={14} />
                    New Organization
                  </button>
                )}
              </div>

              {/* Settings link */}
              <div className="p-2">
                <button
                  onClick={() => { navigate("/settings/organization"); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground"
                >
                  <Settings size={14} />
                  Organization Settings
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Navbar
// ─────────────────────────────────────────────────────────────────────────────
const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const filteredLinks = navLinks.filter(link => !link.authOnly || user);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="sticky top-0 z-50 bg-background/70 backdrop-blur-2xl border-b border-border/40 shadow-sm"
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-3 group">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
            <div className="absolute inset-0 rounded-xl bg-primary/30 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
            <Sparkles size={20} className="text-white relative z-10" />
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            BlitzNova <span className="text-primary">AI</span>
          </span>
        </a>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-8">
          {filteredLinks.map(link =>
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

        {/* Desktop right section */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <OrgSwitcher />
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
              {filteredLinks.map(link =>
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
              <div className="pt-2 border-t border-border flex flex-col gap-3">
                {user ? (
                  <>
                    <button
                      onClick={() => { navigate("/settings/organization"); setMobileOpen(false); }}
                      className="text-muted-foreground hover:text-foreground transition-colors font-medium text-left flex items-center gap-2"
                    >
                      <Building2 size={16} /> Organization
                    </button>
                    <button
                      onClick={() => { navigate("/profile"); setMobileOpen(false); }}
                      className="text-muted-foreground hover:text-foreground transition-colors font-medium text-left"
                    >
                      Profile
                    </button>
                    <button
                      onClick={() => { signOut(); setMobileOpen(false); }}
                      className="text-muted-foreground hover:text-foreground transition-colors font-medium text-left"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { navigate("/auth"); setMobileOpen(false); }}
                      className="text-muted-foreground hover:text-foreground transition-colors font-medium text-left"
                    >
                      Sign In
                    </button>
                    <button
                      onClick={() => { navigate("/auth"); setMobileOpen(false); }}
                      className="bg-primary text-primary-foreground font-semibold text-sm py-2.5 rounded-xl text-center"
                    >
                      Get Started
                    </button>
                  </>
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
