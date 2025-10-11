import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, UserPlus } from "lucide-react";

const Accounts = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Facebook Accounts</h1>
            <p className="text-muted-foreground">
              Connect Facebook accounts via OAuth to manage fanpages
            </p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Connect Account
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Connected Accounts</CardTitle>
            <CardDescription>
              Facebook accounts connected through OAuth flow
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No accounts connected yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Connect a Facebook account to get started with managing fanpages
              </p>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Connect Your First Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Accounts;
