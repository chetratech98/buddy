import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Link2, ScanSearch, FileCheck, Leaf, BarChart2 } from "lucide-react";

const steps = [
  {
    icon: Link2,
    title: "Connect Your Website",
    description: "Enter your URL and goals. Buddy analyzes your niche, competitors, and top-performing keywords in under 60 seconds.",
  },
  {
    icon: ScanSearch,
    title: "AI Analyzes Top Results",
    description: "Our AI scans the top 10 Google results per keyword — understanding content gaps, structure, and what makes each post rank.",
  },
  {
    icon: FileCheck,
    title: "Content Generated Daily",
    description: "Every morning, fresh SEO-optimized blog posts land in your dashboard — complete with headings, citations, and meta tags.",
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
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="how-it-works" ref={ref} className="py-28 px-4 bg-background">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-20"
        >
          <span className="section-label">PROCESS</span>
          <h2 className="text-3xl md:text-5xl font-bold mt-4">How It Works</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Four simple steps to automated content creation
          </p>
        </motion.div>

        {/* Steps with connecting line */}
        <div className="relative">
          <div className="hidden md:block absolute top-16 left-[8%] right-[8%] h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

          <div className="grid grid-cols-1 md:grid-cols-5 gap-10 md:gap-4">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 30 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.2 + i * 0.12, duration: 0.5 }}
                className="flex flex-col items-center text-center"
              >
                <div className="w-20 h-20 rounded-2xl bg-primary/8 border border-primary/15 flex items-center justify-center mb-5 relative z-10 transition-colors hover:bg-primary/12">
                  <step.icon size={30} className="text-primary" strokeWidth={1.5} />
                </div>

                <span className="text-xs font-bold text-primary/60 mb-2 tracking-wider">
                  STEP {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-lg font-bold mb-3">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px]">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Example Generated Post Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="mt-20 max-w-3xl mx-auto card-elevated p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-destructive/50" />
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--warning))]/50" />
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--success))]/50" />
            <span className="ml-2 text-sm text-muted-foreground">Example Generated Post</span>
          </div>

          <h3 className="text-xl font-bold mb-3">
            10 Best SEO Practices for Small Businesses in 2026
          </h3>

          <div className="flex flex-wrap gap-3">
            <span className="text-xs font-medium px-3 py-1.5 rounded-full border border-primary/20 text-primary bg-primary/5">
              SEO Score: 96/100
            </span>
            <span className="text-xs font-medium px-3 py-1.5 rounded-full border border-[hsl(var(--success))]/20 text-[hsl(var(--success))] bg-[hsl(var(--success))]/5">
              Readability: Excellent
            </span>
            <span className="text-xs font-medium px-3 py-1.5 rounded-full border border-[hsl(var(--chart-4))]/20 text-[hsl(var(--chart-4))] bg-[hsl(var(--chart-4))]/5">
              10 References
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HowItWorks;
