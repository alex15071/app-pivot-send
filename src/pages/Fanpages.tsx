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

interface Fanpage {
  id: string;
  page_id: string;
  name: string;
  image_url: string;
  conversations: number;
  active_app_key: string;
  created_at: string;
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
      return data as Fanpage[];
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
    
    toast.info(`Starting harvest for ${pageName}...`);
    
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

      const { data, error } = await supabase.functions.invoke("harvest-conversations", {
        body: { page_id: pageId },
      });
      
      clearInterval(progressInterval);
      
      if (error) throw error;
      
      // Final update
      const finalCount = data?.count || 0;
      setHarvestProgress(finalCount);
      setHarvestTotal(finalCount);
      toast.success(`Harvest completed! Found ${finalCount} conversations`);
      refetch();
      
      // Keep dialog open for 2 seconds to show final count
      setTimeout(() => {
        setShowHarvestDialog(false);
        setHarvestingPageId(null);
      }, 2000);
    } catch (error: any) {
      setShowHarvestDialog(false);
      setHarvestingPageId(null);
      toast.error(error.message || "Failed to harvest conversations");
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
                        {page.conversations.toLocaleString()} conversations
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Active App:</span>
                    <Badge variant="secondary">{page.active_app_key}</Badge>
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
              Please wait while we collect conversations from Facebook...
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
                    ? "Starting harvest... This may take a while for large fanpages." 
                    : "Scanning conversations in real-time..."}
                </span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Fanpages;
