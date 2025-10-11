import { useQuery, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { UserPlus, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
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

interface App {
  id: string;
  key: string;
  name: string;
  fb_app_id: string;
}

interface Account {
  id: string;
  fb_user_id: string;
  name: string;
  photo_url: string;
  app_key: string;
  created_at: string;
}

const Accounts = () => {
  const [selectedApp, setSelectedApp] = useState<string>("");
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Handle OAuth callback errors
  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      toast.error(`Connection failed: ${error}`);
      // Clear error from URL
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const { data: apps = [] } = useQuery({
    queryKey: ["apps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("apps")
        .select("*")
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data as App[];
    },
  });

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Account[];
    },
  });

  const handleConnect = async () => {
    if (!selectedApp) {
      toast.error("Please select an app first");
      return;
    }

    const app = apps.find((a) => a.key === selectedApp);
    if (!app) return;

    try {
      // Call edge function to get OAuth URL
      const { data, error } = await supabase.functions.invoke('oauth-callback', {
        body: { 
          action: 'get-auth-url',
          app_key: selectedApp,
          fb_app_id: app.fb_app_id 
        }
      });

      if (error) throw error;
      if (data?.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error('No auth URL returned');
      }
    } catch (error: any) {
      console.error('OAuth error:', error);
      toast.error(`Failed to start OAuth: ${error.message}`);
    }
  };

  const handleDeleteAccount = async (accountId: string, accountName: string) => {
    try {
      const { error } = await supabase
        .from("accounts")
        .delete()
        .eq("id", accountId);

      if (error) throw error;

      toast.success(`Account "${accountName}" deleted successfully`);
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["fanpages"] });
    } catch (error: any) {
      console.error("Delete account error:", error);
      toast.error(error.message || "Failed to delete account");
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Facebook Accounts</h1>
          <p className="text-muted-foreground">Connect Facebook accounts to access their fanpages</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Connect New Account</CardTitle>
            <CardDescription>
              Select which app to use for connecting your Facebook account
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Select value={selectedApp} onValueChange={setSelectedApp}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select an app" />
              </SelectTrigger>
              <SelectContent>
                {apps.map((app) => (
                  <SelectItem key={app.id} value={app.key}>
                    {app.name} ({app.key})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleConnect} disabled={!selectedApp}>
              <UserPlus className="mr-2 h-4 w-4" />
              Connect Account
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Connected Accounts</h2>
          {isLoading ? (
            <div className="text-center py-8">Loading accounts...</div>
          ) : accounts.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No accounts connected yet. Connect your first Facebook account above.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {accounts.map((account) => (
                <Card key={account.id}>
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <Avatar>
                        <AvatarImage src={account.photo_url} />
                        <AvatarFallback>{account.name?.[0] || "U"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <CardTitle className="text-base">{account.name}</CardTitle>
                        <CardDescription className="text-xs">
                          FB ID: {account.fb_user_id}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Connected via:</span>
                        <Badge variant="secondary">{account.app_key}</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" asChild>
                          <a href={`https://facebook.com/${account.fb_user_id}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            View on Facebook
                          </a>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Account</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{account.name}"? This will also remove all associated fanpages and data. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDeleteAccount(account.id, account.name)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Accounts;
