import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const proofPoints = [
  { value: "97%",    label: "Average SEO score",    note: "across all generated posts" },
  { value: "8 hrs",  label: "Saved per week",       note: "per user on average" },
  { value: "3.2×",   label: "Traffic increase",     note: "median within 90 days" },
  { value: "44 hrs", label: "Saved per client/mo",  note: "for agency users" },
];

/* Per-item responsive border: 2-col mobile → 4-col desktop */
const borderClass = (i: number) => {
  if (i === 0) return "border-r border-b border-border md:border-b-0";
  if (i === 1) return "border-b border-border md:border-b-0 md:border-r";
  if (i === 2) return "border-r border-border";
  return "";
};

const Stats = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section ref={ref} className="px-5 sm:px-6 py-10 sm:py-12">
      <div className="max-w-7xl mx-auto">
        <div className="rounded-2xl overflow-hidden border border-border">
          <div className="grid grid-cols-2 md:grid-cols-4">
            {proofPoints.map((p, i) => (
              <motion.div
                key={p.label}
                initial={{ opacity: 0, y: 14 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.09, duration: 0.45 }}
                className={`flex flex-col items-center text-center px-5 py-8 sm:px-8 sm:py-10 ${borderClass(i)}`}
              >
                <span
                  className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-none"
                  style={{ color: "hsl(var(--primary))" }}
                >
                  {p.value}
                </span>
                <span className="mt-3 text-sm font-semibold text-foreground">{p.label}</span>
                <span className="mt-1 text-xs text-muted-foreground">{p.note}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Stats;
