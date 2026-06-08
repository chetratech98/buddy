import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";

// Lazy-load all page components for code splitting
const Index          = lazy(() => import("./pages/Index"));
const Auth           = lazy(() => import("./pages/Auth"));
const VerifyEmail    = lazy(() => import("./pages/VerifyEmail"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword  = lazy(() => import("./pages/ResetPassword"));
const AcceptInvite   = lazy(() => import("./pages/AcceptInvite"));
const Profile        = lazy(() => import("./pages/Profile"));
const Dashboard      = lazy(() => import("./pages/Analytics"));
const ContentCalendar= lazy(() => import("./pages/ContentCalendar"));
const Billing        = lazy(() => import("./pages/Billing"));
const CreatePost     = lazy(() => import("./pages/CreatePost"));
const Posts          = lazy(() => import("./pages/Posts"));
const NotFound       = lazy(() => import("./pages/NotFound"));
const GetStarted     = lazy(() => import("./pages/GetStarted"));
const ContentPlan    = lazy(() => import("./pages/ContentPlan"));
const SeoAnalysis    = lazy(() => import("./pages/SeoAnalysis"));
const TodaysBlog     = lazy(() => import("./pages/TodaysBlog"));
const Admin          = lazy(() => import("./pages/Admin"));
const EditPost       = lazy(() => import("./pages/EditPost"));

// Settings pages
const OrgSettings    = lazy(() => import("./pages/settings/Organization"));
const MembersSettings= lazy(() => import("./pages/settings/Members"));
const SitesSettings  = lazy(() => import("./pages/settings/Sites"));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: (failureCount, error) => {
        if (error instanceof Error && error.message.match(/4\d\d/)) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public Routes */}
              <Route path="/"                 element={<Index />} />
              <Route path="/auth"             element={<Auth />} />
              <Route path="/auth/callback"    element={<Auth />} />
              <Route path="/verify-email"     element={<VerifyEmail />} />
              <Route path="/forgot-password"  element={<ForgotPassword />} />
              <Route path="/reset-password"   element={<ResetPassword />} />
              <Route path="/invite/:token"    element={<AcceptInvite />} />

              {/* Protected Routes — require login */}
              <Route path="/get-started"      element={<ProtectedRoute><GetStarted /></ProtectedRoute>} />
              <Route path="/dashboard"        element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/profile"          element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/billing"          element={<ProtectedRoute><Billing /></ProtectedRoute>} />
              <Route path="/calendar"         element={<ProtectedRoute><ContentCalendar /></ProtectedRoute>} />
              <Route path="/create-post"      element={<ProtectedRoute><CreatePost /></ProtectedRoute>} />
              <Route path="/posts"            element={<ProtectedRoute><Posts /></ProtectedRoute>} />
              <Route path="/posts/:id/edit"   element={<ProtectedRoute><EditPost /></ProtectedRoute>} />
              <Route path="/content-plan"     element={<ProtectedRoute><ContentPlan /></ProtectedRoute>} />
              <Route path="/seo-analysis"     element={<ProtectedRoute><SeoAnalysis /></ProtectedRoute>} />
              <Route path="/todays-blog"      element={<ProtectedRoute><TodaysBlog /></ProtectedRoute>} />

              {/* Settings — require login */}
              <Route path="/settings/organization" element={<ProtectedRoute><OrgSettings /></ProtectedRoute>} />
              <Route path="/settings/members"      element={<ProtectedRoute><MembersSettings /></ProtectedRoute>} />
              <Route path="/settings/sites"        element={<ProtectedRoute><SitesSettings /></ProtectedRoute>} />

              {/* Admin — require login + admin role */}
              <Route path="/admin"            element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />

              <Route path="*"                 element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
