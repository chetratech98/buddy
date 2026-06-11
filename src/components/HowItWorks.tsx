import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Link2, ScanSearch, FileCheck, Leaf, BarChart2 } from "lucide-react";

const steps = [
  {
    icon: Link2,
    title: "Connect Your Website",
    description: "Enter your URL and goals. Buddy analyzes your niche, competitors, and top keywords in under 60 seconds.",
  },
  {
    icon: ScanSearch,
    title: "AI Analyzes Top Results",
    description: "Our AI scans the top 10 Google results per keyword — understanding content gaps, structure, and what makes each post rank.",
  },
  {
    icon: FileCheck,
    title: "Content Generated Daily",
    description: "Every morning, fresh SEO-optimized posts land in your dashboard — complete with headings, citations, and meta tags.",
  },
  {
    icon: Leaf,
    title: "Review & Publish",
    description: "Approve with one click or fine-tune the copy. Publish directly to WordPress, Medium, or schedule for later.",
  },
  {
    icon: BarChart2,
    title: "Track & Improve",
    description: "Monitor rankings, traffic, and post performance from a unified analytics dashboard. Refine your strategy as you grow.",
  },
];

const HowItWorks = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="how-it-works" ref={ref} className="py-20 md:py-28 px-5 sm:px-6 bg-white">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="max-w-xl mb-14 md:mb-16"
        >
          <span className="section-label">Process</span>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground leading-tight">
            From setup to{" "}
            <span style={{ color: "hsl(var(--primary))" }}>ranking</span>{" "}
            in five steps
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
            Connect your site once. Get SEO-optimized content every morning, forever.
          </p>
        </motion.div>

        {/* Desktop: horizontal row */}
        <div className="hidden md:grid md:grid-cols-5 gap-0 relative">
          {/* Connector line */}
          <div
            className="absolute top-[1.75rem] left-[9%] right-[9%] h-px pointer-events-none"
            style={{ background: "hsl(var(--border))" }}
          />

          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.1 + i * 0.1, duration: 0.5 }}
                className="flex flex-col items-center text-center px-3 relative"
              >
                {/* Step circle */}
                <div
                  className="relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                  style={{
                    background: i === 0 ? "hsl(var(--primary))" : "hsl(var(--card))",
                    border: `1.5px solid ${i === 0 ? "hsl(var(--primary))" : "hsl(var(--border))"}`,
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <Icon
                    size={22}
                    style={{ color: i === 0 ? "#fff" : "hsl(var(--primary))" }}
                    strokeWidth={1.6}
                  />
                </div>

                <span
                  className="text-[10px] font-extrabold uppercase tracking-widest mb-2"
                  style={{ color: "hsl(var(--primary) / 0.5)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-[14px] font-bold text-foreground mb-2 leading-snug">
                  {step.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* Mobile: vertical list */}
        <div className="md:hidden space-y-0 relative">
          {/* Vertical line */}
          <div
            className="absolute left-[1.625rem] top-0 bottom-0 w-px"
            style={{ background: "hsl(var(--border))" }}
          />

          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, x: -14 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.08 + i * 0.09, duration: 0.45 }}
                className="flex gap-5 pb-8 last:pb-0 relative"
              >
                {/* Icon */}
                <div
                  className="w-[3.25rem] h-[3.25rem] rounded-xl flex items-center justify-center flex-shrink-0 relative z-10"
                  style={{
                    background: "hsl(var(--primary))",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <Icon size={18} color="#fff" strokeWidth={1.6} />
                </div>

                <div className="flex-1 pt-1.5">
                  <span
                    className="text-[10px] font-extrabold uppercase tracking-widest block mb-1"
                    style={{ color: "hsl(var(--primary) / 0.5)" }}
                  >
                    Step {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-[15px] font-bold text-foreground mb-1.5">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Example post preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="mt-14 max-w-xl mx-auto rounded-xl border border-border bg-white overflow-hidden"
          style={{ boxShadow: "var(--shadow-md)" }}
        >
          {/* Chrome bar */}
          <div className="px-4 py-3 border-b border-border bg-gray-50 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
              <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
              <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
            </div>
            <span className="ml-1 text-xs text-muted-foreground font-medium">Sample Generated Post</span>
          </div>

          <div className="p-5 sm:p-6">
            <h3 className="text-base font-bold text-foreground mb-3">
              10 Best SEO Practices for Small Businesses in 2026
            </h3>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "SEO Score: 96/100", color: "success" },
                { label: "Readability: Excellent", color: "primary" },
                { label: "10 References", color: "warning" },
              ].map(b => (
                <span key={b.label} className={`badge badge-${b.color} text-xs`}>{b.label}</span>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorks;
