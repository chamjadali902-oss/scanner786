import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Database, Zap, Server } from 'lucide-react';

export default function AdminSettings() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">App Settings</h2>
        <p className="text-sm text-muted-foreground">Platform configuration</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5 border-border space-y-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Database</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge className="bg-bullish/10 text-bullish border-bullish/20">Connected</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">RLS</span>
              <Badge className="bg-bullish/10 text-bullish border-bullish/20">Enabled</Badge>
            </div>
          </div>
        </Card>

        <Card className="p-5 border-border space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Authentication</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Provider</span>
              <span className="text-foreground">Email/Password</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Auto-confirm</span>
              <Badge className="bg-primary/10 text-primary border-primary/20">Enabled</Badge>
            </div>
          </div>
        </Card>

        <Card className="p-5 border-border space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Data Source</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">API</span>
              <span className="text-foreground">Binance</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge className="bg-bullish/10 text-bullish border-bullish/20">Live</Badge>
            </div>
          </div>
        </Card>

        <Card className="p-5 border-border space-y-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Backend Functions</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">analyze-trade</span>
              <Badge className="bg-bullish/10 text-bullish border-bullish/20">Active</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">trading-chat</span>
              <Badge className="bg-bullish/10 text-bullish border-bullish/20">Active</Badge>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
