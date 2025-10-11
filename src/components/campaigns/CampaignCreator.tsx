import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

interface CampaignCreatorProps {
  onClose: () => void;
}

interface Fanpage {
  id: string;
  page_id: string;
  name: string;
  conversations: number | null;
  image_url: string | null;
}

interface App {
  id: string;
  key: string;
  name: string;
  fb_app_id: string;
}

interface PacingProfile {
  id: string;
  name: string;
}

const CampaignCreator = ({ onClose }: CampaignCreatorProps) => {
  const [campaignName, setCampaignName] = useState("");
  const [selectedFanpages, setSelectedFanpages] = useState<string[]>([]);
  const [selectedApp, setSelectedApp] = useState("");
  const [selectedPacingProfile, setSelectedPacingProfile] = useState("");
  const [messageType, setMessageType] = useState<"text" | "image">("text");
  const [messageText, setMessageText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const queryClient = useQueryClient();

  const { data: fanpages = [], isLoading: loadingFanpages } = useQuery<Fanpage[]>({
    queryKey: ["fanpages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fanpages")
        .select("*")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: apps = [], isLoading: loadingApps } = useQuery<App[]>({
    queryKey: ["apps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("apps")
        .select("*")
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: pacingProfiles = [], isLoading: loadingProfiles } = useQuery<PacingProfile[]>({
    queryKey: ["pacing-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pacing_profiles")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const isLoadingData = loadingFanpages || loadingApps || loadingProfiles;

  const validateForm = (): string | null => {
    if (!campaignName.trim()) {
      return "Please enter a campaign name";
    }
    if (selectedFanpages.length === 0) {
      return "Please select at least one fanpage";
    }
    if (!messageText.trim()) {
      return "Please enter a message";
    }
    if (messageType === "image" && !imageUrl.trim()) {
      return "Please enter an image URL";
    }
    return null;
  };

  const createCampaignMutation = useMutation({
    mutationFn: async () => {
      const validationError = validateForm();
      if (validationError) {
        throw new Error(validationError);
      }

      // Step 1: Create campaign
      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .insert({
          name: campaignName.trim(),
          status: "draft",
          active_app_key: selectedApp || null,
          pacing_profile_id: selectedPacingProfile || null,
          total_recipients: 0,
          processed: 0,
          delivered: 0,
          failed: 0,
        })
        .select()
        .single();

      if (campaignError) {
        console.error("Campaign creation error:", campaignError);
        throw new Error(`Failed to create campaign: ${campaignError.message}`);
      }

      // Step 2: Link fanpages to campaign
      const fanpageLinks = selectedFanpages.map((pageId) => ({
        campaign_id: campaign.id,
        page_id: pageId,
      }));

      const { error: linkError } = await supabase
        .from("campaign_fanpages")
        .insert(fanpageLinks);

      if (linkError) {
        console.error("Fanpage link error:", linkError);
        // Try to clean up the campaign
        await supabase.from("campaigns").delete().eq("id", campaign.id);
        throw new Error(`Failed to link fanpages: ${linkError.message}`);
      }

      // Step 3: Create message
      const messageArgs = messageType === "text" 
        ? { text: messageText.trim() }
        : { 
            attachment: { 
              type: "image", 
              payload: { url: imageUrl.trim() } 
            }, 
            text: messageText.trim() 
          };

      const { error: messageError } = await supabase
        .from("messages")
        .insert({
          campaign_id: campaign.id,
          type: messageType,
          arguments: messageArgs,
          sent: 0,
        });

      if (messageError) {
        console.error("Message creation error:", messageError);
        // Try to clean up
        await supabase.from("campaign_fanpages").delete().eq("campaign_id", campaign.id);
        await supabase.from("campaigns").delete().eq("id", campaign.id);
        throw new Error(`Failed to create message: ${messageError.message}`);
      }

      return campaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campaign created successfully!");
      onClose();
    },
    onError: (error: Error) => {
      console.error("Campaign creation failed:", error);
      toast.error(error.message || "Failed to create campaign");
    },
  });

  const toggleFanpage = (pageId: string) => {
    setSelectedFanpages((prev) =>
      prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId]
    );
  };

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading campaign data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="campaign-name">
            Campaign Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="campaign-name"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            placeholder="e.g., Summer Sale 2025"
            disabled={createCampaignMutation.isPending}
          />
        </div>

        <div>
          <Label>
            Select Fanpages <span className="text-destructive">*</span>
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({selectedFanpages.length} selected)
            </span>
          </Label>
          <Card className="mt-2">
            <CardContent className="p-4 max-h-64 overflow-y-auto">
              {fanpages.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">
                    No fanpages available. Please connect a fanpage first.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {fanpages.map((page) => (
                    <div 
                      key={page.id} 
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors"
                    >
                      <Checkbox
                        id={`fanpage-${page.id}`}
                        checked={selectedFanpages.includes(page.page_id)}
                        onCheckedChange={() => toggleFanpage(page.page_id)}
                        disabled={createCampaignMutation.isPending}
                      />
                      {page.image_url && (
                        <img 
                          src={page.image_url} 
                          alt={page.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      )}
                      <label 
                        htmlFor={`fanpage-${page.id}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        <span className="font-medium">{page.name}</span>
                        <span className="text-muted-foreground ml-2">
                          ({(page.conversations || 0).toLocaleString()} conversations)
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="app-select">App</Label>
            <Select 
              value={selectedApp} 
              onValueChange={setSelectedApp}
              disabled={createCampaignMutation.isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Use default app" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Use default app</SelectItem>
                {apps.map((app) => (
                  <SelectItem key={app.id} value={app.key}>
                    {app.name} ({app.key})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="pacing-select">Pacing Profile</Label>
            <Select 
              value={selectedPacingProfile} 
              onValueChange={setSelectedPacingProfile}
              disabled={createCampaignMutation.isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Use default pacing" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Default pacing</SelectItem>
                {pacingProfiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>
            Message Content <span className="text-destructive">*</span>
          </Label>
          <Tabs 
            value={messageType} 
            onValueChange={(v) => setMessageType(v as "text" | "image")} 
            className="mt-2"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="text" disabled={createCampaignMutation.isPending}>
                Text Message
              </TabsTrigger>
              <TabsTrigger value="image" disabled={createCampaignMutation.isPending}>
                Image Message
              </TabsTrigger>
            </TabsList>
            <TabsContent value="text" className="space-y-2 mt-4">
              <Textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Enter your message here..."
                rows={6}
                disabled={createCampaignMutation.isPending}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {messageText.length} characters
              </p>
            </TabsContent>
            <TabsContent value="image" className="space-y-3 mt-4">
              <div>
                <Label htmlFor="image-url" className="text-sm">
                  Image URL <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="image-url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  disabled={createCampaignMutation.isPending}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="image-caption" className="text-sm">
                  Caption (optional)
                </Label>
                <Textarea
                  id="image-caption"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Add a caption to your image..."
                  rows={3}
                  disabled={createCampaignMutation.isPending}
                  className="resize-none mt-1"
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button 
          variant="outline" 
          onClick={onClose}
          disabled={createCampaignMutation.isPending}
        >
          Cancel
        </Button>
        <Button 
          onClick={() => createCampaignMutation.mutate()} 
          disabled={createCampaignMutation.isPending || fanpages.length === 0}
        >
          {createCampaignMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            "Create Campaign"
          )}
        </Button>
      </div>
    </div>
  );
};

export default CampaignCreator;
