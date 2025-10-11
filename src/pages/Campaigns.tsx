import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Play, Pause, BarChart3, Trash2, Edit, Copy, Trash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import CampaignCreator from "@/components/campaigns/CampaignCreator";
import { SequenceCreator } from "@/components/campaigns/SequenceCreator";

interface Campaign {
  id: string;
  name: string;
  status: string;
  total_recipients: number;
  processed: number;
  delivered: number;
  failed: number;
  created_at: string;
  current_offset?: number;
  is_sequence?: boolean;
  current_sequence_step?: number;
  current_page_stats?: Array<{
    page_id: string;
    page_name: string;
    processing: boolean;
  }>;
}

const Campaigns = () => {
  const [open, setOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [mode, setMode] = useState<'create' | 'edit' | 'duplicate'>('create');
  const [showSequenceCreator, setShowSequenceCreator] = useState(false);
  const [sequenceCampaign, setSequenceCampaign] = useState<Campaign | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(campaign => ({
        ...campaign,
        current_page_stats: campaign.current_page_stats as Campaign['current_page_stats']
      })) as Campaign[];
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

  const deleteCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      // Delete campaign_fanpages first
      await supabase.from("campaign_fanpages").delete().eq("campaign_id", campaignId);
      
      // Delete messages
      await supabase.from("messages").delete().eq("campaign_id", campaignId);
      
      // Delete send_results
      await supabase.from("send_results").delete().eq("campaign_id", campaignId);
      
      // Delete campaign
      const { error } = await supabase.from("campaigns").delete().eq("id", campaignId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campaign deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteAllCampaignsMutation = useMutation({
    mutationFn: async () => {
      // Get all campaign IDs
      const { data: allCampaigns } = await supabase.from("campaigns").select("id");
      if (!allCampaigns || allCampaigns.length === 0) return;
      
      const campaignIds = allCampaigns.map(c => c.id);
      
      // Delete all related data
      await supabase.from("campaign_fanpages").delete().in("campaign_id", campaignIds);
      await supabase.from("messages").delete().in("campaign_id", campaignIds);
      await supabase.from("send_results").delete().in("campaign_id", campaignIds);
      
      // Delete all campaigns
      const { error } = await supabase.from("campaigns").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("All campaigns deleted");
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
          <div className="flex gap-2">
            {campaigns.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash className="mr-2 h-4 w-4" />
                    Delete All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete All Campaigns</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete ALL {campaigns.length} campaigns? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => deleteAllCampaignsMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Dialog open={open} onOpenChange={(isOpen) => {
              setOpen(isOpen);
              if (!isOpen) {
                setEditingCampaign(null);
                setMode('create');
              }
            }}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setMode('create');
                  setEditingCampaign(null);
                }}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Campaign
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {mode === 'create' && 'Create New Campaign'}
                    {mode === 'edit' && 'Edit Campaign'}
                    {mode === 'duplicate' && 'Duplicate Campaign'}
                  </DialogTitle>
                  <DialogDescription>
                    Select fanpages, compose messages, and configure sending parameters
                  </DialogDescription>
                </DialogHeader>
                <CampaignCreator 
                  onClose={() => {
                    setOpen(false);
                    setEditingCampaign(null);
                    setMode('create');
                  }} 
                  campaign={editingCampaign}
                  mode={mode}
                />
              </DialogContent>
            </Dialog>
          </div>
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
              <Card key={campaign.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                <div onClick={() => navigate(`/campaigns/${campaign.id}`)}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <CardTitle>{campaign.name}</CardTitle>
                          <div className="flex gap-2">
                            <Badge variant="secondary" className={getStatusColor(campaign.status)}>
                              {campaign.status}
                            </Badge>
                            {campaign.is_sequence && (
                              <Badge variant="outline" className="bg-purple-500/10">
                                Secuencia {campaign.current_sequence_step || 0}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <CardDescription className="mt-2">
                          {campaign.total_recipients.toLocaleString()} recipients
                        </CardDescription>
                      </div>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        {campaign.status === "draft" || campaign.status === "paused" ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingCampaign(campaign);
                                setMode('edit');
                                setOpen(true);
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => startCampaignMutation.mutate(campaign.id)}
                              disabled={startCampaignMutation.isPending}
                            >
                              <Play className="mr-2 h-4 w-4" />
                              Start
                            </Button>
                          </>
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
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingCampaign(campaign);
                            setMode('duplicate');
                            setOpen(true);
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        {campaign.status === 'draft' && !campaign.is_sequence && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSequenceCampaign(campaign);
                              setShowSequenceCreator(true);
                            }}
                          >
                            Secuencia
                          </Button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{campaign.name}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteCampaignMutation.mutate(campaign.id)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
                    
                    {campaign.status === 'running' && campaign.current_page_stats && campaign.current_page_stats.length > 0 && (
                      <div className="pt-4 border-t">
                        <div className="text-sm font-medium mb-2">Currently Processing:</div>
                        <div className="flex flex-wrap gap-2">
                          {campaign.current_page_stats.map((page, idx) => (
                            <Badge key={idx} variant="outline" className="animate-pulse">
                              📄 {page.page_name}
                            </Badge>
                          ))}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          Offset: {campaign.current_offset?.toLocaleString() || 0}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showSequenceCreator} onOpenChange={setShowSequenceCreator}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear Secuencia de Mensajes</DialogTitle>
          </DialogHeader>
          {sequenceCampaign && (
            <SequenceCreator
              campaignId={sequenceCampaign.id}
              campaignName={sequenceCampaign.name}
              onClose={() => {
                setShowSequenceCreator(false);
                setSequenceCampaign(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Campaigns;
