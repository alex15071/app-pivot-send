import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const OAuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");

      if (error) {
        toast.error(`OAuth error: ${error}`);
        navigate("/accounts");
        return;
      }

      if (!code || !state) {
        toast.error("Invalid callback parameters");
        navigate("/accounts");
        return;
      }

      try {
        // Call the edge function to process OAuth
        const { data, error: functionError } = await supabase.functions.invoke("oauth-callback", {
          body: { code, state },
        });

        if (functionError) throw functionError;

        toast.success("Account connected successfully!");
        navigate("/accounts");
      } catch (err: any) {
        console.error("OAuth callback error:", err);
        toast.error(err.message || "Failed to connect account");
        navigate("/accounts");
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">Processing OAuth callback...</p>
      </div>
    </div>
  );
};

export default OAuthCallback;
