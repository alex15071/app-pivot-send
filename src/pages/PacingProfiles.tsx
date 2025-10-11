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
import { Plus, Gauge, Edit2, Trash2 } from "lucide-react";

interface PacingProfile {
  id: string;
  name: string;
  batch_size: number;
  parallel_batches: number;
  sleep_between_pools_sec: number;
  jitter_pct: number;
  error_ratio_threshold: number;
  cooldown_on_error_sec: number;
  max_retries_per_pool: number;
  backoff_multiplier: number;
  created_at: string;
}

const PacingProfiles = () => {
  const [open, setOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<PacingProfile | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    batch_size: 50,
    parallel_batches: 3,
    sleep_between_pools_sec: 3,
    jitter_pct: 30,
    error_ratio_threshold: 12,
    cooldown_on_error_sec: 20,
    max_retries_per_pool: 2,
    backoff_multiplier: 2,
  });
  const queryClient = useQueryClient();

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["pacing-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pacing_profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PacingProfile[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: result, error } = await supabase
        .from("pacing_profiles")
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pacing-profiles"] });
      toast.success("Pacing profile created");
      setOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { data: result, error } = await supabase
        .from("pacing_profiles")
        .update(data)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pacing-profiles"] });
      toast.success("Pacing profile updated");
      setOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pacing_profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pacing-profiles"] });
      toast.success("Pacing profile deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      batch_size: 50,
      parallel_batches: 3,
      sleep_between_pools_sec: 3,
      jitter_pct: 30,
      error_ratio_threshold: 12,
      cooldown_on_error_sec: 20,
      max_retries_per_pool: 2,
      backoff_multiplier: 2,
    });
    setEditingProfile(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProfile) {
      updateMutation.mutate({ id: editingProfile.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (profile: PacingProfile) => {
    setEditingProfile(profile);
    setFormData({
      name: profile.name,
      batch_size: profile.batch_size,
      parallel_batches: profile.parallel_batches,
      sleep_between_pools_sec: Number(profile.sleep_between_pools_sec),
      jitter_pct: Number(profile.jitter_pct),
      error_ratio_threshold: Number(profile.error_ratio_threshold),
      cooldown_on_error_sec: profile.cooldown_on_error_sec,
      max_retries_per_pool: profile.max_retries_per_pool,
      backoff_multiplier: Number(profile.backoff_multiplier),
    });
    setOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Pacing Profiles</h1>
            <p className="text-muted-foreground">Configure rate limiting and adaptive backoff strategies</p>
          </div>
          <Dialog open={open} onOpenChange={(isOpen) => {
            setOpen(isOpen);
            if (!isOpen) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Profile
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProfile ? "Edit Profile" : "Create Pacing Profile"}</DialogTitle>
                <DialogDescription>
                  Configure batch sizes, concurrency, and error handling
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Profile Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Conservative"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="batch_size">Batch Size</Label>
                    <Input
                      id="batch_size"
                      type="number"
                      min="1"
                      max="50"
                      value={formData.batch_size}
                      onChange={(e) => setFormData({ ...formData, batch_size: parseInt(e.target.value) })}
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">Max 50 requests per batch</p>
                  </div>
                  <div>
                    <Label htmlFor="parallel_batches">Parallel Batches</Label>
                    <Input
                      id="parallel_batches"
                      type="number"
                      min="1"
                      max="10"
                      value={formData.parallel_batches}
                      onChange={(e) => setFormData({ ...formData, parallel_batches: parseInt(e.target.value) })}
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">Concurrent batches</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="sleep_between_pools_sec">Sleep Between Pools (sec)</Label>
                    <Input
                      id="sleep_between_pools_sec"
                      type="number"
                      step="0.1"
                      min="0"
                      value={formData.sleep_between_pools_sec}
                      onChange={(e) => setFormData({ ...formData, sleep_between_pools_sec: parseFloat(e.target.value) })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="jitter_pct">Jitter (%)</Label>
                    <Input
                      id="jitter_pct"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.jitter_pct}
                      onChange={(e) => setFormData({ ...formData, jitter_pct: parseFloat(e.target.value) })}
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">±% variation</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="error_ratio_threshold">Error Threshold (%)</Label>
                    <Input
                      id="error_ratio_threshold"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={formData.error_ratio_threshold}
                      onChange={(e) => setFormData({ ...formData, error_ratio_threshold: parseFloat(e.target.value) })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="cooldown_on_error_sec">Cooldown on Error (sec)</Label>
                    <Input
                      id="cooldown_on_error_sec"
                      type="number"
                      min="0"
                      value={formData.cooldown_on_error_sec}
                      onChange={(e) => setFormData({ ...formData, cooldown_on_error_sec: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="max_retries_per_pool">Max Retries Per Pool</Label>
                    <Input
                      id="max_retries_per_pool"
                      type="number"
                      min="0"
                      max="5"
                      value={formData.max_retries_per_pool}
                      onChange={(e) => setFormData({ ...formData, max_retries_per_pool: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="backoff_multiplier">Backoff Multiplier</Label>
                    <Input
                      id="backoff_multiplier"
                      type="number"
                      step="0.1"
                      min="1"
                      value={formData.backoff_multiplier}
                      onChange={(e) => setFormData({ ...formData, backoff_multiplier: parseFloat(e.target.value) })}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingProfile ? "Update Profile" : "Create Profile"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-8">Loading profiles...</div>
        ) : profiles.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No pacing profiles yet. Create your first profile to control sending rates.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {profiles.map((profile) => (
              <Card key={profile.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <Gauge className="h-5 w-5 text-primary" />
                      <CardTitle>{profile.name}</CardTitle>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(profile)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("Delete this profile?")) {
                            deleteMutation.mutate(profile.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Batch Size:</span>
                      <span className="ml-2 font-medium">{profile.batch_size}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Parallel:</span>
                      <span className="ml-2 font-medium">{profile.parallel_batches}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Sleep:</span>
                      <span className="ml-2 font-medium">{profile.sleep_between_pools_sec}s</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Jitter:</span>
                      <span className="ml-2 font-medium">±{profile.jitter_pct}%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Error Threshold:</span>
                      <span className="ml-2 font-medium">{profile.error_ratio_threshold}%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cooldown:</span>
                      <span className="ml-2 font-medium">{profile.cooldown_on_error_sec}s</span>
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

export default PacingProfiles;
