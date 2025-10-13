import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, X, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import SequenceTimeline from "@/components/campaigns/SequenceTimeline";

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
  is_sequence?: boolean;
  current_sequence_step?: number;
}

interface FanpageStats {
  page_id: string;
  fanpage_name: string;
  image_url: string | null;
  total_sent: number;
  successful: number;
  failed: number;
}

interface FanpageMessageStats {
  page_id: string;
  fanpage_name: string;
  image_url: string | null;
  message_sequence_id: string;
  sequence_order: number;
  message_type: string;
  total_sent: number;
  successful: number;
  failed: number;
}

const CampaignDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: campaign, isLoading: campaignLoading, error: campaignError } = useQuery({
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
    refetchInterval: 30000, // Cambiado de 5s a 30s
    retry: 2,
    staleTime: 10000,
  });

  const { data: sequences = [], isLoading: sequencesLoading } = useQuery({
    queryKey: ["campaign-sequences", id],
    queryFn: async () => {
      if (!campaign?.is_sequence) return [];
      
      const { data, error } = await supabase
        .from("message_sequences")
        .select("*")
        .eq("campaign_id", id)
        .order("sequence_order");
      
      if (error) throw error;
      return data;
    },
    enabled: !!campaign?.is_sequence,
    refetchInterval: 30000, // Cambiado de 5s a 30s
    retry: 2,
  });

  const { data: fanpageMessageStats = [], isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ["campaign-fanpage-message-stats", id],
    queryFn: async () => {
      if (!campaign?.is_sequence) {
        const { data: sendResults } = await supabase
          .from("send_results")
          .select("page_id, http_code")
          .eq("campaign_id", id);

        if (!sendResults || sendResults.length === 0) return [];

        const grouped: Record<string, any> = {};
        sendResults.forEach((row: any) => {
          if (!grouped[row.page_id]) {
            grouped[row.page_id] = {
              page_id: row.page_id,
              total_sent: 0,
              successful: 0,
              failed: 0,
            };
          }
          grouped[row.page_id].total_sent++;
          if (row.http_code === 200) {
            grouped[row.page_id].successful++;
          } else {
            grouped[row.page_id].failed++;
          }
        });

        const pageIds = Object.keys(grouped);
        if (pageIds.length > 0) {
          const { data: fanpages } = await supabase
            .from("fanpages")
            .select("page_id, name, image_url")
            .in("page_id", pageIds);

          fanpages?.forEach((fp: any) => {
            if (grouped[fp.page_id]) {
              grouped[fp.page_id].fanpage_name = fp.name;
              grouped[fp.page_id].image_url = fp.image_url;
            }
          });
        }

        return Object.values(grouped) as FanpageStats[];
      }

      const { data: sendResults } = await supabase
        .from("send_results")
        .select("page_id, http_code, message_sequence_id")
        .eq("campaign_id", id);

      if (!sendResults || sendResults.length === 0) return [];

      const grouped: Record<string, Record<string, any>> = {};
      sendResults.forEach((row: any) => {
        if (!grouped[row.page_id]) {
          grouped[row.page_id] = {};
        }
        if (!grouped[row.page_id][row.message_sequence_id]) {
          grouped[row.page_id][row.message_sequence_id] = {
            page_id: row.page_id,
            message_sequence_id: row.message_sequence_id,
            total_sent: 0,
            successful: 0,
            failed: 0,
          };
        }
        grouped[row.page_id][row.message_sequence_id].total_sent++;
        if (row.http_code === 200) {
          grouped[row.page_id][row.message_sequence_id].successful++;
        } else {
          grouped[row.page_id][row.message_sequence_id].failed++;
        }
      });

      const flattened: FanpageMessageStats[] = [];
      for (const pageId of Object.keys(grouped)) {
        for (const msgSeqId of Object.keys(grouped[pageId])) {
          flattened.push(grouped[pageId][msgSeqId]);
        }
      }

      const pageIds = Object.keys(grouped);
      if (pageIds.length > 0) {
        const { data: fanpages } = await supabase
          .from("fanpages")
          .select("page_id, name, image_url")
          .in("page_id", pageIds);

        fanpages?.forEach((fp: any) => {
          flattened
            .filter(stat => stat.page_id === fp.page_id)
            .forEach(stat => {
              stat.fanpage_name = fp.name;
              stat.image_url = fp.image_url;
            });
        });
      }

      const seqIds = [...new Set(flattened.map(s => s.message_sequence_id))];
      if (seqIds.length > 0) {
        const { data: sequences } = await supabase
          .from("message_sequences")
          .select("id, sequence_order, message_type")
          .in("id", seqIds);

        sequences?.forEach((seq: any) => {
          flattened
            .filter(stat => stat.message_sequence_id === seq.id)
            .forEach(stat => {
              stat.sequence_order = seq.sequence_order;
              stat.message_type = seq.message_type;
            });
        });
      }

      return flattened;
    },
    enabled: !!id && !!campaign,
    refetchInterval: 30000,
    retry: 2,
    staleTime: 10000,
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
              {campaign.is_sequence && (
                <Badge variant="outline">
                  Secuencia {campaign.current_sequence_step || 0}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {campaign.is_sequence 
                ? "Secuencia de mensajes programados" 
                : "Campaign details and performance breakdown"}
            </p>
          </div>
        </div>

        {/* Sequence Timeline - Only for sequence campaigns */}
        {campaign.is_sequence && sequences.length > 0 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Secuencia de Mensajes</h2>
              <p className="text-sm text-muted-foreground">
                Mensajes programados y su estado de envío
              </p>
            </div>
            <SequenceTimeline sequences={sequences} />
          </div>
        )}

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
              {campaign.is_sequence 
                ? "Messages sent per fanpage, grouped by sequence message"
                : "Messages sent to each fanpage"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {fanpageMessageStats.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No send results yet
              </div>
            ) : campaign.is_sequence ? (
              // Sequence campaigns: Group by fanpage, then by message
              <div className="space-y-6">
                {(() => {
                  // Group stats by page_id
                  const groupedByPage: Record<string, FanpageMessageStats[]> = {};
                  (fanpageMessageStats as FanpageMessageStats[]).forEach(stat => {
                    if (!groupedByPage[stat.page_id]) {
                      groupedByPage[stat.page_id] = [];
                    }
                    groupedByPage[stat.page_id].push(stat);
                  });

                  return Object.entries(groupedByPage)
                    .sort(([, a], [, b]) => {
                      const totalA = a.reduce((sum, s) => sum + s.total_sent, 0);
                      const totalB = b.reduce((sum, s) => sum + s.total_sent, 0);
                      return totalB - totalA;
                    })
                    .map(([pageId, pageStats]) => {
                      const totalSent = pageStats.reduce((sum, s) => sum + s.total_sent, 0);
                      const totalSuccessful = pageStats.reduce((sum, s) => sum + s.successful, 0);
                      const totalFailed = pageStats.reduce((sum, s) => sum + s.failed, 0);
                      const successRate = totalSent > 0 ? (totalSuccessful / totalSent) * 100 : 0;
                      const firstStat = pageStats[0];

                      return (
                        <div key={pageId} className="border rounded-lg p-4">
                          <div className="flex items-center gap-4 mb-4">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={firstStat.image_url || undefined} alt={firstStat.fanpage_name} />
                              <AvatarFallback>
                                {firstStat.fanpage_name?.charAt(0) || pageId.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <h3 className="font-semibold">{firstStat.fanpage_name || pageId}</h3>
                              <p className="text-sm text-muted-foreground">
                                {totalSent.toLocaleString()} total messages sent
                              </p>
                            </div>
                            <Badge variant={successRate >= 95 ? "default" : "destructive"}>
                              {successRate.toFixed(1)}% success
                            </Badge>
                          </div>
                          
                          {/* Messages breakdown */}
                          <div className="space-y-2 ml-16">
                            {pageStats
                              .sort((a, b) => a.sequence_order - b.sequence_order)
                              .map((msgStat) => (
                                <div key={msgStat.message_sequence_id} className="border-l-2 border-primary/20 pl-4 py-2">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-xs">
                                        Mensaje {msgStat.sequence_order}
                                      </Badge>
                                      <span className="text-sm text-muted-foreground">
                                        {msgStat.message_type === 'text' ? '📝 Texto' : '🖼️ Imagen'}
                                      </span>
                                    </div>
                                    <span className="text-sm font-medium">
                                      {msgStat.total_sent.toLocaleString()} enviados
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="flex items-center justify-between p-2 rounded-md bg-green-500/10">
                                      <span className="text-xs text-muted-foreground">Exitosos</span>
                                      <span className="text-sm font-semibold text-green-600">
                                        {msgStat.successful.toLocaleString()}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between p-2 rounded-md bg-red-500/10">
                                      <span className="text-xs text-muted-foreground">Fallidos</span>
                                      <span className="text-sm font-semibold text-red-600">
                                        {msgStat.failed.toLocaleString()}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      );
                    });
                })()}
              </div>
            ) : (
              // Non-sequence campaigns: Simple list
              <div className="space-y-4">
                {(fanpageMessageStats as FanpageStats[])
                  .sort((a, b) => b.total_sent - a.total_sent)
                  .map((stats) => (
                    <div key={stats.page_id} className="border rounded-lg p-4">
                      <div className="flex items-center gap-4 mb-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={stats.image_url || undefined} alt={stats.fanpage_name} />
                          <AvatarFallback>
                            {stats.fanpage_name?.charAt(0) || stats.page_id.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
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
