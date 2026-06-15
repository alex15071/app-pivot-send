import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AppOption {
  id: string;
  key: string;
  name: string;
  is_default: boolean | null;
}

interface ImportFanpagesByTokenDialogProps {
  onImportComplete: () => void;
}

export const ImportFanpagesByTokenDialog = ({
  onImportComplete,
}: ImportFanpagesByTokenDialogProps) => {
  const [open, setOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState("");
  const [userToken, setUserToken] = useState("");
  const [importing, setImporting] = useState(false);

  const { data: apps = [], isLoading: loadingApps } = useQuery({
    queryKey: ["apps", "fanpages-token-import"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("apps")
        .select("id, key, name, is_default")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as AppOption[];
    },
  });


  const handleImport = async () => {
    if (!userToken.trim()) {
      toast.error("Pega un token de usuario válido");
      return;
    }

    try {
      setImporting(true);

      const { data, error } = await supabase.functions.invoke("import-fanpages-token", {
        body: {
          ...(selectedApp ? { app_key: selectedApp } : {}),
          user_token: userToken.trim(),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(
        `Fanpages importadas: ${data?.imported_count ?? 0}${
          data?.skipped_count ? ` · Omitidas: ${data.skipped_count}` : ""
        }`
      );

      setOpen(false);
      setUserToken("");
      onImportComplete();
    } catch (error: any) {
      toast.error(error.message || "No se pudieron importar las fanpages");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <KeyRound className="mr-2 h-4 w-4" />
          Añadir por token
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar fanpages por token</DialogTitle>
          <DialogDescription>
            Pega tu token de usuario de Facebook y te traemos todas las fanpages disponibles.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="import-app-key">App (opcional)</Label>
            <Select value={selectedApp} onValueChange={setSelectedApp} disabled={loadingApps || apps.length === 0}>
              <SelectTrigger id="import-app-key">
                <SelectValue placeholder={loadingApps ? "Cargando apps..." : "Sin app (solo token)"} />
              </SelectTrigger>
              <SelectContent>
                {apps.map((app) => (
                  <SelectItem key={app.id} value={app.key}>
                    {app.name} ({app.key})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Si no eliges una app, se usará la app por defecto (o se creará una automáticamente).
            </p>
          </div>


          <div className="space-y-2">
            <Label htmlFor="fb-user-token">Token de usuario</Label>
            <Input
              id="fb-user-token"
              type="password"
              placeholder="EAAB..."
              value={userToken}
              onChange={(e) => setUserToken(e.target.value)}
              disabled={importing}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={importing}>
            Cancelar
          </Button>
          <Button
            onClick={handleImport}
            disabled={importing || !userToken.trim()}
          >
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <KeyRound className="mr-2 h-4 w-4" />
                Obtener fanpages
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
