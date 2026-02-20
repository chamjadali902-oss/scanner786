import { useState } from 'react';
import { ScanCondition, EMAConfig, PricePosition } from '@/types/scanner';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface EMASettingsProps {
  condition: ScanCondition;
  onUpdate: (updates: Partial<ScanCondition>) => void;
  disabled?: boolean;
  indicatorName?: string;
}

const DEFAULT_EMA_PERIODS = [9, 20, 50, 200];

export function EMASettings({ condition, onUpdate, disabled, indicatorName = 'EMA' }: EMASettingsProps) {
  const emaConfigs = condition.emaConfigs || [];
  
  const addEMA = () => {
    if (emaConfigs.length >= 4) return;
    
    // Find next available default period
    const usedPeriods = emaConfigs.map(c => c.period);
    const nextPeriod = DEFAULT_EMA_PERIODS.find(p => !usedPeriods.includes(p)) || 20;
    
    const newConfig: EMAConfig = {
      id: `ema-${Date.now()}`,
      period: nextPeriod,
      enabled: true,
      pricePosition: undefined,
    };
    
    onUpdate({ emaConfigs: [...emaConfigs, newConfig] });
  };

  const updateEMA = (id: string, updates: Partial<EMAConfig>) => {
    onUpdate({
      emaConfigs: emaConfigs.map(c => c.id === id ? { ...c, ...updates } : c)
    });
  };

  const removeEMA = (id: string) => {
    onUpdate({ emaConfigs: emaConfigs.filter(c => c.id !== id) });
  };

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-primary">{indicatorName} Settings</div>
        <Button
          variant="outline"
          size="sm"
          onClick={addEMA}
          disabled={disabled || emaConfigs.length >= 4}
          className="h-7 text-xs"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add {indicatorName} ({emaConfigs.length}/4)
        </Button>
      </div>

      {/* EMA Configurations */}
      <div className="space-y-3">
        {emaConfigs.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4 bg-background/50 rounded-md">
            No {indicatorName} configured. Click "Add {indicatorName}" to start.
          </p>
        ) : (
          emaConfigs.map((config, index) => (
            <div key={config.id} className="p-3 bg-background/50 rounded-md space-y-3 border border-border/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={config.enabled}
                    onCheckedChange={(enabled) => updateEMA(config.id, { enabled })}
                    disabled={disabled}
                  />
                  <span className="text-sm font-medium">{indicatorName} #{index + 1}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeEMA(config.id)}
                  disabled={disabled}
                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Period</Label>
                  <Input
                    type="number"
                    value={config.period}
                    onChange={(e) => updateEMA(config.id, { period: Number(e.target.value) })}
                    min={1}
                    max={500}
                    className="h-8 text-xs font-mono"
                    disabled={disabled || !config.enabled}
                  />
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Price Position</Label>
                  <Select
                    value={config.pricePosition || 'none'}
                    onValueChange={(v) => updateEMA(config.id, { 
                      pricePosition: v === 'none' ? undefined : v as PricePosition 
                    })}
                    disabled={disabled || !config.enabled}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Any Position</SelectItem>
                      <SelectItem value="above">Price Above {indicatorName}</SelectItem>
                      <SelectItem value="below">Price Below {indicatorName}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Crossover Settings */}
      <div className="space-y-3 pt-2 border-t border-border/50">
        <div className="flex items-center justify-between py-2 px-3 rounded-md bg-background/50">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{indicatorName} Crossover</p>
            <p className="text-[10px] text-muted-foreground">
              Detect when fast {indicatorName} crosses slow {indicatorName}
            </p>
          </div>
          <Switch
            checked={condition.emaCrossover ?? false}
            onCheckedChange={(checked) => onUpdate({ emaCrossover: checked })}
            disabled={disabled}
          />
        </div>

        {condition.emaCrossover && (
          <div className="grid grid-cols-2 gap-3 pl-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Fast Period</Label>
              <Input
                type="number"
                value={condition.emaCrossoverFast ?? 9}
                onChange={(e) => onUpdate({ emaCrossoverFast: Number(e.target.value) })}
                min={1}
                max={500}
                className="h-8 text-xs font-mono"
                disabled={disabled}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Slow Period</Label>
              <Input
                type="number"
                value={condition.emaCrossoverSlow ?? 21}
                onChange={(e) => onUpdate({ emaCrossoverSlow: Number(e.target.value) })}
                min={1}
                max={500}
                className="h-8 text-xs font-mono"
                disabled={disabled}
              />
            </div>
          </div>
        )}
      </div>

      {/* Cross Type */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Cross Direction</Label>
        <Select
          value={condition.crossType || 'crossover'}
          onValueChange={(v) => onUpdate({ crossType: v as 'crossover' | 'crossunder' })}
          disabled={disabled}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="crossover">Bullish Cross (Fast above Slow)</SelectItem>
            <SelectItem value="crossunder">Bearish Cross (Fast below Slow)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
