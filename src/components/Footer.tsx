import { ArrowRight, Sparkles, Twitter, Linkedin, Github } from "lucide-react";
import { useNavigate } from "react-router-dom";

const footerLinks = {
  Product: [
    { label: "Features",     href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Pricing",      href: "#pricing" },
    { label: "Changelog",    href: "#" },
  ],
  Resources: [
    { label: "Documentation", href: "#" },
    { label: "Blog",          href: "#" },
    { label: "Case Studies",  href: "#" },
    { label: "API Reference", href: "#" },
  ],
  Company: [
    { label: "About",     href: "#" },
    { label: "Careers",   href: "#" },
    { label: "Contact",   href: "#" },
    { label: "Press Kit", href: "#" },
  ],
  Legal: [
    { label: "Privacy Policy",   href: "#" },
    { label: "Terms of Service", href: "#" },
    { label: "Cookie Policy",    href: "#" },
    { label: "GDPR",             href: "#" },
  ],
};

const Footer = () => {
  const navigate = useNavigate();

  return (
    <footer>
      {/* ── CTA Banner ── */}
      <div
        className="py-20 px-5 sm:px-6 border-t border-white/[0.06]"
        style={{ background: "hsl(222 47% 5%)" }}
      >
        <div className="max-w-3xl mx-auto text-center">
          <p
            className="text-[11px] font-bold uppercase tracking-[0.12em] mb-5"
            style={{ color: "hsl(245 75% 70%)" }}
          >
            Start Today
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Ready to grow your traffic{" "}
            <span style={{ color: "hsl(245 75% 70%)" }}>on autopilot?</span>
          </h2>
          <p className="mt-4 text-base sm:text-lg" style={{ color: "rgba(255,255,255,0.5)" }}>
            Join thousands of businesses using BlitzNova AI to dominate search results.
          </p>
          <button
            onClick={() => navigate("/auth")}
            className="mt-8 btn-primary px-7 py-3.5 text-[15px]"
          >
            Get Started for Free
            <ArrowRight size={17} />
          </button>
          <p className="mt-4 text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
            No credit card required · 14-day free trial
          </p>
        </div>
      </div>

      {/* ── Footer links ── */}
      <div className="bg-white border-t border-border">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-14">

          {/* Top row */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 sm:gap-10 mb-10">
            {/* Brand */}
            <div className="col-span-2 md:col-span-3 lg:col-span-1">
              <a href="/" className="flex items-center gap-2.5 mb-4">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "hsl(var(--primary))" }}
                >
                  <Sparkles size={14} className="text-white" />
                </div>
                <span className="text-[16px] font-extrabold tracking-tight text-foreground">
                  BlitzNova <span style={{ color: "hsl(var(--primary))" }}>AI</span>
                </span>
              </a>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-[220px]">
                AI-powered SEO content that ranks — published to your site every day.
              </p>
              <div className="flex items-center gap-2 mt-5">
                {[Twitter, Linkedin, Github].map((Icon, i) => (
                  <a
                    key={i}
                    href="#"
                    className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all duration-150"
                  >
                    <Icon size={13} />
                  </a>
                ))}
              </div>
            </div>

            {/* Link columns */}
            {Object.entries(footerLinks).map(([category, links]) => (
              <div key={category}>
                <h4 className="text-[11px] font-bold uppercase tracking-widest text-foreground mb-4">
                  {category}
                </h4>
                <ul className="space-y-2.5">
                  {links.map(link => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              © 2026 BlitzNova AI. All rights reserved.
            </p>
            <div className="flex items-center gap-5">
              {["Privacy", "Terms", "Cookies"].map(l => (
                <a key={l} href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {l}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
