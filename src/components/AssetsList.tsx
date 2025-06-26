import React, { useState, useEffect } from 'react';
import { Circle, TrendingUp, TrendingDown } from 'lucide-react';
import { AssetType, BigNumberUtils } from '../zustand/store';
import useAppStore from '../zustand/store';

interface AssetsListProps {
  assets: {
    gold: number;
    water: number;
    oil: number;
  };
  marketChanges?: any; // Keep for backward compatibility but ignore it
}

interface PriceHistory {
  [key: string]: number;
}

export function AssetsList({ assets }: AssetsListProps) {
  const { getAssetPrice } = useAppStore();
  const [priceHistory, setPriceHistory] = useState<PriceHistory>({});
  
  // Track price changes using Dojo market data
  useEffect(() => {
    const updatePriceHistory = () => {
      const newHistory: PriceHistory = {};
      ['Gold', 'Water', 'Oil'].forEach(asset => {
        const currentPrice = BigNumberUtils.toNumber(getAssetPrice(asset as AssetType));
        if (currentPrice > 0) {
          newHistory[asset] = currentPrice;
        }
      });
      setPriceHistory(prev => ({ ...prev, ...newHistory }));
    };
    
    updatePriceHistory();
    // Update price history every 5 seconds
    const interval = setInterval(updatePriceHistory, 5000);
    return () => clearInterval(interval);
  }, [getAssetPrice]);
  
  const getMarketTrend = (assetName: string) => {
    const currentPrice = BigNumberUtils.toNumber(getAssetPrice(assetName as AssetType));
    const previousPrice = priceHistory[assetName];
    
    if (!previousPrice || currentPrice === 0) return null;
    
    const change = currentPrice - previousPrice;
    const percentage = ((change / previousPrice) * 100).toFixed(1);
    
    return {
      change,
      percentage: `${change >= 0 ? '+' : ''}${percentage}%`,
      direction: change >= 0 ? 'up' : 'down'
    };
  };

  const assetData = [
    { name: 'Gold', value: assets.gold, total: 100, color: 'text-pixel-yellow', bgColor: 'bg-pixel-yellow', borderColor: 'border-pixel-yellow' },
    { name: 'Water', value: assets.water, total: 50, color: 'text-pixel-blue', bgColor: 'bg-pixel-blue', borderColor: 'border-pixel-blue' },
    { name: 'Oil', value: assets.oil, total: 20, color: 'text-pixel-magenta', bgColor: 'bg-pixel-magenta', borderColor: 'border-pixel-magenta' }
  ];

  return (
    <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-2 max-w-xs">
      <h3 className="text-pixel-xs font-bold text-pixel-primary mb-2 uppercase tracking-wider text-center">Assets</h3>
      
      <div className="space-y-1">
        {assetData.map((asset) => {
          const trend = getMarketTrend(asset.name);
          return (
            <div key={asset.name} className={`pixel-card bg-pixel-gray ${asset.borderColor} p-3`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1">
                  <div className={`w-4 h-4 ${asset.bgColor} pixel-avatar flex items-center justify-center`}>
                    <Circle className={`w-2 h-2 text-pixel-black fill-current`} />
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="text-pixel-primary font-bold text-pixel-xs uppercase">{asset.name}</div>
                    {trend && (
                      <div className="flex items-center space-x-1">
                        {trend.change >= 0 ? (
                          <TrendingUp className="w-5 h-5 text-pixel-success" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-pixel-error" />
                        )}
                        <span className={`text-pixel-xs font-bold ${
                          trend.change >= 0 ? 'text-pixel-success' : 'text-pixel-error'
                        }`}>
                          {trend.percentage}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className={`${asset.color} font-bold text-pixel-xs`}>{asset.value}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}