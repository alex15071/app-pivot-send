import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Shield, Star } from "lucide-react";

const Apps = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Facebook Apps</h1>
            <p className="text-muted-foreground">
              Manage multiple Facebook apps for load balancing and high delivery rates
            </p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add App
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Demo App A</CardTitle>
                <Star className="h-5 w-5 fill-warning text-warning" />
              </div>
              <CardDescription>app_key_demo_a</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">App ID</span>
                  <span className="font-mono">123456789</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-1 text-xs font-medium text-success">
                    <Shield className="mr-1 h-3 w-3" />
                    Active
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Default</span>
                  <span className="font-medium">Yes</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Apps;
