import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  Bot, Clock, TrendingUp, FileText, Link, Crosshair,
  CalendarDays, Send, BarChart2, ShieldCheck,
} from "lucide-react";

const features = [
  { icon: Bot,          title: "AI-Powered Research",       description: "Analyzes the top 10 Google results for each keyword and builds content that outranks what's already there." },
  { icon: Clock,        title: "Daily Automation",          description: "Set keywords once. Wake up to a fresh, publish-ready blog post every morning — no prompting required." },
  { icon: TrendingUp,   title: "SEO Optimized",             description: "Every post ships with the right keyword density, semantic headings, meta tags, and internal link suggestions." },
  { icon: Crosshair,    title: "Competitor SERP Analysis",  description: "Uncover the content gaps and scoring benchmarks of the pages ranking above you, then beat them." },
  { icon: CalendarDays, title: "Content Calendar",          description: "Plan and visualize your full publishing pipeline. Drag posts across dates to maintain a consistent cadence." },
  { icon: Send,         title: "One-Click Publishing",      description: "Push directly to WordPress and Medium without copy-pasting. Every channel updated, every time." },
  { icon: BarChart2,    title: "Analytics Dashboard",       description: "Track rankings, traffic, and publishing trends from a single unified view." },
  { icon: FileText,     title: "30-Day Content Plans",      description: "Generate a complete month of strategic topics, long-tail keywords, and schedules tailored to your niche." },
  { icon: Link,         title: "Smart References",          description: "Automatic citations to authoritative sources that boost your E-E-A-T signals — the ones Google rewards." },
  { icon: ShieldCheck,  title: "Brand Voice Control",       description: "Choose Professional, Casual, Technical, or Friendly. Every article reflects how you actually want to sound." },
];

const Features = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section
      id="features"
      ref={ref}
      className="py-20 md:py-28 px-5 sm:px-6"
      style={{ background: "hsl(var(--surface))" }}
    >
      <div className="max-w-7xl mx-auto">

        {/* Header — left-aligned on desktop */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="max-w-2xl mb-12 md:mb-14"
        >
          <span className="section-label">Features</span>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground leading-tight">
            Everything you need to dominate{" "}
            <span style={{ color: "hsl(var(--primary))" }}>search rankings</span>
          </h2>
          <p className="mt-4 text-muted-foreground text-base sm:text-lg leading-relaxed">
            From keyword research to daily publishing — the entire SEO content workflow, automated.
          </p>
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 1 } : {}}
                transition={{ delay: 0.05 + i * 0.05, duration: 0.4 }}
                className="bg-white p-6 sm:p-7 flex flex-col"
              >
                {/* Icon */}
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center mb-4 flex-shrink-0"
                  style={{
                    background: "hsl(var(--primary) / 0.07)",
                    color: "hsl(var(--primary))",
                  }}
                >
                  <Icon size={17} />
                </div>

                <h3 className="text-[15px] font-bold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;
