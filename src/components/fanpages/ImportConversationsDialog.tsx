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
        toast.error("JSON debe ser un array");
        return;
      }

      if (conversations.length === 0) {
        toast.error("El array está vacío");
        return;
      }

      // Handle PHPMyAdmin JSON format
      let dataArray = conversations;
      
      // Check if this is PHPMyAdmin format (has table element with data field)
      const tableElement = conversations.find((item: any) => item?.type === 'table' && Array.isArray(item?.data));
      
      if (tableElement) {
        console.log(`📦 Formato PHPMyAdmin detectado: ${tableElement.data.length} registros en 'data'`);
        dataArray = tableElement.data;
      }

      // Extract ONLY conversation_id from the data
      const conversationIds: string[] = [];
      
      dataArray.forEach((item: any) => {
        if (!item || typeof item !== 'object') return;
        
        const id = item.conversation_id || item.conversationId || item.sender_id || item.senderId;
        
        if (id && typeof id === 'string') {
          conversationIds.push(id);
        }
      });

      if (conversationIds.length === 0) {
        toast.error("No se encontraron conversation_id válidos");
        console.error("Estructura del JSON:", {
          total: conversations.length,
          primerElemento: conversations[0],
          tieneTabla: !!tableElement
        });
        return;
      }

      console.log(`✅ Extraídos ${conversationIds.length} conversation_id únicos`);
      console.log("Primer ID:", conversationIds[0]);

      // Divide en batches de 5000 para no exceder el límite del servidor
      const BATCH_SIZE = 5000;
      const totalBatches = Math.ceil(conversationIds.length / BATCH_SIZE);
      
      toast.info(`Importando ${conversationIds.length.toLocaleString()} conversaciones en ${totalBatches} lotes...`);

      let totalImported = 0;
      let totalSkipped = 0;

      for (let i = 0; i < conversationIds.length; i += BATCH_SIZE) {
        const batch = conversationIds.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        
        console.log(`📦 Enviando lote ${batchNum}/${totalBatches} (${batch.length} IDs)...`);

        // Call import function with batch
        const { data, error } = await supabase.functions.invoke('import-conversations', {
          body: {
            page_id: pageId,
            conversation_ids: batch
          }
        });

        if (error) {
          console.error(`❌ Error en lote ${batchNum}:`, error);
          toast.error(`Error en lote ${batchNum}: ${error.message}`);
          break;
        }

        totalImported += data.imported || 0;
        totalSkipped += data.skipped || 0;
        
        toast.info(`Lote ${batchNum}/${totalBatches} completado: ${data.imported} nuevos`);
      }

      toast.success(
        `Import complete! ${totalImported.toLocaleString()} importados, ${totalSkipped.toLocaleString()} duplicados. Total: ${(totalImported + totalSkipped).toLocaleString()}`
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
