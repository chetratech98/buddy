import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Bot, Clock, TrendingUp, FileText, Link, Crosshair, CalendarDays, Send, BarChart2, ShieldCheck } from "lucide-react";

const features = [
  {
    icon: Bot,
    title: "AI-Powered Research",
    description: "Our AI analyzes the top 10 Google results for each keyword and creates superior, comprehensive content that outranks competitors.",
  },
  {
    icon: Clock,
    title: "Daily Automation",
    description: "Set your keywords and schedule once. Wake up to fresh, SEO-optimized blog posts every morning — zero manual effort.",
  },
  {
    icon: TrendingUp,
    title: "SEO Optimized",
    description: "Every post is structured with the right keywords, semantic headings, meta tags, and internal link suggestions to rank higher faster.",
  },
  {
    icon: Crosshair,
    title: "Competitor SERP Analysis",
    description: "Analyze top-ranking competitors in seconds. Uncover their keyword gaps, content strategies, and content score benchmarks.",
  },
  {
    icon: CalendarDays,
    title: "Content Calendar",
    description: "Plan, schedule, and visualize your entire publishing pipeline. Drag-and-drop posts across dates to maintain a consistent cadence.",
  },
  {
    icon: Send,
    title: "Multi-Platform Publishing",
    description: "Publish directly to WordPress and Medium with one click. Your content reaches every channel without copy-pasting.",
  },
  {
    icon: BarChart2,
    title: "Analytics Dashboard",
    description: "Track post performance, keyword rankings, and publishing trends from a single, intuitive dashboard.",
  },
  {
    icon: FileText,
    title: "30-Day Content Plans",
    description: "Generate a complete month of strategic blog topics, long-tail keywords, and posting schedules tailored to your niche.",
  },
  {
    icon: Link,
    title: "Smart References",
    description: "Automatic citations and references to authoritative sources, boosting E-E-A-T signals that Google's algorithm rewards.",
  },
  {
    icon: ShieldCheck,
    title: "Brand Voice Control",
    description: "Choose from Professional, Casual, Technical, or Friendly tones. Set your organization's goals to shape every AI-generated article.",
  },
];

const Features = () => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="features" ref={ref} className="relative py-32 px-4 bg-gradient-to-b from-background via-secondary/20 to-background overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-20 right-10 w-72 h-72 bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-accent/5 rounded-full blur-[140px] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <span className="section-label mb-4 inline-block">FEATURES</span>
          <h2 className="text-4xl md:text-6xl font-bold mt-2 mb-6">
            Everything You Need for{" "}
            <span className="text-gradient">SEO Success</span>
          </h2>
          <p className="mt-6 text-muted-foreground text-lg md:text-xl max-w-3xl mx-auto leading-relaxed">
            Powerful features designed to automate your content creation and boost your search rankings
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 40 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.1 + i * 0.1, duration: 0.6, ease: "easeOut" }}
              className="group relative"
            >
              {/* Gradient border effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-accent/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl" />
              
              <div className="relative card-elevated p-8 h-full bg-card/80 backdrop-blur-sm">
                {/* Icon with gradient background */}
                <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/15 to-accent/10 flex items-center justify-center mb-6 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
                  <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                  <feature.icon size={26} className="text-primary relative z-10" />
                </div>
                
                <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                
                {/* Hover accent */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 rounded-b-2xl" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
