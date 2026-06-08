import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ExternalLink, Loader2, Check, AlertCircle, Lock } from 'lucide-react';

export const WordPressSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [wpUrl, setWpUrl] = useState('');
  const [wpUsername, setWpUsername] = useState('');
  // New password field — empty = no change; non-empty = update password
  const [wpAppPassword, setWpAppPassword] = useState('');
  const [hasStoredPassword, setHasStoredPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!user) return;

    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          // Only fetch non-sensitive fields + whether a password is stored
          .select('wp_url, wp_username, wp_app_password_enc, wp_app_password')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;

        if (data) {
          setWpUrl(data.wp_url || '');
          setWpUsername(data.wp_username || '');
          // Consider password as stored if either encrypted or legacy plaintext exists
          const hasPass = !!(data as any).wp_app_password_enc || !!data.wp_app_password;
          setHasStoredPassword(hasPass);
        }
      } catch (error) {
        console.error('Failed to load WordPress settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    if (wpUrl && !wpUrl.match(/^https?:\/\/.+/)) {
      toast({
        title: 'Invalid URL',
        description: 'WordPress URL must start with http:// or https://',
        variant: 'destructive',
      });
      return;
    }

    if (changingPassword && !wpAppPassword.trim()) {
      toast({
        title: 'Password required',
        description: 'Enter your WordPress Application Password or cancel the change.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      // Credentials are saved via Edge Function so the password is encrypted before DB write
      const { data, error } = await supabase.functions.invoke('save-wordpress-credentials', {
        body: {
          wpUrl: wpUrl.trim(),
          wpUsername: wpUsername.trim(),
          // Only send password if user explicitly typed a new one
          wpAppPassword: changingPassword ? wpAppPassword.trim() : undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'Settings saved', description: 'WordPress credentials updated securely.' });
      setTestResult(null);
      if (changingPassword) {
        setHasStoredPassword(true);
        setChangingPassword(false);
        setWpAppPassword('');
      }
    } catch (error) {
      toast({
        title: 'Failed to save',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!wpUrl || !wpUsername) {
      toast({
        title: 'Missing credentials',
        description: 'Please fill in the WordPress URL and username before testing.',
        variant: 'destructive',
      });
      return;
    }
    if (!hasStoredPassword && !wpAppPassword) {
      toast({
        title: 'No password configured',
        description: 'Please enter and save your Application Password first.',
        variant: 'destructive',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // Test happens server-side so the password is never exposed on the frontend
      const { data, error } = await supabase.functions.invoke('test-wordpress-connection', {
        body: {
          wpUrl: wpUrl.trim(),
          wpUsername: wpUsername.trim(),
          // If user is typing a new password, send it for testing; otherwise let server use stored
          wpAppPassword: changingPassword && wpAppPassword.trim() ? wpAppPassword.trim() : undefined,
        },
      });

      if (error) throw error;

      setTestResult({
        success: data?.success ?? false,
        message: data?.message ?? 'Unexpected response',
      });

      if (data?.success) {
        toast({ title: 'Connection successful', description: 'WordPress credentials verified.' });
      } else {
        toast({ title: 'Connection failed', description: data?.message, variant: 'destructive' });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      setTestResult({ success: false, message: msg });
      toast({ title: 'Connection error', description: msg, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>WordPress Integration</CardTitle>
        <CardDescription>
          Connect your WordPress site to automatically publish posts. Credentials are stored encrypted.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>How to get an Application Password:</strong>
            <ol className="mt-2 ml-4 list-decimal space-y-1 text-sm">
              <li>Log in to your WordPress admin dashboard</li>
              <li>Go to Users → Profile</li>
              <li>Scroll down to "Application Passwords"</li>
              <li>Enter a name (e.g., "Buddy") and click "Add New Application Password"</li>
              <li>Copy the generated password and paste it below</li>
            </ol>
            <a
              href="https://wordpress.org/support/article/application-passwords/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline mt-2"
            >
              Learn more <ExternalLink size={12} />
            </a>
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <Label htmlFor="wp_url">WordPress Site URL</Label>
            <Input
              id="wp_url"
              type="url"
              placeholder="https://yoursite.com"
              value={wpUrl}
              onChange={(e) => setWpUrl(e.target.value)}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="wp_username">WordPress Username</Label>
            <Input
              id="wp_username"
              type="text"
              placeholder="admin"
              value={wpUsername}
              onChange={(e) => setWpUsername(e.target.value)}
              className="mt-1.5"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="wp_app_password">Application Password</Label>
              {hasStoredPassword && !changingPassword && (
                <button
                  type="button"
                  onClick={() => setChangingPassword(true)}
                  className="text-xs text-primary hover:underline"
                >
                  Change password
                </button>
              )}
              {changingPassword && (
                <button
                  type="button"
                  onClick={() => { setChangingPassword(false); setWpAppPassword(''); }}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Cancel
                </button>
              )}
            </div>

            {!changingPassword && hasStoredPassword ? (
              <div className="mt-1.5 flex items-center gap-2 px-3 py-2 rounded-md border bg-muted text-sm text-muted-foreground">
                <Lock size={14} />
                <span>Password stored securely (encrypted)</span>
              </div>
            ) : (
              <Input
                id="wp_app_password"
                type="password"
                placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                value={wpAppPassword}
                onChange={(e) => setWpAppPassword(e.target.value)}
                className="mt-1.5"
              />
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Application password from WordPress (not your login password). Stored AES-256 encrypted.
            </p>
          </div>
        </div>

        {testResult && (
          <Alert variant={testResult.success ? 'default' : 'destructive'}>
            {testResult.success ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <AlertDescription>{testResult.message}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleTestConnection}
            variant="outline"
            disabled={testing || !wpUrl || !wpUsername || (!hasStoredPassword && !wpAppPassword)}
          >
            {testing ? (
              <><Loader2 className="animate-spin mr-2" size={16} />Testing...</>
            ) : (
              'Test Connection'
            )}
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? (
              <><Loader2 className="animate-spin mr-2" size={16} />Saving...</>
            ) : (
              'Save Settings'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
