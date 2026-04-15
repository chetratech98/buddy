import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const Hero = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <section className="hero-bg-gradient relative overflow-hidden min-h-[90vh] flex items-center">
      {/* Enhanced ambient glow - multiple layers */}
      <div className="absolute top-0 right-[10%] w-[700px] h-[700px] bg-primary/8 rounded-full blur-[180px] pointer-events-none animate-pulse-slow" />
      <div className="absolute bottom-0 left-[8%] w-[500px] h-[500px] bg-accent/10 rounded-full blur-[150px] pointer-events-none animate-pulse-slow" style={{ animationDelay: "2s" }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-glow/5 rounded-full blur-[200px] pointer-events-none" />
      
      {/* Floating orbs */}
      <div className="absolute top-20 left-[15%] w-3 h-3 bg-primary rounded-full blur-sm opacity-40 float" />
      <div className="absolute top-40 right-[20%] w-2 h-2 bg-accent rounded-full blur-sm opacity-30 float" style={{ animationDelay: "1s" }} />
      <div className="absolute bottom-32 left-[25%] w-4 h-4 bg-primary-glow rounded-full blur-sm opacity-25 float" style={{ animationDelay: "3s" }} />

      <div className="max-w-7xl mx-auto px-6 py-20 relative z-10">
        {/* Enhanced Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-12 flex justify-center lg:justify-start"
        >
          <span className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-gradient-to-r from-primary/10 via-primary/15 to-accent/10 text-primary text-sm font-semibold border border-primary/20 shadow-lg backdrop-blur-sm">
            <Sparkles size={16} className="animate-pulse" />
            AI-Powered SEO Content Platform
            <span className="ml-1 px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded-full">NEW</span>
          </span>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: Text */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
          >
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.1] text-foreground">
              Rank Higher.{" "}
              <br className="hidden sm:block" />
              <span className="animated-gradient bg-clip-text text-transparent">Write Less.</span>{" "}
              <br className="hidden sm:block" />
              <span className="relative">
                Grow Faster.
                <svg className="absolute -bottom-2 left-0 w-full" height="12" viewBox="0 0 300 12" fill="none">
                  <path d="M2 10C50 5, 100 2, 150 3C200 4, 250 7, 298 10" stroke="url(#paint0_linear)" strokeWidth="3" strokeLinecap="round"/>
                  <defs>
                    <linearGradient id="paint0_linear" x1="0" y1="0" x2="300" y2="0" gradientUnits="userSpaceOnUse">
                      <stop stopColor="hsl(var(--primary))" />
                      <stop offset="0.5" stopColor="hsl(var(--accent-foreground))" />
                      <stop offset="1" stopColor="hsl(var(--primary))" />
                    </linearGradient>
                  </defs>
                </svg>
              </span>
            </h1>
            <p className="mt-8 text-xl text-muted-foreground max-w-lg leading-relaxed">
              Buddy analyzes the <span className="font-semibold text-foreground">top 10 Google results</span> for your keywords and publishes SEO-optimized blog posts to your site — every single day, on autopilot.
            </p>

            {/* Enhanced CTAs */}
            <div className="mt-12 flex flex-col sm:flex-row items-start gap-4">
              <button
                onClick={() => navigate(user ? "/get-started" : "/auth")}
                className="group hero-btn-primary flex items-center gap-2.5 text-base font-bold shadow-2xl"
              >
                {user ? "Analyze My Site" : "Start Free Trial"}
                <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
              </button>
              <button 
                onClick={() => navigate(user ? "/dashboard" : "/auth")}
                className="hero-btn-secondary text-base font-semibold"
              >
                {user ? "Go to Dashboard" : "Sign In"}
              </button>
            </div>

            {/* Trust badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-10 flex items-center gap-6 text-sm text-muted-foreground"
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-success" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
                <span className="font-medium">No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-success" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
                <span className="font-medium">Cancel anytime</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Right: Analytics Dashboard */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="relative rounded-2xl overflow-hidden border border-border/50 shadow-2xl bg-[hsl(222,47%,11%)]">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-3 bg-[hsl(222,47%,9%)] border-b border-white/5">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-destructive/60" />
                  <div className="w-3 h-3 rounded-full bg-[hsl(var(--warning))]/60" />
                  <div className="w-3 h-3 rounded-full bg-[hsl(var(--success))]/60" />
                </div>
                <div className="flex-1 text-center">
                  <span className="text-xs text-white/30 font-mono">analytics-dashboard</span>
                </div>
              </div>
              {/* Dashboard content */}
              <div className="p-5">
                <div className="text-xs text-white/40 uppercase tracking-wider mb-4 font-semibold">
                  Users: Last 7 Days Using Median ▾
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-white/5 rounded-xl p-3">
                    <div className="text-xs text-white/40 mb-2">Load Time vs Bounce Rate</div>
                    <div className="flex items-end gap-1 h-20">
                      {[40, 65, 50, 80, 35, 70, 55, 90, 45, 60, 75, 85].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-t transition-all duration-500"
                          style={{
                            height: `${h}%`,
                            background: i % 3 === 0
                              ? 'hsl(170, 60%, 50%)'
                              : 'hsl(243, 75%, 60%)',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3">
                    <div className="text-xs text-white/40 mb-2">Start Render vs Bounce Rate</div>
                    <div className="h-20 flex items-center justify-center">
                      <svg viewBox="0 0 120 40" className="w-full h-full">
                        <polyline
                          points="0,35 15,28 30,30 45,20 60,15 75,18 90,10 105,12 120,8"
                          fill="none"
                          stroke="hsl(340, 65%, 55%)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <polyline
                          points="0,30 15,32 30,25 45,28 60,22 75,20 90,25 105,18 120,15"
                          fill="none"
                          stroke="hsl(243, 75%, 65%)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Page Load", value: "0.7s", positive: true },
                    { label: "Page Views", value: "2.7M", positive: true },
                    { label: "Bounce Rate", value: "40.6%", positive: false },
                    { label: "Sessions", value: "479K", positive: true },
                  ].map((m) => (
                    <div key={m.label} className="bg-white/5 rounded-xl p-2.5 text-center">
                      <div className="text-xs text-white/40">{m.label}</div>
                      <div className={`text-sm font-bold ${m.positive ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--chart-3))]'}`}>{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating card: Daily Post Status */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="absolute -top-4 -right-4 float-card bg-background z-10 shadow-lg"
            >
              <div className="text-xs text-muted-foreground font-medium">Daily Post Status</div>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-2 h-2 rounded-full bg-[hsl(var(--success))] animate-pulse" />
                <span className="text-sm font-semibold text-foreground">Generated at 6:00 AM</span>
              </div>
            </motion.div>

            {/* Floating card: SEO Score */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.5 }}
              className="absolute -bottom-6 left-4 float-card bg-background z-10 shadow-lg"
            >
              <div className="text-xs text-muted-foreground font-medium">SEO Score</div>
              <div className="text-2xl font-bold text-primary mt-1">97/100</div>
            </motion.div>
          </motion.div>
        </div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="mt-24 pt-10 border-t border-border/60 flex flex-wrap gap-16"
        >
          {[
            { value: "50K+", label: "Posts Generated" },
            { value: "2,400+", label: "Active Users" },
            { value: "97%", label: "Avg SEO Score" },
            { value: "4.9★", label: "User Rating" },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl font-bold text-gradient">{stat.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
