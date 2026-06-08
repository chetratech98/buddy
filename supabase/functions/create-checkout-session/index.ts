import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { planId, billingInterval = "month" } = await req.json();

    if (!["pro", "enterprise"].includes(planId)) {
      return jsonResponse({ error: "Invalid plan" }, 400);
    }

    const priceId = planId === "pro"
      ? (billingInterval === "year"
          ? Deno.env.get("STRIPE_PRO_PRICE_ID_YEARLY")
          : Deno.env.get("STRIPE_PRO_PRICE_ID_MONTHLY"))
      : (billingInterval === "year"
          ? Deno.env.get("STRIPE_ENTERPRISE_PRICE_ID_YEARLY")
          : Deno.env.get("STRIPE_ENTERPRISE_PRICE_ID_MONTHLY"));

    if (!priceId) {
      return jsonResponse({ error: "Price ID not configured for this plan. Add STRIPE_PRO_PRICE_ID_MONTHLY and STRIPE_ENTERPRISE_PRICE_ID_MONTHLY to Supabase secrets." }, 500);
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: "2024-04-10",
    });

    // Get or create Stripe customer
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, display_name")
      .eq("user_id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id || null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.display_name || undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      // Save immediately so the webhook can find this user
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", user.id);
    }

    const origin = req.headers.get("origin") || Deno.env.get("SITE_URL") || "http://localhost:5173";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/billing?session=success`,
      cancel_url: `${origin}/billing?session=cancelled`,
      allow_promotion_codes: true,
      metadata: { supabase_user_id: user.id, plan: planId },
      subscription_data: {
        metadata: { supabase_user_id: user.id, plan: planId },
      },
    });

    return jsonResponse({ url: session.url });
  } catch (e) {
    console.error("[create-checkout-session] Error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
