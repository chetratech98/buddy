import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PageShell } from '@/components/PageShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, Loader2, CreditCard, TrendingUp, AlertCircle, ExternalLink, CheckCircle2 } from 'lucide-react';

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: PlanFeature[];
  popular?: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      { text: '5 blog posts per month', included: true },
      { text: 'Basic content templates', included: true },
      { text: 'SEO optimization', included: true },
      { text: 'Draft & scheduling', included: true },
      { text: 'WordPress publishing', included: false },
      { text: 'Email notifications', included: false },
      { text: 'Priority support', included: false },
      { text: 'Custom AI training', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 29,
    yearlyPrice: 23,
    popular: true,
    features: [
      { text: '50 blog posts per month', included: true },
      { text: 'All content templates', included: true },
      { text: 'Advanced SEO optimization', included: true },
      { text: 'Multi-platform publishing', included: true },
      { text: 'WordPress auto-publish', included: true },
      { text: 'Email notifications', included: true },
      { text: 'Priority email support', included: true },
      { text: 'Custom AI training', included: false },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 99,
    yearlyPrice: 79,
    features: [
      { text: 'Unlimited blog posts', included: true },
      { text: 'All premium templates', included: true },
      { text: 'Advanced SEO & analytics', included: true },
      { text: 'Multi-platform publishing', included: true },
      { text: 'WordPress auto-publish', included: true },
      { text: 'Real-time notifications', included: true },
      { text: 'Priority phone & chat support', included: true },
      { text: 'Custom AI model training', included: true },
    ],
  },
];

const Billing = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string>('free');
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('active');
  const [quotaInfo, setQuotaInfo] = useState({ used: 0, total: 5 });
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');

  const sessionResult = searchParams.get('session');

  const fetchSubscriptionInfo = async () => {
    if (!user) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_status, posts_used_this_month, posts_quota_monthly')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      if (data) {
        setCurrentPlan(data.subscription_tier || 'free');
        setSubscriptionStatus(data.subscription_status || 'active');
        setQuotaInfo({
          used: data.posts_used_this_month || 0,
          total: data.posts_quota_monthly || 5,
        });
      }
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptionInfo();
  }, [user]);

  // Handle return from Stripe checkout
  useEffect(() => {
    if (sessionResult === 'success') {
      toast({
        title: 'Payment successful!',
        description: 'Your plan has been activated. It may take a few seconds to reflect.',
      });
      // Poll for up to 10 seconds for the webhook to update the plan
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        await fetchSubscriptionInfo();
        if (attempts >= 5) clearInterval(poll);
      }, 2000);
      // Clean up URL param
      navigate('/billing', { replace: true });
    } else if (sessionResult === 'cancelled') {
      toast({
        title: 'Checkout cancelled',
        description: 'No changes were made to your plan.',
      });
      navigate('/billing', { replace: true });
    }
  }, [sessionResult]);

  const handleUpgrade = async (planId: string) => {
    if (!user) {
      toast({ title: 'Sign in required', description: 'Please sign in to upgrade.', variant: 'destructive' });
      return;
    }
    if (planId === currentPlan) {
      toast({ title: 'Already subscribed', description: 'You are already on this plan.' });
      return;
    }
    if (planId === 'free') {
      toast({
        title: 'To downgrade',
        description: 'To cancel your subscription, use the "Manage Billing" button to access the customer portal.',
      });
      return;
    }

    setProcessingPlan(planId);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { planId, billingInterval },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error('No checkout URL returned');

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (e) {
      toast({
        title: 'Checkout failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
      setProcessingPlan(null);
    }
  };

  const handleManageBilling = async () => {
    if (!user) return;
    setOpeningPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-portal-session', {});
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error('No portal URL returned');
      window.location.href = data.url;
    } catch (e) {
      toast({
        title: 'Could not open billing portal',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
      setOpeningPortal(false);
    }
  };

  if (loading) {
    return (
      <PageShell>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin" size={32} />
        </div>
      </PageShell>
    );
  }

  const usagePercentage = currentPlan === 'enterprise' ? 0 : Math.min((quotaInfo.used / quotaInfo.total) * 100, 100);
  const isPaidPlan = currentPlan !== 'free';

  return (
    <PageShell>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-lg text-muted-foreground">
            Scale your content creation with the right plan for your needs
          </p>

          {/* Billing interval toggle */}
          <div className="inline-flex items-center gap-2 mt-6 bg-muted rounded-full p-1">
            <button
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${billingInterval === 'month' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setBillingInterval('month')}
            >
              Monthly
            </button>
            <button
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${billingInterval === 'year' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setBillingInterval('year')}
            >
              Yearly <Badge variant="secondary" className="ml-1 text-xs">Save 20%</Badge>
            </button>
          </div>
        </div>

        {/* Current usage */}
        {user && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="text-primary" />
                  Current Usage
                </CardTitle>
                {isPaidPlan && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleManageBilling}
                    disabled={openingPortal}
                  >
                    {openingPortal ? (
                      <><Loader2 className="animate-spin mr-2" size={14} />Opening...</>
                    ) : (
                      <><CreditCard size={14} className="mr-2" />Manage Billing</>
                    )}
                  </Button>
                )}
              </div>
              <CardDescription>
                You are on the{' '}
                <strong className="capitalize">{currentPlan}</strong> plan
                {subscriptionStatus === 'past_due' && (
                  <Badge variant="destructive" className="ml-2">Payment Failed</Badge>
                )}
                {subscriptionStatus === 'canceled' && (
                  <Badge variant="outline" className="ml-2">Canceled</Badge>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {subscriptionStatus === 'past_due' && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Your payment failed. Please update your payment method to keep access.{' '}
                    <button onClick={handleManageBilling} className="underline font-medium">Update payment method</button>
                  </AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Posts this month</span>
                  <span className="font-medium">
                    {quotaInfo.used} / {currentPlan === 'enterprise' ? '∞' : quotaInfo.total}
                  </span>
                </div>
                {currentPlan !== 'enterprise' && (
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        usagePercentage >= 90 ? 'bg-destructive' :
                        usagePercentage >= 70 ? 'bg-yellow-500' : 'bg-primary'
                      }`}
                      style={{ width: `${usagePercentage}%` }}
                    />
                  </div>
                )}
                {usagePercentage >= 80 && currentPlan !== 'enterprise' && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      You have used {usagePercentage.toFixed(0)}% of your monthly quota.
                      Upgrade to continue creating content.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const isCurrentPlan = currentPlan === plan.id;
            const isProcessing = processingPlan === plan.id;
            const price = billingInterval === 'year' ? plan.yearlyPrice : plan.monthlyPrice;

            return (
              <Card
                key={plan.id}
                className={`relative ${plan.popular ? 'border-primary shadow-lg scale-105' : ''} ${isCurrentPlan ? 'ring-2 ring-primary' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary">Most Popular</Badge>
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="absolute -top-3 right-4">
                    <Badge variant="outline" className="bg-background flex items-center gap-1">
                      <CheckCircle2 size={12} className="text-primary" /> Current Plan
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">${price}</span>
                    <span className="text-muted-foreground">
                      {plan.id === 'free' ? '/forever' : `/${billingInterval}`}
                    </span>
                    {billingInterval === 'year' && plan.id !== 'free' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Billed annually (${plan.yearlyPrice * 12}/yr)
                      </p>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  <ul className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <Check
                          size={18}
                          className={`flex-shrink-0 mt-0.5 ${feature.included ? 'text-primary' : 'text-muted-foreground opacity-30'}`}
                        />
                        <span className={!feature.included ? 'text-muted-foreground line-through' : ''}>
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    variant={plan.popular ? 'default' : 'outline'}
                    disabled={isCurrentPlan || isProcessing || !user || plan.id === 'free'}
                    onClick={() => handleUpgrade(plan.id)}
                  >
                    {isProcessing ? (
                      <><Loader2 className="animate-spin mr-2" size={16} />Redirecting to checkout...</>
                    ) : isCurrentPlan ? (
                      'Current Plan'
                    ) : plan.id === 'free' ? (
                      'Free Plan'
                    ) : !user ? (
                      'Sign In to Subscribe'
                    ) : (
                      `Upgrade to ${plan.name}`
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Stripe security note */}
        <Card className="mt-12">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="text-primary" />
              Secure Payments
            </CardTitle>
            <CardDescription>Powered by Stripe</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <AlertDescription>
                All payments are processed securely through{' '}
                <a href="https://stripe.com" target="_blank" rel="noopener noreferrer" className="font-medium underline inline-flex items-center gap-1">
                  Stripe <ExternalLink size={12} />
                </a>
                . Your card details never touch our servers. Subscriptions can be cancelled anytime from the billing portal.
              </AlertDescription>
            </Alert>
            {isPaidPlan && (
              <Button variant="outline" onClick={handleManageBilling} disabled={openingPortal} className="w-full sm:w-auto">
                {openingPortal ? <Loader2 className="animate-spin mr-2" size={16} /> : <ExternalLink size={14} className="mr-2" />}
                View Invoices & Manage Subscription
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
};

export default Billing;
