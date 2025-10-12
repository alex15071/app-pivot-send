import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessagesSquare, RefreshCw, Settings, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImportConversationsDialog } from "@/components/fanpages/ImportConversationsDialog";

interface Fanpage {
  id: string;
  page_id: string;
  name: string;
  image_url: string;
  conversations: number;
  actual_conversations?: number;
  active_app_key: string;
  created_at: string;
  connected_apps?: string[];
}

const Fanpages = () => {
  const queryClient = useQueryClient();
  const [harvestingPageId, setHarvestingPageId] = useState<string | null>(null);
  const [harvestProgress, setHarvestProgress] = useState(0);
  const [harvestTotal, setHarvestTotal] = useState(0);
  const [showHarvestDialog, setShowHarvestDialog] = useState(false);

  const { data: fanpages = [], isLoading, refetch } = useQuery({
    queryKey: ["fanpages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fanpages")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      // For each fanpage, get all connected apps and actual conversation count
      const fanpagesWithApps = await Promise.all(
        (data as Fanpage[]).map(async (page) => {
          const { data: tokens } = await supabase
            .from("fanpage_app_tokens")
            .select("app_key")
            .eq("page_id", page.page_id);
          
          // Get actual conversation count from fanpage_conversations
          const { count } = await supabase
            .from("fanpage_conversations")
            .select("*", { count: 'exact', head: true })
            .eq("page_id", page.page_id);
          
          return {
            ...page,
            connected_apps: tokens?.map(t => t.app_key) || [page.active_app_key],
            actual_conversations: count || 0,
          };
        })
      );
      
      return fanpagesWithApps;
    },
  });

  // Subscribe to fanpage_conversations changes for real-time updates
  useState(() => {
    const channel = supabase
      .channel('fanpage_conversations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fanpage_conversations'
        },
        () => {
          // Refetch fanpages when conversations change
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  });

  const syncConversationCountMutation = useMutation({
    mutationFn: async (pageId: string) => {
      // Get actual count from DB
      const { count } = await supabase
        .from("fanpage_conversations")
        .select("*", { count: 'exact', head: true })
        .eq("page_id", pageId);
      
      // Update fanpage
      const { error } = await supabase
        .from("fanpages")
        .update({ conversations: count || 0 })
        .eq("page_id", pageId);
      
      if (error) throw error;
      return count || 0;
    },
    onSuccess: (count) => {
      toast.success(`Count updated: ${count.toLocaleString()} conversations`);
      queryClient.invalidateQueries({ queryKey: ["fanpages"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to sync count");
    },
  });

  const deleteFanpageMutation = useMutation({
    mutationFn: async (fanpageId: string) => {
      const { error } = await supabase
        .from("fanpages")
        .delete()
        .eq("id", fanpageId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fanpage deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["fanpages"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete fanpage");
    },
  });

  const handleHarvestConversations = async (pageId: string, pageName: string) => {
    setHarvestingPageId(pageId);
    setHarvestProgress(0);
    setHarvestTotal(0);
    setShowHarvestDialog(true);
    
    toast.info(`Harvesting ${pageName} in background...`);
    
    try {
      // Poll for progress updates every second
      const progressInterval = setInterval(async () => {
        const { data: currentPage } = await supabase
          .from("fanpages")
          .select("conversations")
          .eq("page_id", pageId)
          .single();
        
        if (currentPage) {
          const count = currentPage.conversations || 0;
          setHarvestProgress(count);
          setHarvestTotal(count);
        }
      }, 1000);

      // Start harvest in background
      const { error } = await supabase.functions.invoke("harvest-conversations", {
        body: { page_id: pageId },
      });
      
      if (error) throw error;
      
      toast.success(`Harvest started! You can close this and it will continue in background.`);
      
      // Keep polling for 30 seconds then close dialog
      setTimeout(() => {
        clearInterval(progressInterval);
        setShowHarvestDialog(false);
        setHarvestingPageId(null);
        refetch();
      }, 30000);
    } catch (error: any) {
      setShowHarvestDialog(false);
      setHarvestingPageId(null);
      toast.error(error.message || "Failed to start harvest");
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Fanpages</h1>
          <p className="text-muted-foreground">Manage your Facebook fanpages and harvest conversations</p>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading fanpages...</div>
        ) : fanpages.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                No fanpages found. Connect a Facebook account first to import your fanpages.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {fanpages.map((page) => (
              <Card key={page.id}>
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={page.image_url} />
                      <AvatarFallback>{page.name?.[0] || "P"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <CardTitle className="text-base">{page.name}</CardTitle>
                      <CardDescription className="text-xs flex items-center gap-2 mt-1">
                        <MessagesSquare className="h-3 w-3" />
                        {page.actual_conversations?.toLocaleString() || 0} conversations
                        {page.actual_conversations !== page.conversations && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-5 px-1 text-yellow-600 hover:text-yellow-700"
                            onClick={() => syncConversationCountMutation.mutate(page.page_id)}
                            disabled={syncConversationCountMutation.isPending}
                            title="Count mismatch - click to sync"
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Connected Apps:</span>
                    <Badge variant="secondary">
                      {page.connected_apps?.join('+') || page.active_app_key}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Active App:</span>
                    <Badge variant="outline">{page.active_app_key}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Page ID:</span>
                    <code className="text-xs">{page.page_id}</code>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleHarvestConversations(page.page_id, page.name)}
                      disabled={harvestingPageId === page.page_id}
                    >
                      {harvestingPageId === page.page_id ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          Harvesting...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-3 w-3" />
                          Harvest
                        </>
                      )}
                    </Button>
                    <ImportConversationsDialog
                      pageId={page.page_id}
                      pageName={page.name}
                      onImportComplete={() => refetch()}
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          disabled={deleteFanpageMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Fanpage</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove "{page.name}"? This will not delete the page on Facebook, only remove it from this system.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => deleteFanpageMutation.mutate(page.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Harvest Progress Dialog */}
      <Dialog open={showHarvestDialog} onOpenChange={setShowHarvestDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Harvesting Conversations</DialogTitle>
            <DialogDescription>
              Running in background... You can close this dialog and the harvest will continue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Conversations found:</span>
                <span className="font-medium text-lg">
                  {harvestProgress.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  {harvestProgress === 0 
                    ? "Starting harvest..." 
                    : "Processing in background..."}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                The harvest will continue even if you close this dialog. The count will keep updating automatically.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Fanpages;
