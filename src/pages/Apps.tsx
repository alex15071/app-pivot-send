import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Star, Trash2, Edit2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface App {
  id: string;
  key: string;
  name: string;
  fb_app_id: string;
  is_default: boolean;
  created_at: string;
}

const Apps = () => {
  const [open, setOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<App | null>(null);
  const [formData, setFormData] = useState({
    key: "",
    name: "",
    fb_app_id: "",
    fb_app_secret: "",
  });
  const queryClient = useQueryClient();

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["apps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("apps")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as App[];
    },
  });

  const createAppMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: result, error } = await supabase.functions.invoke("manage-apps", {
        body: { action: "create", ...data },
      });
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apps"] });
      toast.success("App created successfully");
      setOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateAppMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof formData> }) => {
      const { data: result, error } = await supabase.functions.invoke("manage-apps", {
        body: { action: "update", id, ...data },
      });
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apps"] });
      toast.success("App updated successfully");
      setOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteAppMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("apps").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apps"] });
      toast.success("App deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: result, error } = await supabase.functions.invoke("manage-apps", {
        body: { action: "set_default", id },
      });
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apps"] });
      toast.success("Default app updated");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({ key: "", name: "", fb_app_id: "", fb_app_secret: "" });
    setEditingApp(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingApp) {
      updateAppMutation.mutate({ id: editingApp.id, data: formData });
    } else {
      createAppMutation.mutate(formData);
    }
  };

  const handleEdit = (app: App) => {
    setEditingApp(app);
    setFormData({
      key: app.key,
      name: app.name,
      fb_app_id: app.fb_app_id,
      fb_app_secret: "",
    });
    setOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Facebook Apps</h1>
            <p className="text-muted-foreground">Manage your Facebook app credentials for multi-app rotation</p>
          </div>
          <Dialog open={open} onOpenChange={(isOpen) => {
            setOpen(isOpen);
            if (!isOpen) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add App
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingApp ? "Edit App" : "Add New App"}</DialogTitle>
                <DialogDescription>
                  Configure a Facebook app for sending messages
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="key">App Key</Label>
                  <Input
                    id="key"
                    value={formData.key}
                    onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                    placeholder="app_a"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="name">Display Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="App A"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="fb_app_id">Facebook App ID</Label>
                  <Input
                    id="fb_app_id"
                    value={formData.fb_app_id}
                    onChange={(e) => setFormData({ ...formData, fb_app_id: e.target.value })}
                    placeholder="123456789012345"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="fb_app_secret">Facebook App Secret</Label>
                  <Input
                    id="fb_app_secret"
                    type="password"
                    value={formData.fb_app_secret}
                    onChange={(e) => setFormData({ ...formData, fb_app_secret: e.target.value })}
                    placeholder="••••••••••••••••"
                    required={!editingApp}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createAppMutation.isPending || updateAppMutation.isPending}>
                  {editingApp ? "Update App" : "Create App"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading apps...</div>
        ) : apps.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No apps configured yet. Add your first Facebook app to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {apps.map((app) => (
              <Card key={app.id} className={app.is_default ? "border-primary" : ""}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {app.name}
                        {app.is_default && (
                          <Badge variant="secondary" className="gap-1">
                            <Star className="h-3 w-3 fill-current" />
                            Default
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{app.key}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(app)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("Delete this app?")) {
                            deleteAppMutation.mutate(app.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">App ID: </span>
                      <span className="font-mono">{app.fb_app_id}</span>
                    </div>
                    {!app.is_default && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setDefaultMutation.mutate(app.id)}
                      >
                        Set as Default
                      </Button>
                    )}
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

export default Apps;
