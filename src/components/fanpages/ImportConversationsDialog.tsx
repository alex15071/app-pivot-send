import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ImportConversationsDialogProps {
  pageId: string;
  pageName: string;
  onImportComplete: () => void;
}

export const ImportConversationsDialog = ({ 
  pageId, 
  pageName,
  onImportComplete 
}: ImportConversationsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [jsonData, setJsonData] = useState("");

  const handleImport = async () => {
    try {
      setImporting(true);

      // Parse JSON data
      let conversations;
      try {
        conversations = JSON.parse(jsonData);
      } catch (e) {
        toast.error("Invalid JSON format");
        return;
      }

      // Ensure it's an array
      if (!Array.isArray(conversations)) {
        toast.error("JSON must be an array of conversations");
        return;
      }

      // Validate format
      if (conversations.length === 0) {
        toast.error("No conversations to import");
        return;
      }

      // Check if records have required fields
      const firstRecord = conversations[0];
      if (!firstRecord.sender_id && !firstRecord.conversation_id) {
        toast.error("Each record must have 'conversation_id' or 'sender_id' field");
        return;
      }

      toast.info(`Importing ${conversations.length.toLocaleString()} conversations...`);

      // Call import function
      const { data, error } = await supabase.functions.invoke('import-conversations', {
        body: {
          page_id: pageId,
          conversations: conversations
        }
      });

      if (error) throw error;

      toast.success(
        `Import complete! ${data.imported.toLocaleString()} imported, ${data.skipped.toLocaleString()} skipped. Total: ${data.total.toLocaleString()}`
      );

      setOpen(false);
      setJsonData("");
      onImportComplete();
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || "Failed to import conversations");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex-1">
          <Upload className="mr-2 h-3 w-3" />
          Importar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar Conversaciones</DialogTitle>
          <DialogDescription>
            Importa conversaciones desde tu base de datos MySQL para {pageName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              JSON Data (Array de conversaciones)
            </label>
            <Textarea
              placeholder={`[\n  {"id":"123","fanpage_id":"5010","conversation_id":"24717859741227746","created_at":"2025-10-12 00:26:36"},\n  {"id":"124","fanpage_id":"5010","conversation_id":"24579178931745037","created_at":"2025-10-12 00:31:09"},\n  ...\n]`}
              value={jsonData}
              onChange={(e) => setJsonData(e.target.value)}
              className="min-h-[300px] font-mono text-xs"
              disabled={importing}
            />
            <p className="text-xs text-muted-foreground">
              Formato SQL directo: Pega el JSON completo exportado de tu MySQL. 
              Ejemplo: <code className="bg-muted px-1 rounded">[{`{"conversation_id": "123...", "fanpage_id": "5010"}`}]</code>
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setOpen(false)}
            disabled={importing}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleImport}
            disabled={importing || !jsonData.trim()}
          >
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Importar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
