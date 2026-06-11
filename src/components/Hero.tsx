import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const AvatarStack = () => (
  <div className="flex items-center gap-3 flex-wrap">
    <div className="flex -space-x-2 flex-shrink-0">
      {["#4F46E5","#059669","#F59E0B","#EF4444","#8B5CF6"].map((c, i) => (
        <div
          key={i}
          className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
          style={{ background: c, zIndex: 5 - i }}
        >
          {["JK","AM","SR","TN","LP"][i]}
        </div>
      ))}
    </div>
    <div>
      <div className="text-sm font-semibold text-foreground leading-tight">2,400+ businesses</div>
      <div className="flex items-center gap-1 mt-0.5">
        {[...Array(5)].map((_, i) => (
          <svg key={i} className="w-3 h-3 fill-[#F59E0B] text-[#F59E0B]" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
          </svg>
        ))}
        <span className="text-xs text-muted-foreground ml-0.5">4.9/5</span>
      </div>
    </div>
  </div>
);

const Hero = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <section className="bg-white py-12 sm:py-16 md:py-20">
      <div className="max-w-7xl mx-auto px-5 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 xl:gap-20 items-center">

          {/* LEFT: Copy */}
          <div className="order-1">
            {/* Label */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="section-label"
            >
              AI-Powered SEO Platform
            </motion.p>

            {/* H1 — solid color, no gradient */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.07 }}
              className="text-[2.55rem] sm:text-[3.2rem] md:text-[3.6rem] lg:text-[3.8rem] xl:text-[4.2rem] font-black leading-[1.06] tracking-[-0.03em] text-foreground"
            >
              Rank Higher.{" "}
              <br />
              <span style={{ color: "hsl(var(--primary))" }}>Write Less.</span>
              <br />
              Grow Faster.
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.16 }}
              className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-[480px]"
            >
              Buddy analyzes the{" "}
              <span className="font-semibold text-foreground">top 10 Google results</span>{" "}
              for your keywords and publishes SEO-optimized blog posts to your site — every single day, automatically.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.24 }}
              className="mt-8 flex flex-col sm:flex-row gap-3"
            >
              <button
                onClick={() => navigate(user ? "/get-started" : "/auth")}
                className="btn-primary w-full sm:w-auto px-6 py-3 text-[15px]"
              >
                {user ? "Analyze My Site" : "Start Free Trial"}
                <ArrowRight size={16} />
              </button>
              <button
                onClick={() => navigate(user ? "/dashboard" : "/auth")}
                className="btn-outline w-full sm:w-auto px-6 py-3 text-[15px]"
              >
                {user ? "Go to Dashboard" : "See a Demo"}
              </button>
            </motion.div>

            {/* Trust signals */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.34 }}
              className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2"
            >
              {["No credit card required", "Cancel anytime", "14-day free trial"].map(t => (
                <div key={t} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CheckCircle2 size={13} style={{ color: "hsl(var(--success))" }} />
                  <span>{t}</span>
                </div>
              ))}
            </motion.div>

            {/* Avatar stack */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.44 }}
              className="mt-7 pt-7 border-t border-border"
            >
              <AvatarStack />
            </motion.div>
          </div>

          {/* RIGHT: Product mockup — no floating cards, no extra padding for them */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="order-2 w-full max-w-[520px] mx-auto lg:max-w-none"
          >
            <div
              className="rounded-2xl overflow-hidden border border-slate-200"
              style={{ boxShadow: "var(--shadow-xl)" }}
            >
              {/* Browser chrome */}
              <div
                className="flex items-center gap-3 px-4 py-3 border-b"
                style={{ background: "hsl(222 47% 7%)", borderColor: "rgba(255,255,255,0.06)" }}
              >
                <div className="flex gap-1.5 flex-shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
                </div>
                <div className="flex-1 min-w-0 mx-2">
                  <div
                    className="rounded-md px-3 py-1.5 text-[11px] font-mono truncate"
                    style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)" }}
                  >
                    app.blitznova.ai/dashboard
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-5 space-y-3.5" style={{ background: "hsl(222 47% 9%)" }}>
                {/* Metric row */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "SEO Score",   value: "97", unit: "/100", color: "#10b981" },
                    { label: "Posts Today", value: "3",  unit: " new",  color: "#6366f1" },
                    { label: "Avg. Rank",   value: "#4", unit: ".2",    color: "#f59e0b" },
                  ].map(m => (
                    <div key={m.label} className="rounded-xl p-2.5 sm:p-3"
                      style={{ background: "rgba(255,255,255,0.05)" }}>
                      <div className="text-[9px] sm:text-[10px] mb-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                        {m.label}
                      </div>
                      <div className="text-sm sm:text-[15px] font-bold" style={{ color: m.color }}>
                        {m.value}
                        <span className="text-[9px] sm:text-[10px]" style={{ color: "rgba(255,255,255,0.22)" }}>
                          {m.unit}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Traffic chart */}
                <div className="rounded-xl p-3 sm:p-4" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                      Organic Traffic — 12 weeks
                    </span>
                    <span className="text-[10px] font-semibold" style={{ color: "#10b981" }}>
                      ↑ 32%
                    </span>
                  </div>
                  <div className="flex items-end gap-0.5 sm:gap-1 h-12 sm:h-16">
                    {[28, 40, 33, 55, 44, 68, 58, 82, 66, 90, 74, 100].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t-sm"
                        style={{
                          height: `${h}%`,
                          background: i >= 10 ? "hsl(245 75% 59%)" : "rgba(255,255,255,0.12)",
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Recent posts */}
                <div>
                  <div className="text-[9px] sm:text-[10px] uppercase tracking-widest mb-2"
                    style={{ color: "rgba(255,255,255,0.3)" }}>
                    Recent Posts
                  </div>
                  <div className="space-y-1">
                    {[
                      { title: "10 Best SEO Tools for 2026",         score: 98 },
                      { title: "Complete Content Strategy Guide",     score: 94 },
                      { title: "How to Rank on Page 1 in 30 Days",   score: 91 },
                    ].map(p => (
                      <div
                        key={p.title}
                        className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5"
                        style={{ background: "rgba(255,255,255,0.04)" }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#10b981" }} />
                        <span className="text-[10px] sm:text-[11px] flex-1 truncate min-w-0"
                          style={{ color: "rgba(255,255,255,0.6)" }}>
                          {p.title}
                        </span>
                        <span className="text-[10px] sm:text-[11px] font-bold flex-shrink-0"
                          style={{ color: "#10b981" }}>
                          {p.score}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rank trend indicator */}
                <div className="flex items-center gap-3 rounded-xl px-3.5 py-2.5"
                  style={{ background: "rgba(79,70,229,0.15)", border: "1px solid rgba(79,70,229,0.2)" }}>
                  <TrendingUp size={14} style={{ color: "hsl(245 75% 70%)", flexShrink: 0 }} />
                  <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.55)" }}>
                    Average ranking improved by{" "}
                    <span style={{ color: "hsl(245 75% 75%)", fontWeight: 600 }}>14 positions</span>{" "}
                    this week
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.5 }}
          className="mt-14 sm:mt-20 pt-10 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-10"
        >
          {[
            { value: "50,000+", label: "Blog posts generated" },
            { value: "2,400+",  label: "Businesses growing" },
            { value: "3.2×",    label: "Average traffic increase" },
            { value: "4.9★",    label: "User rating" },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 + i * 0.07 }}
            >
              <div className="text-2xl sm:text-3xl font-black text-foreground tracking-tight leading-none">
                {s.value}
              </div>
              <div className="text-sm text-muted-foreground mt-1.5">{s.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
