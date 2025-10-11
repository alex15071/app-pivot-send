import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Gauge } from "lucide-react";

const PacingProfiles = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Pacing Profiles</h1>
            <p className="text-muted-foreground">
              Configure rate limiting and sending strategies for optimal delivery
            </p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Profile
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Default</CardTitle>
                <Badge variant="secondary">System</Badge>
              </div>
              <CardDescription>Balanced sending profile</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Batch Size</span>
                  <span className="font-medium">50</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Parallel Batches</span>
                  <span className="font-medium">3</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sleep (sec)</span>
                  <span className="font-medium">3.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Error Threshold</span>
                  <span className="font-medium">12%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Aggressive</CardTitle>
                <Badge variant="secondary">System</Badge>
              </div>
              <CardDescription>Fast sending for high volume</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Batch Size</span>
                  <span className="font-medium">50</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Parallel Batches</span>
                  <span className="font-medium">6</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sleep (sec)</span>
                  <span className="font-medium">2.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Error Threshold</span>
                  <span className="font-medium">15%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Conservative</CardTitle>
                <Badge variant="secondary">System</Badge>
              </div>
              <CardDescription>Careful, high-quality delivery</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Batch Size</span>
                  <span className="font-medium">30</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Parallel Batches</span>
                  <span className="font-medium">2</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sleep (sec)</span>
                  <span className="font-medium">5.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Error Threshold</span>
                  <span className="font-medium">8%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default PacingProfiles;
