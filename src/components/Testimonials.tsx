import { motion, useInView, AnimatePresence } from "framer-motion";
import { useRef, useState } from "react";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";

const testimonials = [
  {
    quote: "Our domain rating went from 13 to 36 in four months and organic traffic doubled. BlitzNova is the best ROI we've ever made on a marketing tool.",
    name: "Lorenzo Nicolini",
    role: "Founder, Moonb",
    result: "DR 13 → 36 in 4 months",
    initials: "LN",
    color: "#4F46E5",
  },
  {
    quote: "The biggest shift: our brand started appearing in AI-generated answers on Google and ChatGPT. That's brand authority we couldn't have bought.",
    name: "Aidan Cramer",
    role: "Co-Founder, AIApply",
    result: "5× more AI answer mentions",
    initials: "AC",
    color: "#059669",
  },
  {
    quote: "We cut SEO deliverable time from 40–50 hours per month down to under 6. That's nearly an entire team member's workload, automated.",
    name: "Olaf van Gastel",
    role: "Founder, Bright Brands",
    result: "44 hrs/month saved per client",
    initials: "OG",
    color: "#D97706",
  },
];

const Stars = () => (
  <div className="flex gap-0.5">
    {[...Array(5)].map((_, i) => (
      <Star key={i} size={13} className="fill-[#F59E0B] text-[#F59E0B]" />
    ))}
  </div>
);

const TestimonialCard = ({ t, delay = 0, inView }: { t: typeof testimonials[0]; delay?: number; inView: boolean }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={inView ? { opacity: 1, y: 0 } : {}}
    transition={{ delay, duration: 0.5 }}
    className="flex flex-col h-full bg-white rounded-2xl border border-border p-7 sm:p-8"
    style={{ boxShadow: "var(--shadow-card)" }}
  >
    <Stars />

    {/* Quote */}
    <blockquote className="mt-5 text-[15px] text-foreground leading-relaxed flex-1 font-medium">
      "{t.quote}"
    </blockquote>

    {/* Result callout */}
    <div className="mt-5 text-xs font-bold uppercase tracking-widest"
      style={{ color: "hsl(var(--primary))" }}>
      {t.result}
    </div>

    {/* Author */}
    <div className="flex items-center gap-3 mt-5 pt-5 border-t border-border">
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
        style={{ background: t.color }}
      >
        {t.initials}
      </div>
      <div>
        <div className="text-sm font-semibold text-foreground">{t.name}</div>
        <div className="text-xs text-muted-foreground">{t.role}</div>
      </div>
    </div>
  </motion.div>
);

const Testimonials = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [active, setActive] = useState(0);

  return (
    <section
      ref={ref}
      className="py-20 md:py-28 px-5 sm:px-6"
      style={{ background: "hsl(222 47% 5%)" }}
    >
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <span
            className="text-[11px] font-bold uppercase tracking-[0.12em] block mb-3"
            style={{ color: "hsl(245 75% 70%)" }}
          >
            Client Results
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight max-w-lg">
            Real businesses,{" "}
            <span style={{ color: "hsl(245 75% 70%)" }}>measurable results</span>
          </h2>
        </motion.div>

        {/* Desktop: 3 columns */}
        <div className="hidden md:grid md:grid-cols-3 gap-5">
          {testimonials.map((t, i) => (
            <TestimonialCard key={t.name} t={t} delay={0.12 + i * 0.1} inView={inView} />
          ))}
        </div>

        {/* Mobile: carousel */}
        <div className="md:hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, x: 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -28 }}
              transition={{ duration: 0.28 }}
            >
              <TestimonialCard t={testimonials[active]} inView={true} />
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              onClick={() => setActive(p => (p - 1 + testimonials.length) % testimonials.length)}
              className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition-colors"
              aria-label="Previous"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex gap-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className="w-2 h-2 rounded-full transition-all duration-200"
                  style={{
                    background: i === active ? "hsl(245 75% 70%)" : "rgba(255,255,255,0.2)",
                  }}
                  aria-label={`Go to ${i + 1}`}
                />
              ))}
            </div>
            <button
              onClick={() => setActive(p => (p + 1) % testimonials.length)}
              className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 transition-colors"
              aria-label="Next"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
