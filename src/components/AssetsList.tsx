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
    { name: 'Gold', value: assets.gold, total: 100, color: 'text-yellow-400', bgColor: 'bg-yellow-400', borderColor: 'border-yellow-400' },
    { name: 'Water', value: assets.water, total: 50, color: 'text-blue-400', bgColor: 'bg-blue-400', borderColor: 'border-blue-400' },
    { name: 'Oil', value: assets.oil, total: 20, color: 'text-purple-400', bgColor: 'bg-purple-400', borderColor: 'border-purple-400' }
  ];

  return (
    <div className="bg-gray-800 border border-gray-600 p-4 max-w-sm">
      <h3 className="text-sm font-bold text-white mb-3 uppercase tracking-wider text-center">Market</h3>
      
      <div className="space-y-3">
        {assetData.map((asset) => {
          const trend = getMarketTrend(asset.name);
          const currentPrice = BigNumberUtils.toNumber(getAssetPrice(asset.name as AssetType));
          
          return (
            <div key={asset.name} className={`bg-gray-700 ${asset.borderColor} border p-3`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className={`w-4 h-4 ${asset.bgColor} rounded-full flex items-center justify-center`}>
                    <Circle className={`w-2 h-2 text-gray-800 fill-current`} />
                  </div>
                  <div className="text-white font-bold text-sm uppercase">{asset.name}</div>
                </div>
                <div className={`${asset.color} font-bold text-sm`}>{asset.value}</div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="text-gray-300 text-xs">
                  Price: <span className="text-white font-semibold">${currentPrice.toLocaleString()}</span>
                </div>
                {trend && (
                  <div className="flex items-center space-x-1">
                    {trend.change >= 0 ? (
                      <TrendingUp className="w-6 h-6 text-green-400" />
                    ) : (
                      <TrendingDown className="w-6 h-6 text-red-400" />
                    )}
                    <span className={`text-xs font-bold ${
                      trend.change >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {trend.percentage}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}