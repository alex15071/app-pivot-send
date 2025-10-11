import { useQuery } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessagesSquare, RefreshCw, Settings } from "lucide-react";
import { toast } from "sonner";

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

  const handleHarvestConversations = async (pageId: string) => {
    toast.info("Starting conversation harvest...");
    try {
      const { data, error } = await supabase.functions.invoke("harvest-conversations", {
        body: { page_id: pageId },
      });
      
      if (error) throw error;
      
      toast.success(`Harvested ${data.count} conversations`);
      refetch();
    } catch (error: any) {
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
                      onClick={() => handleHarvestConversations(page.page_id)}
                    >
                      <RefreshCw className="mr-2 h-3 w-3" />
                      Harvest
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
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

export default Fanpages;
