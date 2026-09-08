import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const StickyCTA = () => {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 700);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (user) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-4 pb-4 pt-3 bg-white/95 backdrop-blur-xl border-t border-border"
          style={{ boxShadow: "0 -8px 24px rgba(0,0,0,0.06)" }}
        >
          <button
            onClick={() => navigate("/auth")}
            className="btn-primary w-full py-3 text-[15px] justify-center"
          >
            Start Free Trial — No Card Required
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StickyCTA;
