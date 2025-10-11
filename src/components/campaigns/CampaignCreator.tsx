import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CampaignCreatorProps {
  onClose: () => void;
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

  const { data: fanpages = [] } = useQuery({
    queryKey: ["fanpages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fanpages").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: apps = [] } = useQuery({
    queryKey: ["apps"],
    queryFn: async () => {
      const { data, error } = await supabase.from("apps").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: pacingProfiles = [] } = useQuery({
    queryKey: ["pacing-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pacing_profiles").select("*");
      if (error) throw error;
      return data;
    },
  });

  const createCampaignMutation = useMutation({
    mutationFn: async () => {
      if (!campaignName || selectedFanpages.length === 0 || !messageText) {
        throw new Error("Please fill in all required fields");
      }

      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .insert({
          name: campaignName,
          status: "draft",
          active_app_key: selectedApp || null,
          pacing_profile_id: selectedPacingProfile || null,
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Link fanpages
      const fanpageLinks = selectedFanpages.map((pageId) => ({
        campaign_id: campaign.id,
        page_id: pageId,
      }));

      const { error: linkError } = await supabase
        .from("campaign_fanpages")
        .insert(fanpageLinks);

      if (linkError) throw linkError;

      // Create message
      const messageArgs = messageType === "text" 
        ? { text: messageText }
        : { attachment: { type: "image", payload: { url: imageUrl } }, text: messageText };

      const { error: messageError } = await supabase
        .from("messages")
        .insert({
          campaign_id: campaign.id,
          type: messageType,
          arguments: messageArgs,
        });

      if (messageError) throw messageError;

      return campaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campaign created successfully");
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const toggleFanpage = (pageId: string) => {
    setSelectedFanpages((prev) =>
      prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId]
    );
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="campaign-name">Campaign Name</Label>
          <Input
            id="campaign-name"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            placeholder="Summer Sale 2025"
          />
        </div>

        <div>
          <Label>Select Fanpages ({selectedFanpages.length} selected)</Label>
          <Card className="mt-2">
            <CardContent className="p-4 max-h-48 overflow-y-auto">
              {fanpages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No fanpages available</p>
              ) : (
                <div className="space-y-2">
                  {fanpages.map((page: any) => (
                    <div key={page.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedFanpages.includes(page.page_id)}
                        onCheckedChange={() => toggleFanpage(page.page_id)}
                      />
                      <label className="text-sm cursor-pointer">
                        {page.name} ({page.conversations.toLocaleString()} conversations)
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
            <Label htmlFor="app-select">App (optional)</Label>
            <Select value={selectedApp} onValueChange={setSelectedApp}>
              <SelectTrigger>
                <SelectValue placeholder="Use default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Use default app</SelectItem>
                {apps.map((app: any) => (
                  <SelectItem key={app.id} value={app.key}>
                    {app.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="pacing-select">Pacing Profile (optional)</Label>
            <Select value={selectedPacingProfile} onValueChange={setSelectedPacingProfile}>
              <SelectTrigger>
                <SelectValue placeholder="Use default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Default pacing</SelectItem>
                {pacingProfiles.map((profile: any) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Message Content</Label>
          <Tabs value={messageType} onValueChange={(v) => setMessageType(v as "text" | "image")} className="mt-2">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="text">Text Message</TabsTrigger>
              <TabsTrigger value="image">Image Message</TabsTrigger>
            </TabsList>
            <TabsContent value="text" className="space-y-2">
              <Textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Enter your message here..."
                rows={6}
              />
            </TabsContent>
            <TabsContent value="image" className="space-y-2">
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
              <Textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Optional caption..."
                rows={3}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => createCampaignMutation.mutate()} disabled={createCampaignMutation.isPending}>
          Create Campaign
        </Button>
      </div>
    </div>
  );
};

export default CampaignCreator;
