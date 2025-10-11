import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Copy } from "lucide-react";

interface CardData {
  id: string;
  title: string;
  subtitle: string;
  image_url: string;
  button_title: string;
  button_url: string;
}

interface BatchCardCreatorProps {
  onClose: () => void;
}

export function BatchCardCreator({ onClose }: BatchCardCreatorProps) {
  const queryClient = useQueryClient();
  const [campaignName, setCampaignName] = useState("");
  const [selectedFanpages, setSelectedFanpages] = useState<string[]>([]);
  const [selectedApp, setSelectedApp] = useState<string>("");
  const [selectedPacingProfile, setSelectedPacingProfile] = useState<string>("");
  const [delayMinutes, setDelayMinutes] = useState<number>(0);
  const [cards, setCards] = useState<CardData[]>([
    {
      id: crypto.randomUUID(),
      title: "",
      subtitle: "",
      image_url: "",
      button_title: "",
      button_url: "",
    },
  ]);

  // Template values for "Apply to All"
  const [templateCard, setTemplateCard] = useState<CardData>({
    id: "template",
    title: "",
    subtitle: "",
    image_url: "",
    button_title: "",
    button_url: "",
  });

  // Fetch fanpages
  const { data: fanpages = [] } = useQuery({
    queryKey: ["fanpages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fanpages")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch apps
  const { data: apps = [] } = useQuery({
    queryKey: ["apps"],
    queryFn: async () => {
      const { data, error } = await supabase.from("apps").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch pacing profiles
  const { data: pacingProfiles = [] } = useQuery({
    queryKey: ["pacing-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pacing_profiles").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const addCard = () => {
    if (cards.length >= 10) {
      toast.error("Máximo 10 cards por campaña (límite de Facebook)");
      return;
    }
    setCards([
      ...cards,
      {
        id: crypto.randomUUID(),
        title: "",
        subtitle: "",
        image_url: "",
        button_title: "",
        button_url: "",
      },
    ]);
  };

  const removeCard = (id: string) => {
    if (cards.length === 1) {
      toast.error("Debe haber al menos 1 card");
      return;
    }
    setCards(cards.filter((c) => c.id !== id));
  };

  const updateCard = (id: string, field: keyof CardData, value: string) => {
    setCards(cards.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const applyTemplateToAll = () => {
    setCards(
      cards.map((c) => ({
        ...c,
        title: templateCard.title || c.title,
        subtitle: templateCard.subtitle || c.subtitle,
        image_url: templateCard.image_url || c.image_url,
        button_title: templateCard.button_title || c.button_title,
        button_url: templateCard.button_url || c.button_url,
      }))
    );
    toast.success("Valores aplicados a todas las cards");
  };

  const createBatchMutation = useMutation({
    mutationFn: async () => {
      // Validations
      if (!campaignName.trim()) {
        throw new Error("El nombre de la campaña es requerido");
      }
      if (selectedFanpages.length === 0) {
        throw new Error("Selecciona al menos 1 fanpage");
      }
      for (const card of cards) {
        if (!card.title.trim()) {
          throw new Error("Todas las cards deben tener título");
        }
        if (!card.image_url.trim()) {
          throw new Error("Todas las cards deben tener imagen");
        }
        if (!card.button_url.trim()) {
          throw new Error("Todas las cards deben tener URL de botón");
        }
        if (!card.button_title.trim()) {
          throw new Error("Todas las cards deben tener texto de botón");
        }
      }

      // Calculate scheduled_at if delay is set
      let scheduledAt = null;
      if (delayMinutes > 0) {
        scheduledAt = new Date();
        scheduledAt.setMinutes(scheduledAt.getMinutes() + delayMinutes);
      }

      // Create campaign
      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .insert({
          name: campaignName.trim(),
          status: delayMinutes > 0 ? "scheduled" : "draft",
          active_app_key: selectedApp || null,
          pacing_profile_id: selectedPacingProfile || null,
          total_recipients: 0,
          processed: 0,
          delivered: 0,
          failed: 0,
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

      if (linkError) {
        await supabase.from("campaigns").delete().eq("id", campaign.id);
        throw linkError;
      }

      // Build message with multiple cards
      const elements = cards.map((card) => ({
        title: card.title.trim(),
        subtitle: card.subtitle.trim(),
        image_url: card.image_url.trim(),
        default_action: {
          type: "web_url",
          url: card.button_url.trim(),
        },
        buttons: [
          {
            type: "web_url",
            url: card.button_url.trim(),
            title: card.button_title.trim(),
          },
        ],
      }));

      const messageArgs = {
        attachment: {
          type: "template",
          payload: {
            template_type: "generic",
            elements,
          },
        },
      };

      const { error: messageError } = await supabase
        .from("messages")
        .insert({
          campaign_id: campaign.id,
          type: "generic",
          arguments: messageArgs as any,
          sent: 0,
        });

      if (messageError) {
        await supabase.from("campaign_fanpages").delete().eq("campaign_id", campaign.id);
        await supabase.from("campaigns").delete().eq("id", campaign.id);
        throw messageError;
      }
    },
    onSuccess: () => {
      toast.success("Campaña de cards creada exitosamente");
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al crear campaña");
    },
  });

  const toggleFanpage = (pageId: string) => {
    setSelectedFanpages((prev) =>
      prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId]
    );
  };

  const selectAllFanpages = () => {
    setSelectedFanpages(fanpages.map((f) => f.page_id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Crear Cards en Masa</h3>
        <p className="text-sm text-muted-foreground">
          Crea hasta 10 cards en un solo mensaje (límite de Facebook)
        </p>
      </div>

      {/* Campaign Name */}
      <div className="space-y-2">
        <Label>Nombre de Campaña *</Label>
        <Input
          value={campaignName}
          onChange={(e) => setCampaignName(e.target.value)}
          placeholder="ej: Promoción Verano 2025"
        />
      </div>

      {/* Fanpage Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Selecciona Fanpages * ({selectedFanpages.length} seleccionadas)</Label>
          <Button size="sm" variant="outline" onClick={selectAllFanpages}>
            Seleccionar Todas
          </Button>
        </div>
        <div className="border rounded-lg p-4 max-h-[200px] overflow-y-auto space-y-2">
          {fanpages.map((fanpage) => (
            <div key={fanpage.page_id} className="flex items-center space-x-2">
              <Checkbox
                checked={selectedFanpages.includes(fanpage.page_id)}
                onCheckedChange={() => toggleFanpage(fanpage.page_id)}
              />
              <img src={fanpage.image_url || ""} alt="" className="w-8 h-8 rounded-full" />
              <span className="text-sm">
                {fanpage.name} ({fanpage.conversations?.toLocaleString() || 0} conversaciones)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* App & Pacing Profile */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>App</Label>
          <Select value={selectedApp} onValueChange={setSelectedApp}>
            <SelectTrigger>
              <SelectValue placeholder="Usar app por defecto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Usar app por defecto</SelectItem>
              {apps.map((app) => (
                <SelectItem key={app.key} value={app.key}>
                  {app.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Pacing Profile</Label>
          <Select value={selectedPacingProfile} onValueChange={setSelectedPacingProfile}>
            <SelectTrigger>
              <SelectValue placeholder="Usar perfil por defecto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Usar perfil por defecto</SelectItem>
              {pacingProfiles.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Delay Minutes */}
      <div className="space-y-2">
        <Label>Programar envío (minutos desde ahora)</Label>
        <Input
          type="number"
          min="0"
          value={delayMinutes}
          onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 0)}
          placeholder="0 = enviar inmediatamente"
        />
        {delayMinutes > 0 && (
          <p className="text-xs text-muted-foreground">
            Se enviará en:{" "}
            {delayMinutes >= 1440
              ? `${(delayMinutes / 1440).toFixed(1)} días`
              : delayMinutes >= 60
              ? `${(delayMinutes / 60).toFixed(1)} horas`
              : `${delayMinutes} minutos`}
          </p>
        )}
      </div>

      {/* Template "Apply to All" Section */}
      <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Plantilla para Aplicar a Todas</Label>
          <Button size="sm" onClick={applyTemplateToAll}>
            <Copy className="h-4 w-4 mr-1" />
            Aplicar a Todas
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Configura valores aquí y aplícalos a todas las cards. Los campos vacíos no se aplicarán.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs">Título</Label>
            <Input
              value={templateCard.title}
              onChange={(e) => setTemplateCard({ ...templateCard, title: e.target.value })}
              placeholder="Título común"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Subtítulo</Label>
            <Input
              value={templateCard.subtitle}
              onChange={(e) => setTemplateCard({ ...templateCard, subtitle: e.target.value })}
              placeholder="Subtítulo común"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">URL de Imagen</Label>
            <Input
              value={templateCard.image_url}
              onChange={(e) => setTemplateCard({ ...templateCard, image_url: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Texto del Botón</Label>
            <Input
              value={templateCard.button_title}
              onChange={(e) => setTemplateCard({ ...templateCard, button_title: e.target.value })}
              placeholder="Ver más"
            />
          </div>
          <div className="space-y-2 col-span-2">
            <Label className="text-xs">URL del Botón</Label>
            <Input
              value={templateCard.button_url}
              onChange={(e) => setTemplateCard({ ...templateCard, button_url: e.target.value })}
              placeholder="https://..."
            />
          </div>
        </div>
      </div>

      {/* Cards List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Cards ({cards.length}/10)</Label>
          <Button size="sm" variant="outline" onClick={addCard} disabled={cards.length >= 10}>
            <Plus className="h-4 w-4 mr-1" />
            Agregar Card
          </Button>
        </div>

        <div className="space-y-4 max-h-[500px] overflow-y-auto">
          {cards.map((card, idx) => (
            <div key={card.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">Card {idx + 1}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeCard(card.id)}
                  disabled={cards.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Título *</Label>
                  <Input
                    value={card.title}
                    onChange={(e) => updateCard(card.id, "title", e.target.value)}
                    placeholder="Título de la card"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Subtítulo</Label>
                  <Input
                    value={card.subtitle}
                    onChange={(e) => updateCard(card.id, "subtitle", e.target.value)}
                    placeholder="Subtítulo"
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label className="text-xs">URL de Imagen *</Label>
                  <Input
                    value={card.image_url}
                    onChange={(e) => updateCard(card.id, "image_url", e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Texto del Botón *</Label>
                  <Input
                    value={card.button_title}
                    onChange={(e) => updateCard(card.id, "button_title", e.target.value)}
                    placeholder="Ver más"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">URL del Botón *</Label>
                  <Input
                    value={card.button_url}
                    onChange={(e) => updateCard(card.id, "button_url", e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>

              {/* Preview */}
              {card.image_url && (
                <div className="border rounded p-2 bg-muted/20">
                  <img
                    src={card.image_url}
                    alt={card.title}
                    className="w-full h-32 object-cover rounded mb-2"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <p className="text-sm font-medium">{card.title || "Sin título"}</p>
                  <p className="text-xs text-muted-foreground">{card.subtitle || "Sin subtítulo"}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={() => createBatchMutation.mutate()} disabled={createBatchMutation.isPending}>
          {createBatchMutation.isPending ? "Creando..." : "Crear Campaña"}
        </Button>
      </div>
    </div>
  );
}
