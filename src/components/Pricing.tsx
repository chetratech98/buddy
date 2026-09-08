import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";

const plans = [
  {
    name: "Basic",
    subtitle: "For getting started",
    monthlyPrice: 1499,
    annualPrice: 14999,
    buttonText: "Start Free Trial",
    popular: false,
    features: [
      "15 blog posts per month",
      "Monthly business intelligence update",
      "5 keywords",
    ],
  },
  {
    name: "Standard",
    subtitle: "Everything you need to grow",
    monthlyPrice: 2999,
    annualPrice: 29999,
    buttonText: "Start Free Trial",
    popular: true,
    features: [
      "1 AI blog post per day",
      "Weekly business intelligence update",
      "10 keywords",
      "SERP Analysis",
      "Detailed Dashboards",
    ],
  },
];

const discountPercent = (monthlyPrice: number, annualPrice: number) =>
  Math.round(((monthlyPrice * 12 - annualPrice) / (monthlyPrice * 12)) * 100);

const Pricing = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" ref={ref} className="py-20 md:py-28 px-5 sm:px-6 bg-white">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="mb-10 text-center"
        >
          <span className="section-label">Pricing</span>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground leading-tight">
            Simple, transparent pricing
          </h2>
          <p className="mt-3 text-muted-foreground text-sm sm:text-base">
            14-day free trial. No credit card required.
          </p>

          {/* Toggle */}
          <div className="inline-flex items-center p-1 rounded-lg border border-border bg-secondary/40 mt-6">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all duration-150 ${
                !annual
                  ? "bg-white shadow-sm text-foreground border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-semibold transition-all duration-150 ${
                annual
                  ? "bg-white shadow-sm text-foreground border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Annual
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full badge-success">
                Save up to {Math.max(...plans.map(p => discountPercent(p.monthlyPrice, p.annualPrice)))}%
              </span>
            </button>
          </div>
        </motion.div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          {plans.map((plan, i) => {
            const price = annual ? plan.annualPrice : plan.monthlyPrice;
            const discount = discountPercent(plan.monthlyPrice, plan.annualPrice);
            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 24 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.1 + i * 0.1, duration: 0.5 }}
                className="relative flex flex-col rounded-2xl"
                style={plan.popular ? {
                  background: "hsl(var(--card))",
                  border: `2px solid hsl(var(--primary))`,
                  boxShadow: "0 0 0 4px hsl(245 75% 59% / 0.08), var(--shadow-lg)",
                } : {
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                {/* Popular badge */}
                {plan.popular && (
                  <div className="absolute -top-3 left-5">
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold text-white"
                      style={{ background: "hsl(var(--primary))" }}
                    >
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="p-7 flex flex-col flex-1">
                  {/* Plan header */}
                  <div className={plan.popular ? "pt-3" : ""}>
                    <h3 className="text-lg font-extrabold text-foreground">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{plan.subtitle}</p>
                  </div>

                  {/* Price */}
                  <div className="mt-6 flex items-end gap-1.5">
                    <span className="text-4xl sm:text-5xl font-black tracking-tight text-foreground">
                      ₹{price.toLocaleString("en-IN")}
                    </span>
                    <span className="text-sm text-muted-foreground mb-1.5">/ {annual ? "yr" : "mo"}</span>
                  </div>
                  {annual && (
                    <p className="mt-1.5 text-sm font-semibold" style={{ color: "hsl(142 71% 35%)" }}>
                      Save {discount}% vs monthly
                    </p>
                  )}

                  {/* CTA */}
                  <button
                    onClick={() => navigate("/auth")}
                    className={`w-full mt-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
                      plan.popular ? "btn-primary" : "btn-outline"
                    }`}
                  >
                    {plan.buttonText}
                  </button>
                  <p className="mt-2.5 text-center text-xs text-muted-foreground">
                    No credit card required · Cancel anytime
                  </p>

                  {/* Divider */}
                  <div className="h-px bg-border mt-6 mb-5" />

                  {/* Features */}
                  <ul className="space-y-3 flex-1">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <div
                          className="w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: "hsl(var(--primary) / 0.08)" }}
                        >
                          <Check size={10} style={{ color: "hsl(var(--primary))" }} />
                        </div>
                        <span className="text-foreground/80">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Trust note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.6 }}
          className="text-center text-sm text-muted-foreground mt-10"
        >
          14-day free trial · Cancel anytime · No credit card required
        </motion.p>
      </div>
    </section>
  );
};

export default Pricing;
