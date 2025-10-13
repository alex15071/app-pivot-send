import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppWindow, Users, MessagesSquare, Send, TrendingUp, AlertTriangle } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
      }
    };
    checkAuth();
  }, [navigate]);

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [appsRes, accountsRes, fanpagesRes, campaignsRes] = await Promise.all([
        supabase.from("apps").select("*", { count: "exact", head: true }),
        supabase.from("accounts").select("*", { count: "exact", head: true }),
        supabase.from("fanpages").select("conversations"),
        supabase.from("campaigns").select("status, delivered, failed"),
      ]);

      const totalConversations = fanpagesRes.data?.reduce((sum, fp) => sum + (fp.conversations || 0), 0) || 0;
      const runningCampaigns = campaignsRes.data?.filter(c => c.status === 'running').length || 0;
      const totalDelivered = campaignsRes.data?.reduce((sum, c) => sum + (c.delivered || 0), 0) || 0;
      const totalFailed = campaignsRes.data?.reduce((sum, c) => sum + (c.failed || 0), 0) || 0;

      return {
        apps: (appsRes.count as number) || 0,
        accounts: (accountsRes.count as number) || 0,
        fanpages: fanpagesRes.data?.length || 0,
        conversations: totalConversations,
        runningCampaigns,
        totalDelivered,
        totalFailed,
      };
    },
    refetchInterval: 30000, // Cambiado de 5s a 30s para reducir carga
    retry: 2,
    staleTime: 10000,
  });

  const deliveryRate = stats && (stats.totalDelivered + stats.totalFailed) > 0
    ? ((stats.totalDelivered / (stats.totalDelivered + stats.totalFailed)) * 100).toFixed(1)
    : "0";

  if (error) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Multi-app Facebook Messenger broadcast system</p>
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
                <p>Error loading dashboard statistics. The database might be busy.</p>
                <p className="text-sm mt-2">Please wait a moment and refresh the page.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Multi-app Facebook Messenger broadcast system</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate("/apps")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Facebook Apps</CardTitle>
              <AppWindow className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.apps || 0}</div>
              <p className="text-xs text-muted-foreground">Multi-app rotation</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate("/accounts")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Connected Accounts</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.accounts || 0}</div>
              <p className="text-xs text-muted-foreground">OAuth connections</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate("/fanpages")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
              <MessagesSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.conversations.toLocaleString() || 0}</div>
              <p className="text-xs text-muted-foreground">Across {stats?.fanpages || 0} fanpages</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate("/campaigns")}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.runningCampaigns || 0}</div>
              <p className="text-xs text-muted-foreground">Currently sending</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                Delivery Performance
              </CardTitle>
              <CardDescription>Overall message delivery statistics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Delivery Rate</span>
                  <span className="font-bold text-green-600">{deliveryRate}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Delivered</span>
                  <span className="font-medium">{stats?.totalDelivered.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Failed</span>
                  <span className="font-medium text-red-600">{stats?.totalFailed.toLocaleString() || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Quick Start Guide
              </CardTitle>
              <CardDescription>Get started with your messaging system</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-primary">1.</span>
                  <span>Add your Facebook apps in the Apps section</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-primary">2.</span>
                  <span>Connect Facebook accounts via OAuth</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-primary">3.</span>
                  <span>Harvest conversations from your fanpages</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-primary">4.</span>
                  <span>Create pacing profiles for rate limiting</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-primary">5.</span>
                  <span>Launch campaigns and monitor performance</span>
                </li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;

