import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Check, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";

interface MessageSequence {
  id: string;
  sequence_order: number;
  message_type: string;
  status: string;
  scheduled_for: string;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  message_arguments: any;
}

interface SequenceTimelineProps {
  sequences: MessageSequence[];
}

const MessagePreview = ({ message }: { message: MessageSequence }) => {
  const { message_arguments, message_type } = message;

  if (message_type === 'card') {
    const element = message_arguments?.attachment?.payload?.elements?.[0];
    if (!element) return null;

    return (
      <div className="border rounded-lg overflow-hidden bg-card max-w-[300px]">
        {element.image_url && (
          <img 
            src={element.image_url} 
            alt={element.title}
            className="w-full h-[160px] object-cover"
          />
        )}
        <div className="p-3 space-y-2">
          {element.title && (
            <h4 className="font-semibold text-sm">{element.title}</h4>
          )}
          {element.subtitle && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {element.subtitle}
            </p>
          )}
          {element.buttons && element.buttons.length > 0 && (
            <div className="space-y-1">
              {element.buttons.map((btn: any, idx: number) => (
                <div 
                  key={idx}
                  className="text-xs py-1.5 px-3 bg-primary/10 text-primary rounded text-center"
                >
                  {btn.title}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (message_type === 'text') {
    return (
      <div className="border rounded-lg p-3 bg-card max-w-[300px]">
        <p className="text-sm">{message_arguments?.text}</p>
      </div>
    );
  }

  if (message_type === 'image') {
    return (
      <div className="border rounded-lg overflow-hidden bg-card max-w-[300px]">
        {message_arguments?.attachment?.payload?.url ? (
          <img 
            src={message_arguments.attachment.payload.url} 
            alt="Image message"
            className="w-full h-auto object-cover"
          />
        ) : (
          <div className="p-8 flex items-center justify-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
      </div>
    );
  }

  return null;
};

const SequenceTimeline = ({ sequences }: SequenceTimelineProps) => {
  const getStatusInfo = (seq: MessageSequence) => {
    if (seq.status === 'sent') {
      return {
        label: `Enviado a ${seq.delivered_count} usuarios`,
        icon: <Check className="h-4 w-4" />,
        color: "bg-green-500/10 text-green-600 border-green-500/20"
      };
    }
    if (seq.status === 'sending') {
      return {
        label: `Enviando...`,
        icon: <Clock className="h-4 w-4 animate-pulse" />,
        color: "bg-blue-500/10 text-blue-600 border-blue-500/20"
      };
    }
    if (seq.status === 'scheduled') {
      const scheduledDate = new Date(seq.scheduled_for);
      const now = new Date();
      const isPast = scheduledDate < now;
      
      return {
        label: isPast 
          ? `Enviando en breve...`
          : `Se enviará ${format(scheduledDate, "dd/MM/yyyy 'a las' HH:mm")}`,
        icon: <Clock className="h-4 w-4" />,
        color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
      };
    }
    return {
      label: seq.status,
      icon: <Clock className="h-4 w-4" />,
      color: "bg-gray-500/10 text-gray-600 border-gray-500/20"
    };
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-6">
          {sequences
            .sort((a, b) => a.sequence_order - b.sequence_order)
            .map((seq, index) => {
              const statusInfo = getStatusInfo(seq);
              return (
                <div key={seq.id} className="flex gap-6">
                  {/* Left side - Message info */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold">
                        {seq.sequence_order}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">
                          Mensaje {seq.sequence_order}
                          {seq.message_type === 'card' && ' - Card'}
                          {seq.message_type === 'text' && ' - Texto'}
                          {seq.message_type === 'image' && ' - Imagen'}
                        </h3>
                        <Badge 
                          variant="outline" 
                          className={`mt-1 ${statusInfo.color}`}
                        >
                          <span className="flex items-center gap-1.5">
                            {statusInfo.icon}
                            {statusInfo.label}
                          </span>
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Stats if sent */}
                    {seq.status === 'sent' && (
                      <div className="flex gap-3 text-sm">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <span className="text-muted-foreground">Entregados:</span>
                          <span className="font-medium">{seq.delivered_count}</span>
                        </div>
                        {seq.failed_count > 0 && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-muted-foreground">Fallidos:</span>
                            <span className="font-medium">{seq.failed_count}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right side - Preview */}
                  <div className="flex-shrink-0">
                    <MessagePreview message={seq} />
                  </div>
                </div>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
};

export default SequenceTimeline;
