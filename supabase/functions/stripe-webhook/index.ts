import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14";

const PLAN_DETAILS: Record<string, { tier: string; quota: number }> = {
  pro: { tier: "pro", quota: 50 },
  enterprise: { tier: "enterprise", quota: 999999 },
  free: { tier: "free", quota: 5 },
};

function getPlanDetails(plan: string) {
  return PLAN_DETAILS[plan] ?? PLAN_DETAILS.pro;
}

// Determine plan from Stripe price ID
function planFromPriceId(priceId: string): string {
  const enterpriseIds = (Deno.env.get("STRIPE_ENTERPRISE_PRICE_ID_MONTHLY") ?? "") + "," +
    (Deno.env.get("STRIPE_ENTERPRISE_PRICE_ID_YEARLY") ?? "");
  if (enterpriseIds.includes(priceId)) return "enterprise";
  return "pro";
}

serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing stripe-signature header", { status: 400 });

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) return new Response("STRIPE_WEBHOOK_SECRET not configured", { status: 500 });

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
    apiVersion: "2024-04-10",
  });

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] Signature verification failed:", err);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Use service role to bypass RLS for webhook updates
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        const plan = session.metadata?.plan || "pro";
        if (!userId) {
          console.error("[stripe-webhook] checkout.session.completed missing supabase_user_id");
          break;
        }

        const { tier, quota } = getPlanDetails(plan);
        const resetDate = new Date();
        resetDate.setMonth(resetDate.getMonth() + 1, 1);
        resetDate.setHours(0, 0, 0, 0);

        const { error } = await supabase.from("profiles").update({
          subscription_tier: tier,
          subscription_status: "active",
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          posts_quota_monthly: quota,
          posts_used_this_month: 0,
          quota_reset_date: resetDate.toISOString(),
        }).eq("user_id", userId);

        if (error) console.error("[stripe-webhook] Failed to update profile:", error);
        else console.log(`[stripe-webhook] checkout.session.completed: user ${userId} → ${tier}`);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        if (!customerId) break;

        const resetDate = new Date();
        resetDate.setMonth(resetDate.getMonth() + 1, 1);
        resetDate.setHours(0, 0, 0, 0);

        const { error } = await supabase.from("profiles").update({
          posts_used_this_month: 0,
          quota_reset_date: resetDate.toISOString(),
          subscription_status: "active",
        }).eq("stripe_customer_id", customerId);

        if (error) console.error("[stripe-webhook] Failed to reset quota:", error);
        else console.log(`[stripe-webhook] invoice.payment_succeeded: quota reset for ${customerId}`);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Determine plan from subscription items price IDs
        const priceId = subscription.items.data[0]?.price?.id ?? "";
        const plan = subscription.metadata?.plan || planFromPriceId(priceId);
        const { tier, quota } = getPlanDetails(plan);

        const { error } = await supabase.from("profiles").update({
          subscription_tier: tier,
          subscription_status: subscription.status,
          stripe_subscription_id: subscription.id,
          posts_quota_monthly: quota,
        }).eq("stripe_customer_id", customerId);

        if (error) console.error("[stripe-webhook] Failed to update subscription:", error);
        else console.log(`[stripe-webhook] subscription.updated: ${customerId} → ${tier} (${subscription.status})`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { error } = await supabase.from("profiles").update({
          subscription_tier: "free",
          subscription_status: "canceled",
          stripe_subscription_id: null,
          posts_quota_monthly: 5,
        }).eq("stripe_customer_id", customerId);

        if (error) console.error("[stripe-webhook] Failed to downgrade:", error);
        else console.log(`[stripe-webhook] subscription.deleted: ${customerId} downgraded to free`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        await supabase.from("profiles").update({
          subscription_status: "past_due",
        }).eq("stripe_customer_id", customerId);

        console.log(`[stripe-webhook] invoice.payment_failed: ${customerId} → past_due`);
        break;
      }

      default:
        console.log(`[stripe-webhook] Unhandled event: ${event.type}`);
    }
  } catch (e) {
    console.error(`[stripe-webhook] Error handling ${event.type}:`, e);
    return new Response("Internal server error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
