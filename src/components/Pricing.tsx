import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { Check, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

const plans = [
  {
    name: "Starter",
    subtitle: "Perfect for solo creators & bloggers",
    monthlyPrice: 49,
    annualPrice: 39,
    buttonText: "Start Free Trial",
    features: [
      "1 AI blog post per day",
      "Up to 3 target keywords",
      "Full SEO optimization",
      "Top 10 SERP analysis",
      "Markdown export",
      "Content calendar",
      "Email support",
    ],
  },
  {
    name: "Professional",
    subtitle: "For growing teams & agencies",
    monthlyPrice: 99,
    annualPrice: 79,
    buttonText: "Start Free Trial",
    popular: true,
    features: [
      "3 AI blog posts per day",
      "Up to 10 keywords",
      "Advanced SEO + competitor analysis",
      "30-day AI content plan",
      "Markdown & HTML export",
      "WordPress & Medium publishing",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    subtitle: "For large teams & organizations",
    monthlyPrice: 249,
    annualPrice: 199,
    buttonText: "Contact Sales",
    features: [
      "Unlimited daily blog posts",
      "Unlimited keywords",
      "Premium SEO + brand voice tuning",
      "Multi-site management",
      "All export formats",
      "API access",
      "Dedicated account manager",
    ],
  },
];

const Pricing = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" ref={ref} className="py-28 px-4 bg-background">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          className="text-center mb-12"
        >
          <span className="section-label">PRICING</span>
          <h2 className="text-3xl md:text-5xl font-bold mt-4">Simple, Transparent Pricing</h2>
          <p className="mt-4 text-muted-foreground text-lg">
            All plans include a 14-day free trial. No credit card required.
          </p>

          {/* Billing toggle */}
          <div className="mt-8 inline-flex items-center gap-4 bg-secondary/50 rounded-xl p-1.5 border border-border">
            <button
              onClick={() => setAnnual(false)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                !annual ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                annual ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
              }`}
            >
              Annual
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]">
                Save 20%
              </span>
            </button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch max-w-5xl mx-auto">
          {plans.map((plan, i) => {
            const price = annual ? plan.annualPrice : plan.monthlyPrice;
            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
                className={`relative flex flex-col rounded-2xl transition-all duration-300 ${
                  plan.popular
                    ? "bg-primary text-primary-foreground shadow-xl shadow-primary/20 z-10 md:-my-4 md:py-12 p-8"
                    : "card-elevated p-8"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] text-xs font-bold py-1.5 px-5 rounded-full shadow-md flex items-center gap-1.5">
                    <Zap size={11} /> Most Popular
                  </div>
                )}

                <h3 className={`text-xl font-bold ${plan.popular ? "" : "text-foreground"}`}>
                  {plan.name}
                </h3>
                <p className={`text-sm mt-1 ${plan.popular ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {plan.subtitle}
                </p>

                <div className="mt-6 mb-1">
                  <span className="text-5xl font-bold">${price}</span>
                  <span className={`text-sm ml-2 ${plan.popular ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    / month
                  </span>
                </div>
                {annual && (
                  <p className={`text-xs mb-5 ${plan.popular ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    Billed annually · Save ${(plan.monthlyPrice - plan.annualPrice) * 12}/yr
                  </p>
                )}
                {!annual && <div className="mb-5" />}

                <button
                  onClick={() => navigate("/auth")}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 mb-8 ${
                    plan.popular
                      ? "bg-background text-primary hover:bg-background/90 shadow-sm"
                      : "btn-primary"
                  }`}
                >
                  {plan.buttonText}
                </button>

                <ul className="space-y-3.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm">
                      <Check
                        size={16}
                        className={`shrink-0 ${plan.popular ? "text-primary-foreground/70" : "text-[hsl(var(--success))]"}`}
                      />
                      <span className={plan.popular ? "text-primary-foreground/90" : "text-foreground"}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom trust note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="text-center text-sm text-muted-foreground mt-12"
        >
          All plans include a 14-day free trial · Cancel anytime · No credit card required
        </motion.p>
      </div>
    </section>
  );
};

export default Pricing;
