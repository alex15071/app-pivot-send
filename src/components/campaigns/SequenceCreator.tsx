import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { CalendarIcon, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface SequenceMessage {
  id: string;
  type: 'text' | 'image' | 'text_button' | 'card';
  arguments: any;
  delay_minutes: number;
  sequence_order: number;
}

interface SequenceCreatorProps {
  campaignId: string;
  campaignName: string;
  onClose: () => void;
}

export function SequenceCreator({ campaignId, campaignName, onClose }: SequenceCreatorProps) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<SequenceMessage[]>([
    {
      id: crypto.randomUUID(),
      type: 'text',
      arguments: { text: '' },
      delay_minutes: 0,
      sequence_order: 1,
    },
  ]);
  const [startDate, setStartDate] = useState<Date>();
  const [startTime, setStartTime] = useState("09:00");

  const addMessage = () => {
    if (messages.length >= 30) {
      toast.error("Máximo 30 mensajes por secuencia");
      return;
    }

    const lastMessage = messages[messages.length - 1];
    setMessages([
      ...messages,
      {
        id: crypto.randomUUID(),
        type: 'text',
        arguments: { text: '' },
        delay_minutes: 1440, // 24 hours default
        sequence_order: lastMessage.sequence_order + 1,
      },
    ]);
  };

  const removeMessage = (id: string) => {
    if (messages.length === 1) {
      toast.error("Debe haber al menos 1 mensaje");
      return;
    }
    setMessages(messages.filter(m => m.id !== id).map((m, idx) => ({ ...m, sequence_order: idx + 1 })));
  };

  const updateMessage = (id: string, field: string, value: any) => {
    setMessages(messages.map(m => 
      m.id === id ? { ...m, [field]: value } : m
    ));
  };

  const updateMessageArgument = (id: string, field: string, value: any) => {
    setMessages(messages.map(m => 
      m.id === id 
        ? { ...m, arguments: { ...m.arguments, [field]: value } }
        : m
    ));
  };

  const createSequenceMutation = useMutation({
    mutationFn: async () => {
      if (!startDate) {
        throw new Error("Selecciona fecha de inicio");
      }

      const [hours, minutes] = startTime.split(':').map(Number);
      const startDateTime = new Date(startDate);
      startDateTime.setHours(hours, minutes, 0, 0);

      // Validate messages
      for (const msg of messages) {
        if (msg.type === 'text' && !msg.arguments.text?.trim()) {
          throw new Error(`Mensaje ${msg.sequence_order}: El texto está vacío`);
        }
        if (msg.sequence_order > 1 && msg.delay_minutes < 1) {
          throw new Error(`Mensaje ${msg.sequence_order}: Delay mínimo es 1 minuto`);
        }
      }

      // Update campaign to be a sequence
      const { error: campaignError } = await supabase
        .from('campaigns')
        .update({
          is_sequence: true,
          sequence_start_at: startDateTime.toISOString(),
          status: 'scheduled',
        })
        .eq('id', campaignId);

      if (campaignError) throw campaignError;

      // Calculate scheduled_for times
      let cumulativeMinutes = 0;
      const sequenceMessages = messages.map((msg, idx) => {
        const scheduledFor = new Date(startDateTime);
        scheduledFor.setMinutes(scheduledFor.getMinutes() + cumulativeMinutes);
        
        if (idx < messages.length - 1) {
          cumulativeMinutes += messages[idx + 1].delay_minutes;
        }

        return {
          campaign_id: campaignId,
          message_type: msg.type,
          message_arguments: msg.arguments,
          delay_minutes: msg.delay_minutes,
          sequence_order: msg.sequence_order,
          scheduled_for: scheduledFor.toISOString(),
          status: 'scheduled',
        };
      });

      // Insert all sequence messages
      const { error: insertError } = await supabase
        .from('message_sequences')
        .insert(sequenceMessages);

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      toast.success("Secuencia programada correctamente");
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error al crear secuencia");
    },
  });

  const calculateTimeline = () => {
    if (!startDate) return [];

    const [hours, minutes] = startTime.split(':').map(Number);
    const startDateTime = new Date(startDate);
    startDateTime.setHours(hours, minutes, 0, 0);

    let cumulativeMinutes = 0;
    return messages.map((msg, idx) => {
      const scheduledFor = new Date(startDateTime);
      scheduledFor.setMinutes(scheduledFor.getMinutes() + cumulativeMinutes);
      
      if (idx < messages.length - 1) {
        cumulativeMinutes += messages[idx + 1].delay_minutes;
      }

      return {
        order: msg.sequence_order,
        time: scheduledFor,
      };
    });
  };

  const timeline = calculateTimeline();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Crear Secuencia para: {campaignName}</h3>
        <p className="text-sm text-muted-foreground">
          Programa hasta 30 mensajes con delays personalizados
        </p>
      </div>

      {/* Start Date/Time */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Fecha de Inicio</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "PPP") : "Seleccionar fecha"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Hora</Label>
          <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
      </div>

      {/* Timeline Preview */}
      {timeline.length > 0 && (
        <div className="border rounded-lg p-4 space-y-2 bg-muted/30">
          <h4 className="font-medium text-sm">Timeline de Envío</h4>
          <div className="space-y-1 text-xs">
            {timeline.map((t, idx) => (
              <div key={idx} className="flex justify-between">
                <span>Mensaje {t.order}</span>
                <span className="text-muted-foreground">{format(t.time, "PPP p")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Mensajes ({messages.length}/30)</Label>
          <Button size="sm" variant="outline" onClick={addMessage} disabled={messages.length >= 30}>
            <Plus className="h-4 w-4 mr-1" />
            Agregar
          </Button>
        </div>

        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {messages.map((msg, idx) => (
            <div key={msg.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">Mensaje {msg.sequence_order}</span>
                <Button size="sm" variant="ghost" onClick={() => removeMessage(msg.id)} disabled={messages.length === 1}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {idx > 0 && (
                <div className="space-y-2">
                  <Label>Delay después del mensaje anterior (minutos)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={msg.delay_minutes}
                    onChange={(e) => updateMessage(msg.id, 'delay_minutes', parseInt(e.target.value) || 0)}
                    placeholder="1440 = 24h"
                  />
                  <p className="text-xs text-muted-foreground">
                    {msg.delay_minutes >= 1440 
                      ? `${(msg.delay_minutes / 1440).toFixed(1)} días` 
                      : msg.delay_minutes >= 60
                      ? `${(msg.delay_minutes / 60).toFixed(1)} horas`
                      : `${msg.delay_minutes} minutos`}
                  </p>
                </div>
              )}

              <Tabs value={msg.type} onValueChange={(v) => updateMessage(msg.id, 'type', v)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="text">Texto</TabsTrigger>
                  <TabsTrigger value="image">Imagen</TabsTrigger>
                </TabsList>
                
                <TabsContent value="text" className="space-y-2">
                  <Label>Mensaje</Label>
                  <Textarea
                    value={msg.arguments.text || ''}
                    onChange={(e) => updateMessageArgument(msg.id, 'text', e.target.value)}
                    placeholder="Escribe el mensaje..."
                    rows={3}
                  />
                </TabsContent>

                <TabsContent value="image" className="space-y-2">
                  <Label>URL de Imagen</Label>
                  <Input
                    value={msg.arguments.url || ''}
                    onChange={(e) => updateMessageArgument(msg.id, 'url', e.target.value)}
                    placeholder="https://..."
                  />
                </TabsContent>
              </Tabs>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={() => createSequenceMutation.mutate()} disabled={createSequenceMutation.isPending}>
          {createSequenceMutation.isPending ? "Creando..." : "Crear Secuencia"}
        </Button>
      </div>
    </div>
  );
}
