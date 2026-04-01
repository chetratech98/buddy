import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import Dashboard from "./pages/Analytics";
import ContentCalendar from "./pages/ContentCalendar";
import Billing from "./pages/Billing";
import CreatePost from "./pages/CreatePost";
import Posts from "./pages/Posts";
import NotFound from "./pages/NotFound";
import GetStarted from "./pages/GetStarted";
import ContentPlan from "./pages/ContentPlan";
import SeoAnalysis from "./pages/SeoAnalysis";
import TodaysBlog from "./pages/TodaysBlog";
import Admin from "./pages/Admin";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/get-started" element={<GetStarted />} />
            
            {/* Protected Routes - Require Login */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute><ContentCalendar /></ProtectedRoute>} />
            <Route path="/create-post" element={<ProtectedRoute><CreatePost /></ProtectedRoute>} />
            <Route path="/posts" element={<ProtectedRoute><Posts /></ProtectedRoute>} />
            <Route path="/content-plan" element={<ProtectedRoute><ContentPlan /></ProtectedRoute>} />
            <Route path="/seo-analysis" element={<ProtectedRoute><SeoAnalysis /></ProtectedRoute>} />
            <Route path="/todays-blog" element={<ProtectedRoute><TodaysBlog /></ProtectedRoute>} />
            
            {/* Admin Only Routes - Require Login + Admin Role */}
            <Route path="/admin" element={<ProtectedRoute requireAdmin={true}><Admin /></ProtectedRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
