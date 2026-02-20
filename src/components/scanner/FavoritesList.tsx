import { FavoriteCoin } from '@/hooks/useFavorites';
import { X, Star, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FavoritesListProps {
  favorites: FavoriteCoin[];
  loading: boolean;
  onRemove: (symbol: string) => void;
}

export function FavoritesList({ favorites, loading, onRemove }: FavoritesListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4">
        No favorite coins yet. Add coins from scan results using the ⭐ button.
      </p>
    );
  }

  return (
    <div className="space-y-1 max-h-[200px] overflow-y-auto">
      {favorites.map((fav) => (
        <div
          key={fav.id}
          className="flex items-center justify-between px-2 py-1.5 rounded bg-muted/30 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
            <span className="text-sm font-medium">
              {fav.symbol.replace('USDT', '')}
              <span className="text-muted-foreground text-xs">/USDT</span>
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onRemove(fav.symbol)}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}
