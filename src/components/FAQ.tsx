import { motion, useInView, AnimatePresence } from "framer-motion";
import { useRef, useState } from "react";
import { Plus } from "lucide-react";

const faqs = [
  {
    q: "How does the AI actually write SEO-optimized posts?",
    a: "Buddy analyzes the top 10 Google results for each of your target keywords, identifies what's missing from the current top-ranking content, then drafts a post structured to compete — right headings, keyword density, meta tags, and internal linking suggestions included.",
  },
  {
    q: "Do I need to publish it manually?",
    a: "No. Approve with one click or fine-tune the copy first. Once approved, it publishes straight to your site — no copy-pasting.",
  },
  {
    q: "What if I want to cancel?",
    a: "Cancel anytime from your billing settings — no phone calls, no retention forms. You keep access through the end of your current billing period.",
  },
  {
    q: "Is there a free trial, and does it need a credit card?",
    a: "Yes — every account starts with a 14-day free trial, and no credit card is required to start.",
  },
  {
    q: "Will this work with my existing site?",
    a: "Yes. Buddy publishes directly to WordPress, or you can export content in Markdown/HTML to paste into any CMS.",
  },
  {
    q: "How is this different from just using ChatGPT?",
    a: "ChatGPT doesn't know what's currently ranking for your keywords. Buddy pulls live SERP data, analyzes competing pages, and builds content specifically to outrank them — then keeps doing it automatically, every day.",
  },
];

const FAQ = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section ref={ref} className="py-20 md:py-28 px-5 sm:px-6 bg-white">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <span className="section-label">FAQ</span>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground leading-tight">
            Questions? Answered.
          </h2>
        </motion.div>

        <div className="divide-y divide-border border-t border-b border-border">
          {faqs.map((item, i) => {
            const open = openIndex === i;
            return (
              <motion.div
                key={item.q}
                initial={{ opacity: 0, y: 10 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.05 + i * 0.05, duration: 0.4 }}
              >
                <button
                  onClick={() => setOpenIndex(open ? null : i)}
                  className="w-full flex items-center justify-between gap-4 py-5 text-left"
                  aria-expanded={open}
                >
                  <span className="text-[15px] sm:text-base font-semibold text-foreground">
                    {item.q}
                  </span>
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-transform duration-200"
                    style={{
                      background: "hsl(var(--primary) / 0.08)",
                      color: "hsl(var(--primary))",
                      transform: open ? "rotate(45deg)" : "rotate(0deg)",
                    }}
                  >
                    <Plus size={14} />
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p className="pb-5 text-sm sm:text-[15px] text-muted-foreground leading-relaxed pr-10">
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FAQ;
