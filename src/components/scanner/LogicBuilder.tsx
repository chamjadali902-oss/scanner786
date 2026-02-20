import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ScanCondition, FEATURES, FeatureDefinition, EMAConfig } from '@/types/scanner';
import { Plus, Trash2, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  RSISettings,
  EMASettings,
  MACDSettings,
  BollingerSettings,
  StochasticSettings,
  OscillatorSettings,
  PriceCrossSettings,
  PatternSettings,
  SMCSettings,
} from './settings';

interface LogicBuilderProps {
  conditions: ScanCondition[];
  onChange: (conditions: ScanCondition[]) => void;
  disabled?: boolean;
}

const categoryLabels = {
  indicator: 'Technical Indicators',
  pattern: 'Price Action Patterns',
  smc: 'Smart Money Concepts',
};

function getDefaultCondition(feature: FeatureDefinition): Partial<ScanCondition> {
  const defaults: Partial<ScanCondition> = {
    period: feature.defaultPeriod,
  };

  switch (feature.settingsType) {
    case 'rsi':
      return {
        ...defaults,
        mode: 'range',
        minValue: 30,
        maxValue: 70,
        rsiRegularDivergence: false,
        rsiHiddenDivergence: false,
      };
    case 'ema':
      return {
        ...defaults,
        mode: 'cross',
        emaConfigs: [
          { id: `ema-${Date.now()}`, period: 20, enabled: true },
        ],
        emaCrossover: false,
        emaCrossoverFast: 9,
        emaCrossoverSlow: 21,
        crossType: 'crossover',
      };
    case 'macd':
      return {
        ...defaults,
        mode: 'cross',
        macdFast: 12,
        macdSlow: 26,
        macdSignal: 9,
        crossType: 'crossover',
      };
    case 'bollinger':
      return {
        ...defaults,
        mode: 'cross',
        bbPeriod: 20,
        bbStdDev: 2,
        pricePosition: 'above',
        crossType: 'crossover',
      };
    case 'stochastic':
      return {
        ...defaults,
        mode: 'range',
        stochOverbought: 80,
        stochOversold: 20,
      };
    case 'oscillator':
      return {
        ...defaults,
        mode: feature.valueRange ? 'range' : 'comparison',
        minValue: feature.valueRange?.min,
        maxValue: feature.valueRange?.max,
        operator: '>',
        compareValue: 0,
      };
    case 'price-cross':
      return {
        ...defaults,
        mode: 'cross',
        pricePosition: 'above',
        crossType: 'crossover',
      };
    default:
      return {
        ...defaults,
        mode: 'value',
      };
  }
}

function FeatureSettings({ 
  condition, 
  feature, 
  onUpdate, 
  disabled 
}: { 
  condition: ScanCondition; 
  feature: FeatureDefinition; 
  onUpdate: (updates: Partial<ScanCondition>) => void;
  disabled?: boolean;
}) {
  switch (feature.settingsType) {
    case 'rsi':
      return <RSISettings condition={condition} onUpdate={onUpdate} disabled={disabled} />;
    case 'ema':
      return <EMASettings condition={condition} onUpdate={onUpdate} disabled={disabled} indicatorName={feature.name} />;
    case 'macd':
      return <MACDSettings condition={condition} onUpdate={onUpdate} disabled={disabled} />;
    case 'bollinger':
      return <BollingerSettings condition={condition} onUpdate={onUpdate} disabled={disabled} />;
    case 'stochastic':
      return <StochasticSettings condition={condition} onUpdate={onUpdate} disabled={disabled} />;
    case 'oscillator':
      return <OscillatorSettings condition={condition} feature={feature} onUpdate={onUpdate} disabled={disabled} />;
    case 'price-cross':
      return <PriceCrossSettings condition={condition} feature={feature} onUpdate={onUpdate} disabled={disabled} />;
    case 'pattern':
      return <PatternSettings condition={condition} feature={feature} onUpdate={onUpdate} disabled={disabled} />;
    case 'smc':
      return <SMCSettings condition={condition} feature={feature} onUpdate={onUpdate} disabled={disabled} />;
    default:
      return null;
  }
}

export function LogicBuilder({ conditions, onChange, disabled }: LogicBuilderProps) {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    indicator: true,
    pattern: false,
    smc: false,
  });
  const [expandedConditions, setExpandedConditions] = useState<Record<string, boolean>>({});

  const addCondition = (featureId: string) => {
    const feature = FEATURES.find(f => f.id === featureId);
    if (!feature) return;

    const conditionId = `${featureId}-${Date.now()}`;
    const newCondition: ScanCondition = {
      id: conditionId,
      feature: featureId,
      category: feature.category,
      mode: feature.defaultMode,
      enabled: true,
      ...getDefaultCondition(feature),
    };

    onChange([...conditions, newCondition]);
    // Auto-expand the new condition
    setExpandedConditions(prev => ({ ...prev, [conditionId]: true }));
  };

  const updateCondition = (id: string, updates: Partial<ScanCondition>) => {
    onChange(conditions.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const removeCondition = (id: string) => {
    onChange(conditions.filter(c => c.id !== id));
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const toggleConditionExpand = (id: string) => {
    setExpandedConditions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const groupedFeatures = {
    indicator: FEATURES.filter(f => f.category === 'indicator'),
    pattern: FEATURES.filter(f => f.category === 'pattern'),
    smc: FEATURES.filter(f => f.category === 'smc'),
  };

  const activeConditions = conditions.filter(c => c.enabled);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Logic Builder
        </label>
        <span className="text-xs text-primary font-mono">
          {activeConditions.length} active condition{activeConditions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Active Conditions */}
      {conditions.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Active Filters</p>
          <div className="space-y-2">
            {conditions.map((condition) => {
              const feature = FEATURES.find(f => f.id === condition.feature);
              if (!feature) return null;

              const isExpanded = expandedConditions[condition.id] ?? false;

              return (
                <div
                  key={condition.id}
                  className={cn(
                    'rounded-lg border bg-card transition-all overflow-hidden',
                    condition.enabled ? 'border-primary/30' : 'border-border opacity-60'
                  )}
                >
                  {/* Header Row */}
                  <div className="flex items-center gap-3 p-3">
                    <Switch
                      checked={condition.enabled}
                      onCheckedChange={(enabled) => updateCondition(condition.id, { enabled })}
                      disabled={disabled}
                    />

                    <button
                      onClick={() => toggleConditionExpand(condition.id)}
                      className="flex-1 flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
                    >
                      <Settings2 className="w-4 h-4 text-primary" />
                      <span className="font-medium text-sm">{feature.name}</span>
                      <span className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded-full',
                        feature.category === 'indicator' && 'bg-chart-1/20 text-chart-1',
                        feature.category === 'pattern' && 'bg-chart-2/20 text-chart-2',
                        feature.category === 'smc' && 'bg-chart-5/20 text-chart-5'
                      )}>
                        {feature.category}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground ml-auto" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />
                      )}
                    </button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCondition(condition.id)}
                      disabled={disabled}
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Expandable Settings */}
                  {isExpanded && (
                    <div className="px-3 pb-3">
                      <FeatureSettings
                        condition={condition}
                        feature={feature}
                        onUpdate={(updates) => updateCondition(condition.id, updates)}
                        disabled={disabled || !condition.enabled}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Feature Categories */}
      <div className="space-y-2 border rounded-lg bg-card/50">
        {(['indicator', 'pattern', 'smc'] as const).map((category) => (
          <Collapsible
            key={category}
            open={expandedCategories[category]}
            onOpenChange={() => toggleCategory(category)}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <span className={cn(
                  'w-2 h-2 rounded-full',
                  category === 'indicator' && 'bg-chart-1',
                  category === 'pattern' && 'bg-chart-2',
                  category === 'smc' && 'bg-chart-5'
                )} />
                <span className="font-medium text-sm">{categoryLabels[category]}</span>
                <span className="text-xs text-muted-foreground">
                  ({groupedFeatures[category].length} items)
                </span>
              </div>
              {expandedCategories[category] ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {groupedFeatures[category].map((feature) => {
                  const isAdded = conditions.some(c => c.feature === feature.id);
                  
                  return (
                    <Button
                      key={feature.id}
                      variant="outline"
                      size="sm"
                      onClick={() => addCondition(feature.id)}
                      disabled={disabled || isAdded}
                      className={cn(
                        'justify-start text-left h-auto py-2 px-3',
                        isAdded && 'opacity-50 bg-primary/5'
                      )}
                    >
                      <Plus className="w-3 h-3 mr-2 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{feature.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{feature.description}</p>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}
