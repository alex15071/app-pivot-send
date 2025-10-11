import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, X, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface CampaignStats {
  id: string;
  name: string;
  status: string;
  total_recipients: number;
  processed: number;
  delivered: number;
  failed: number;
  created_at: string;
  current_offset?: number;
  current_page_stats?: any;
}

interface FanpageStats {
  page_id: string;
  fanpage_name: string;
  total_sent: number;
  successful: number;
  failed: number;
}

const CampaignDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: campaign, isLoading: campaignLoading } = useQuery({
    queryKey: ["campaign", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as CampaignStats;
    },
    refetchInterval: 5000,
  });

  const { data: fanpageStats = [], isLoading: statsLoading } = useQuery({
    queryKey: ["campaign-fanpage-stats", id],
    queryFn: async () => {
      // Get send results breakdown by fanpage
      const { data: results } = await supabase
        .from("send_results")
        .select(`
          page_id,
          http_code
        `)
        .eq("campaign_id", id);

      if (!results || results.length === 0) return [];

      // Group by page_id
      const grouped = results.reduce((acc: any, row: any) => {
        if (!acc[row.page_id]) {
          acc[row.page_id] = {
            page_id: row.page_id,
            total_sent: 0,
            successful: 0,
            failed: 0,
          };
        }
        acc[row.page_id].total_sent++;
        if (row.http_code === 200) {
          acc[row.page_id].successful++;
        } else {
          acc[row.page_id].failed++;
        }
        return acc;
      }, {});

      // Get fanpage names
      const pageIds = Object.keys(grouped);
      if (pageIds.length > 0) {
        const { data: fanpages } = await supabase
          .from("fanpages")
          .select("page_id, name")
          .in("page_id", pageIds);

        fanpages?.forEach((fp: any) => {
          if (grouped[fp.page_id]) {
            grouped[fp.page_id].fanpage_name = fp.name;
          }
        });
      }

      return Object.values(grouped) as FanpageStats[];
    },
    enabled: !!id,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running": return "bg-green-500";
      case "paused": return "bg-yellow-500";
      case "finished": return "bg-blue-500";
      case "failed": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const getProgress = () => {
    if (!campaign || campaign.total_recipients === 0) return 0;
    return (campaign.processed / campaign.total_recipients) * 100;
  };

  const getSuccessRate = (stats: FanpageStats) => {
    if (stats.total_sent === 0) return 0;
    return (stats.successful / stats.total_sent) * 100;
  };

  if (campaignLoading || statsLoading) {
    return (
      <AppLayout>
        <div className="text-center py-8">Loading campaign details...</div>
      </AppLayout>
    );
  }

  if (!campaign) {
    return (
      <AppLayout>
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">Campaign not found</p>
          <Button onClick={() => navigate("/campaigns")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Campaigns
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/campaigns")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{campaign.name}</h1>
              <Badge variant="secondary" className={getStatusColor(campaign.status)}>
                {campaign.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">Campaign details and performance breakdown</p>
          </div>
        </div>

        {/* Overall Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Overall Performance</CardTitle>
            <CardDescription>
              {campaign.total_recipients.toLocaleString()} total recipients
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">
                  {campaign.processed.toLocaleString()} / {campaign.total_recipients.toLocaleString()}
                </span>
              </div>
              <Progress value={getProgress()} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-green-500/10">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Check className="h-4 w-4 text-green-600" />
                  <div className="text-2xl font-bold text-green-600">
                    {campaign.delivered.toLocaleString()}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">Delivered</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-blue-500/10">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Send className="h-4 w-4 text-blue-600" />
                  <div className="text-2xl font-bold text-blue-600">
                    {(campaign.processed - campaign.delivered - campaign.failed).toLocaleString()}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">Processing</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-red-500/10">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <X className="h-4 w-4 text-red-600" />
                  <div className="text-2xl font-bold text-red-600">
                    {campaign.failed.toLocaleString()}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fanpage Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Breakdown by Fanpage</CardTitle>
            <CardDescription>
              Messages sent to each fanpage
            </CardDescription>
          </CardHeader>
          <CardContent>
            {fanpageStats.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No send results yet
              </div>
            ) : (
              <div className="space-y-4">
                {fanpageStats
                  .sort((a, b) => b.total_sent - a.total_sent)
                  .map((stats) => (
                    <div key={stats.page_id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">{stats.fanpage_name || stats.page_id}</h3>
                          <p className="text-sm text-muted-foreground">
                            {stats.total_sent.toLocaleString()} messages sent
                          </p>
                        </div>
                        <Badge variant={getSuccessRate(stats) >= 95 ? "default" : "destructive"}>
                          {getSuccessRate(stats).toFixed(1)}% success
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center justify-between p-3 rounded-md bg-green-500/10">
                          <span className="text-sm text-muted-foreground">Successful</span>
                          <span className="font-semibold text-green-600">
                            {stats.successful.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-md bg-red-500/10">
                          <span className="text-sm text-muted-foreground">Failed</span>
                          <span className="font-semibold text-red-600">
                            {stats.failed.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default CampaignDetails;
