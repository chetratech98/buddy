import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Sparkles, ChevronDown, Building2, Plus, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const navLinks = [
  { label: "Features",     href: "#features",     isRoute: false, authOnly: false },
  { label: "How It Works", href: "#how-it-works",  isRoute: false, authOnly: false },
  { label: "Pricing",      href: "#pricing",       isRoute: false, authOnly: false },
  { label: "Dashboard",    href: "/dashboard",     isRoute: true,  authOnly: true  },
  { label: "Billing",      href: "/billing",       isRoute: true,  authOnly: true  },
  { label: "Analyze Site", href: "/get-started",   isRoute: true,  authOnly: true  },
  { label: "SERP Analysis",href: "/seo-analysis",  isRoute: true,  authOnly: true  },
  { label: "Content Plan", href: "/content-plan",  isRoute: true,  authOnly: true  },
  { label: "Today's Blog", href: "/todays-blog",   isRoute: true,  authOnly: true  },
];

/* ── Org Switcher ── */
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
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-lg hover:bg-secondary/60"
      >
        <Building2 size={14} />
        <span>Personal</span>
      </button>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try { await createOrg(newName.trim()); setNewName(""); setOpen(false); }
    finally { setCreating(false); }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-secondary/60 transition-colors"
      >
        <Building2 size={13} className="text-primary" />
        <span className="max-w-[130px] truncate">{currentOrg?.name ?? "Select Org"}</span>
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
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
              className="absolute right-0 top-full mt-2 w-60 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden"
            >
              {organizations.length > 0 && (
                <div className="p-2 border-b border-border">
                  <p className="text-[10px] font-bold text-muted-foreground px-2 py-1 uppercase tracking-wider">Organizations</p>
                  {organizations.map(org => (
                    <button
                      key={org.id}
                      onClick={() => { switchOrg(org.id); setOpen(false); }}
                      className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors ${
                        currentOrg?.id === org.id
                          ? "bg-primary/10 text-primary font-semibold"
                          : "hover:bg-secondary/60 text-foreground"
                      }`}
                    >
                      <Building2 size={13} />
                      <span className="truncate flex-1 text-left">{org.name}</span>
                      <span className="text-[10px] text-muted-foreground capitalize shrink-0">{org.userRole}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="p-2 border-b border-border">
                {creating ? (
                  <form onSubmit={handleCreate} className="flex gap-1">
                    <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                      placeholder="Org name"
                      className="flex-1 text-sm px-2 py-1.5 rounded-lg border border-border bg-background outline-none focus:border-primary" />
                    <button type="submit" className="text-xs px-2 py-1.5 bg-primary text-white rounded-lg">Create</button>
                    <button type="button" onClick={() => setCreating(false)} className="text-xs px-2 py-1.5 rounded-lg hover:bg-secondary">✕</button>
                  </form>
                ) : (
                  <button onClick={() => setCreating(true)} className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground">
                    <Plus size={13} /> New Organization
                  </button>
                )}
              </div>
              <div className="p-2">
                <button onClick={() => { navigate("/settings/organization"); setOpen(false); }} className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground">
                  <Settings size={13} /> Organization Settings
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── Main Navbar ── */
const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const filteredLinks = navLinks.filter(l => !l.authOnly || user);

  return (
    <>
      <motion.nav
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/95 backdrop-blur-xl border-b border-border shadow-sm"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between">

          {/* Logo */}
          <a href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "hsl(var(--primary))" }}>
              <Sparkles size={14} className="text-white" />
            </div>
            <span className="text-[17px] font-extrabold tracking-tight text-foreground">
              BlitzNova <span style={{ color: "hsl(var(--primary))" }}>AI</span>
            </span>
          </a>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-0.5">
            {filteredLinks.map(link =>
              link.isRoute ? (
                <button key={link.label} onClick={() => navigate(link.href)}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/80 px-3.5 py-2 rounded-lg transition-all duration-150">
                  {link.label}
                </button>
              ) : (
                <a key={link.label} href={link.href}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/80 px-3.5 py-2 rounded-lg transition-all duration-150">
                  {link.label}
                </a>
              )
            )}
          </div>

          {/* Desktop right */}
          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <>
                <OrgSwitcher />
                <button onClick={() => navigate("/profile")}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground px-3.5 py-2 rounded-lg hover:bg-secondary/80 transition-all duration-150">
                  Profile
                </button>
                <button onClick={() => signOut()}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground px-3.5 py-2 rounded-lg hover:bg-secondary/80 transition-all duration-150">
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <button onClick={() => navigate("/auth")}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground px-4 py-2 rounded-lg hover:bg-secondary/80 transition-all duration-150">
                  Sign In
                </button>
                <button onClick={() => navigate("/auth")}
                  className="btn-primary text-sm px-5 py-2.5 rounded-xl">
                  Get Started
                </button>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-secondary/80 transition-colors text-foreground"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </motion.nav>

      {/* Spacer so content isn't hidden behind fixed nav */}
      <div className="h-16" />

      {/* Mobile drawer overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-foreground/30 backdrop-blur-sm z-[60]"
              onClick={() => setMobileOpen(false)}
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 w-[80vw] max-w-[320px] bg-card border-l border-border z-[70] flex flex-col shadow-2xl"
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "hsl(var(--primary))" }}>
                    <Sparkles size={13} className="text-white" />
                  </div>
                  <span className="font-extrabold text-[15px] tracking-tight">BlitzNova AI</span>
                </div>
                <button onClick={() => setMobileOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-secondary transition-colors" aria-label="Close menu">
                  <X size={20} />
                </button>
              </div>

              {/* Drawer links */}
              <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-0.5">
                {filteredLinks.map((link, i) => (
                  <motion.div
                    key={link.label}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.25 }}
                  >
                    {link.isRoute ? (
                      <button onClick={() => { navigate(link.href); setMobileOpen(false); }}
                        className="w-full text-left text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/80 px-4 py-3 rounded-xl transition-all duration-150">
                        {link.label}
                      </button>
                    ) : (
                      <a href={link.href} onClick={() => setMobileOpen(false)}
                        className="block text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/80 px-4 py-3 rounded-xl transition-all duration-150">
                        {link.label}
                      </a>
                    )}
                  </motion.div>
                ))}
              </nav>

              {/* Drawer footer actions */}
              <div className="px-4 py-5 border-t border-border flex flex-col gap-2.5">
                {user ? (
                  <>
                    <button onClick={() => { navigate("/profile"); setMobileOpen(false); }}
                      className="w-full text-sm font-medium text-muted-foreground hover:text-foreground text-left px-4 py-3 rounded-xl hover:bg-secondary/80 transition-all">
                      Profile
                    </button>
                    <button onClick={() => { signOut(); setMobileOpen(false); }}
                      className="w-full text-sm font-semibold text-destructive hover:bg-destructive/8 text-left px-4 py-3 rounded-xl transition-all">
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { navigate("/auth"); setMobileOpen(false); }}
                      className="w-full btn-outline text-sm py-3 rounded-xl">
                      Sign In
                    </button>
                    <button onClick={() => { navigate("/auth"); setMobileOpen(false); }}
                      className="w-full btn-primary text-sm py-3 rounded-xl">
                      Get Started Free
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
