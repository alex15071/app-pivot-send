import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Play, Pause, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import CampaignCreator from "@/components/campaigns/CampaignCreator";

interface Campaign {
  id: string;
  name: string;
  status: string;
  total_recipients: number;
  processed: number;
  delivered: number;
  failed: number;
  created_at: string;
}

const Campaigns = () => {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Campaign[];
    },
    refetchInterval: 5000, // Real-time updates every 5s
  });

  const startCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const { error } = await supabase.functions.invoke("campaign-control", {
        body: { action: "start", campaign_id: campaignId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campaign started");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const pauseCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const { error } = await supabase.functions.invoke("campaign-control", {
        body: { action: "pause", campaign_id: campaignId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campaign paused");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running": return "bg-green-500";
      case "paused": return "bg-yellow-500";
      case "finished": return "bg-blue-500";
      default: return "bg-gray-500";
    }
  };

  const getProgress = (campaign: Campaign) => {
    if (campaign.total_recipients === 0) return 0;
    return (campaign.processed / campaign.total_recipients) * 100;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Campaigns</h1>
            <p className="text-muted-foreground">Create and manage broadcast campaigns</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Campaign</DialogTitle>
                <DialogDescription>
                  Select fanpages, compose messages, and configure sending parameters
                </DialogDescription>
              </DialogHeader>
              <CampaignCreator onClose={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No campaigns yet. Create your first campaign to start sending messages.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <Card key={campaign.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <CardTitle>{campaign.name}</CardTitle>
                        <Badge variant="secondary" className={getStatusColor(campaign.status)}>
                          {campaign.status}
                        </Badge>
                      </div>
                      <CardDescription className="mt-2">
                        {campaign.total_recipients.toLocaleString()} recipients
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {campaign.status === "draft" || campaign.status === "paused" ? (
                        <Button
                          size="sm"
                          onClick={() => startCampaignMutation.mutate(campaign.id)}
                          disabled={startCampaignMutation.isPending}
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Start
                        </Button>
                      ) : campaign.status === "running" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => pauseCampaignMutation.mutate(campaign.id)}
                          disabled={pauseCampaignMutation.isPending}
                        >
                          <Pause className="mr-2 h-4 w-4" />
                          Pause
                        </Button>
                      ) : null}
                      <Button size="sm" variant="ghost">
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">
                        {campaign.processed.toLocaleString()} / {campaign.total_recipients.toLocaleString()}
                      </span>
                    </div>
                    <Progress value={getProgress(campaign)} />
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center p-3 rounded-lg bg-green-500/10">
                      <div className="text-2xl font-bold text-green-600">{campaign.delivered.toLocaleString()}</div>
                      <div className="text-muted-foreground">Delivered</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-blue-500/10">
                      <div className="text-2xl font-bold text-blue-600">
                        {(campaign.processed - campaign.delivered - campaign.failed).toLocaleString()}
                      </div>
                      <div className="text-muted-foreground">Processing</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-red-500/10">
                      <div className="text-2xl font-bold text-red-600">{campaign.failed.toLocaleString()}</div>
                      <div className="text-muted-foreground">Failed</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Campaigns;
