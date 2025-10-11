import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessagesSquare } from "lucide-react";

const Fanpages = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fanpages</h1>
          <p className="text-muted-foreground">
            Manage your connected Facebook fanpages and conversation data
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your Fanpages</CardTitle>
            <CardDescription>
              Fanpages accessible through connected accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessagesSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No fanpages available</h3>
              <p className="text-sm text-muted-foreground">
                Connect a Facebook account first to see your fanpages here
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Fanpages;
