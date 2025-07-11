import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Zap, Target } from 'lucide-react';
import { useAudio } from '../hooks/useAudio';
import { AssetType, ActionType, BigNumberUtils } from '../zustand/store';
import useAppStore from '../zustand/store';

// Local interfaces for socket-based game data
interface Player {
  id: string;
  name: string;
  tokens: number;
  assets: {
    gold: number;
    water: number;
    oil: number;
  };
  totalAssets: number;
}

interface ActionPanelProps {
  selectedAction: ActionType;
  selectedResource: AssetType;
  amount: number;
  targetPlayer: string;
  players: Player[];
  currentPlayer: Player;
  onActionChange: (action: ActionType) => void;
  onResourceChange: (resource: AssetType) => void;
  onAmountChange: (amount: number) => void;
  onTargetChange: (target: string) => void;
  onConfirmAction: () => void;
}

export function ActionPanel({
  selectedAction,
  selectedResource,
  amount,
  targetPlayer,
  players,
  currentPlayer,
  onActionChange,
  onResourceChange,
  onAmountChange,
  onTargetChange,
  onConfirmAction
}: ActionPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [quickPreset, setQuickPreset] = useState<number | null>(null);
  const { playSound } = useAudio();
  
  // Get market data from Zustand store
  const { getAssetPrice, canAffordAsset, getAssetAmount, hasPerformedActionThisRound } = useAppStore();
  
  const actions: { type: ActionType; label: string; color: string; borderColor: string; icon: any; description: string }[] = [
    { type: 'Buy', label: 'Buy', color: 'bg-pixel-success hover:bg-pixel-primary', borderColor: 'border-pixel-success', icon: TrendingUp, description: 'Purchase resources with tokens' },
    { type: 'Sell', label: 'Sell', color: 'bg-pixel-blue hover:bg-pixel-cyan', borderColor: 'border-pixel-blue', icon: TrendingDown, description: 'Convert resources to tokens' },
    { type: 'Burn', label: 'Burn', color: 'bg-pixel-secondary hover:bg-pixel-warning', borderColor: 'border-pixel-secondary', icon: Zap, description: 'Destroy resources to boost market' },
    { type: 'Sabotage', label: 'Sabotage', color: 'bg-pixel-error hover:bg-pixel-warning', borderColor: 'border-pixel-error', icon: Target, description: 'Attack opponent resources' }
  ];

  const resources: { type: AssetType; label: string; icon: string; color: string; bgColor: string }[] = [
    { type: 'Gold', label: 'Gold', icon: '🪙', color: 'text-pixel-yellow', bgColor: 'bg-pixel-yellow' },
    { type: 'Water', label: 'Water', icon: '💧', color: 'text-pixel-blue', bgColor: 'bg-pixel-blue' },
    { type: 'Oil', label: 'Oil', icon: '🛢️', color: 'text-pixel-magenta', bgColor: 'bg-pixel-magenta' }
  ];

  const quickAmounts = [1, 5, 10, 25, 50];

  const getResourcePrice = (resource: AssetType): number => {
    const price = getAssetPrice(resource);
    return BigNumberUtils.toNumber(price);
  };

  // Helper to convert AssetType to lowercase for asset access
  const getAssetKey = (assetType: AssetType): 'gold' | 'water' | 'oil' => {
    return assetType.toLowerCase() as 'gold' | 'water' | 'oil';
  };

  const calculateCost = () => {
    const price = getResourcePrice(selectedResource) * amount;
    return selectedAction === 'Sell' ? Math.floor(price * 0.8) : price;
  };

  const getMaxAmount = () => {
    const assetKey = getAssetKey(selectedResource);
    switch (selectedAction) {
      case 'Buy':
        return Math.floor(currentPlayer.tokens / getResourcePrice(selectedResource));
      case 'Sell':
      case 'Burn':
        return currentPlayer.assets[assetKey];
      case 'Sabotage':
        const target = players.find(p => p.name === targetPlayer);
        return target ? target.assets[assetKey] : 0;
      default:
        return 0;
    }
  };

  const canPerformAction = () => {
    // If player has already performed an action this round, disable the button
    if (hasPerformedActionThisRound) {
      return false;
    }

    const cost = calculateCost();
    const assetKey = getAssetKey(selectedResource);

    switch (selectedAction) {
      case 'Buy':
        return currentPlayer.tokens >= cost && amount > 0;
      case 'Sell':
        return currentPlayer.assets[assetKey] >= amount && amount > 0;
      case 'Burn':
        return currentPlayer.assets[assetKey] >= amount && amount > 0;
      case 'Sabotage':
        return currentPlayer.tokens >= 100 && targetPlayer && amount > 0;
      default:
        return false;
    }
  };

  const handleQuickAmount = (quickAmount: number) => {
    const maxAmount = getMaxAmount();
    const finalAmount = Math.min(quickAmount, maxAmount);
    onAmountChange(finalAmount);
    setQuickPreset(quickAmount);
  };

  const handleMaxAmount = () => {
    const maxAmount = getMaxAmount();
    onAmountChange(maxAmount);
    setQuickPreset(null);
  };

  return (
    <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-3 sm:p-4 space-y-3">
      {/* Header with Toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-pixel-xs sm:text-pixel-sm font-bold text-pixel-primary uppercase tracking-wider">Actions</h3>
        <button
          onClick={() => {
            playSound('click');
            setShowAdvanced(!showAdvanced);
          }}
          className="px-2 py-1 bg-pixel-gray hover:bg-pixel-light-gray pixel-btn border-pixel-light-gray text-pixel-xs text-pixel-accent font-bold uppercase min-h-touch"
        >
          {showAdvanced ? 'Simple' : 'Advanced'}
        </button>
      </div>
      
      {/* Round Action Status Indicator */}
      {hasPerformedActionThisRound && (
        <div className="bg-pixel-warning pixel-panel border-pixel-black p-2 mb-3">
          <div className="text-pixel-xs font-bold text-pixel-black uppercase text-center">
            ✅ Action Completed This Round
          </div>
          <div className="text-pixel-xs text-pixel-black text-center mt-1">
            Wait for the next round to perform another action
          </div>
        </div>
      )}
      
      {/* Action Buttons with Icons */}
      <div className="grid grid-cols-2 gap-2">
        {actions.map((action) => {
          const IconComponent = action.icon;
          return (
            <div key={action.type} className="relative group">
              <button
                onClick={() => {
                  playSound('click');
                  onActionChange(action.type);
                }}
                className={`w-full px-2 py-2 pixel-btn text-pixel-black font-bold text-pixel-xs uppercase tracking-wider flex items-center justify-center space-x-1 ${
                  selectedAction === action.type
                    ? `${action.color} ${action.borderColor}`
                    : 'bg-pixel-gray hover:bg-pixel-light-gray border-pixel-light-gray'
                }`}
              >
                <IconComponent className="w-3 h-3" />
                <span>{action.label}</span>
              </button>
              {showAdvanced && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-pixel-black border-pixel-gray text-pixel-xs text-pixel-primary opacity-0 group-hover:opacity-100 z-10 whitespace-nowrap">
                  {action.description}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Action Info */}
      {selectedAction && (
        <div className="bg-pixel-gray pixel-panel border-pixel-light-gray p-2">
          <div className="text-pixel-xs text-pixel-primary font-bold uppercase">
            {selectedAction} Action
          </div>
          <div className="text-pixel-xs text-pixel-base-gray">
            {actions.find(a => a.type === selectedAction)?.description}
          </div>
          {selectedAction === 'Sabotage' && (
            <div className="text-pixel-xs text-pixel-warning mt-1">
              Fixed cost: 100 tokens
            </div>
          )}
        </div>
      )}

      {/* Resource Selection with Visual Cards */}
      <div>
        <label className="block text-pixel-xs font-bold text-pixel-primary mb-2 uppercase">Resource</label>
        <div className="grid grid-cols-3 gap-1 mb-2">
          {resources.map((resource) => (
            <button
              key={resource.type}
              onClick={() => {
                playSound('click');
                onResourceChange(resource.type);
              }}
              className={`p-2 pixel-btn text-pixel-xs font-bold uppercase flex flex-col items-center space-y-1 ${
                selectedResource === resource.type
                  ? `${resource.bgColor} text-pixel-black border-pixel-black`
                  : 'bg-pixel-gray hover:bg-pixel-light-gray text-pixel-primary border-pixel-light-gray'
              }`}
            >
              <span className="text-base">{resource.icon}</span>
              <span>{resource.label}</span>
              <span className="text-pixel-xs opacity-75">{getResourcePrice(resource.type)} T</span>
            </button>
          ))}
        </div>
        
        {/* Resource Info */}
        <div className="bg-pixel-gray pixel-panel border-pixel-light-gray p-2">
          <div className="flex justify-between items-center text-pixel-xs">
            <span className="text-pixel-primary font-bold">You have:</span>
            <span className={`font-bold ${resources.find(r => r.type === selectedResource)?.color}`}>
              {currentPlayer.assets[getAssetKey(selectedResource)]} {selectedResource}
            </span>
          </div>
          <div className="flex justify-between items-center text-pixel-xs mt-1">
            <span className="text-pixel-primary font-bold">Market Price:</span>
            <span className="text-pixel-success font-bold">
              {getResourcePrice(selectedResource)} tokens/unit
            </span>
          </div>
        </div>
      </div>

      {/* Enhanced Amount Input */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-pixel-xs font-bold text-pixel-primary uppercase">Amount</label>
          <button
            onClick={() => {
              playSound('click');
              handleMaxAmount();
            }}
            className="px-2 py-1 bg-pixel-secondary hover:bg-pixel-warning text-pixel-black font-bold text-pixel-xs pixel-btn border-pixel-black uppercase"
          >
            Max ({getMaxAmount()})
          </button>
        </div>
        
        {/* Quick Amount Buttons */}
        <div className="grid grid-cols-5 gap-1 mb-2">
          {quickAmounts.map((quickAmount) => {
            const maxAmount = getMaxAmount();
            const isDisabled = quickAmount > maxAmount;
            const isSelected = quickPreset === quickAmount;
            
            return (
              <button
                key={quickAmount}
                onClick={() => {
                  if (!isDisabled) {
                    playSound('click');
                    handleQuickAmount(quickAmount);
                  }
                }}
                disabled={isDisabled}
                className={`px-1 py-1 pixel-btn text-pixel-xs font-bold ${
                  isSelected
                    ? 'bg-pixel-accent text-pixel-black border-pixel-black'
                    : isDisabled
                      ? 'bg-pixel-dark-gray text-pixel-gray border-pixel-gray cursor-not-allowed'
                      : 'bg-pixel-gray hover:bg-pixel-light-gray text-pixel-primary border-pixel-light-gray'
                }`}
              >
                {quickAmount}
              </button>
            );
          })}
        </div>
        
        {/* Manual Input with +/- Controls */}
        <div className="flex space-x-1">
          <input
            type="number"
            min="1"
            max={getMaxAmount()}
            value={amount}
            onChange={(e) => {
              onAmountChange(parseInt(e.target.value) || 1);
              setQuickPreset(null);
            }}
            className="flex-1 px-2 py-1 bg-pixel-gray pixel-input border-pixel-light-gray text-pixel-primary text-pixel-xs font-bold focus:outline-none focus:border-pixel-accent"
          />
          <div className="flex flex-col">
            <button
              onClick={() => {
                playSound('click');
                const newAmount = Math.min(getMaxAmount(), amount + 1);
                onAmountChange(newAmount);
                setQuickPreset(null);
              }}
              className="px-2 py-0.5 bg-pixel-gray hover:bg-pixel-light-gray pixel-btn border-pixel-light-gray text-pixel-xs text-pixel-primary font-bold"
            >
              +
            </button>
            <button
              onClick={() => {
                playSound('click');
                const newAmount = Math.max(1, amount - 1);
                onAmountChange(newAmount);
                setQuickPreset(null);
              }}
              className="px-2 py-0.5 bg-pixel-gray hover:bg-pixel-light-gray pixel-btn border-pixel-light-gray text-pixel-xs text-pixel-primary font-bold"
            >
              -
            </button>
          </div>
        </div>
        
        {/* Cost Calculation */}
        <div className="mt-2 bg-pixel-dark-gray pixel-panel border-pixel-gray p-2">
          <div className="flex justify-between items-center text-pixel-xs">
            <span className="text-pixel-primary font-bold uppercase">
              {selectedAction === 'Sell' ? 'You receive:' : selectedAction === 'Sabotage' ? 'Attack cost:' : 'Total cost:'}
            </span>
            <span className={`font-bold ${
              selectedAction === 'Sell' ? 'text-pixel-success' : 
              selectedAction === 'Sabotage' ? 'text-pixel-error' : 'text-pixel-warning'
            }`}>
              {selectedAction === 'Sabotage' ? '100' : calculateCost()} tokens
            </span>
          </div>
          {selectedAction === 'Buy' && (
            <div className="flex justify-between items-center text-pixel-xs mt-1">
              <span className="text-pixel-primary font-bold">After purchase:</span>
              <span className={`font-bold ${
                currentPlayer.tokens - calculateCost() >= 0 ? 'text-pixel-success' : 'text-pixel-error'
              }`}>
                {currentPlayer.tokens - calculateCost()} tokens
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Target Selection (for Sabotage) */}
      {selectedAction === 'Sabotage' && (
        <div>
          <label className="block text-pixel-xs font-bold text-pixel-primary mb-2 uppercase">Select Target</label>
          <div className="grid grid-cols-2 gap-1 mb-2">
            {players.filter(player => player.id !== currentPlayer.id).map((player) => {
              const resourceAmount = player.assets[selectedResource];
              return (
                <button
                  key={player.id}
                  onClick={() => {
                    if (resourceAmount > 0) {
                      playSound('click');
                      onTargetChange(player.name);
                    }
                  }}
                  className={`p-2 pixel-btn text-pixel-xs font-bold uppercase tracking-wider ${
                    targetPlayer === player.name
                      ? 'bg-pixel-error text-pixel-black border-pixel-black'
                      : resourceAmount > 0
                        ? 'bg-pixel-gray hover:bg-pixel-light-gray text-pixel-primary border-pixel-light-gray'
                        : 'bg-pixel-dark-gray text-pixel-gray border-pixel-gray cursor-not-allowed'
                  }`}
                  disabled={resourceAmount === 0}
                >
                  <div>{player.name.split(' ')[0]}</div>
                  <div className="text-pixel-xs opacity-75">
                    {resourceAmount} {selectedResource}
                  </div>
                </button>
              );
            })}
          </div>
          
          {targetPlayer && (
            <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-2">
              <div className="text-pixel-xs text-pixel-warning font-bold uppercase mb-1">
                Target: {targetPlayer}
              </div>
              <div className="text-pixel-xs text-pixel-light-gray">
                Available {selectedResource}: {players.find(p => p.name === targetPlayer)?.assets[selectedResource] || 0}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Enhanced Execute Button */}
      <div className="space-y-2">
        <button
          onClick={() => {
            if (canPerformAction()) {
              playSound('click');
              onConfirmAction();
            }
          }}
          disabled={!canPerformAction()}
          className={`w-full px-3 py-2 pixel-btn font-bold text-pixel-sm uppercase tracking-wider ${
            canPerformAction()
              ? 'bg-pixel-primary hover:bg-pixel-accent text-pixel-black border-pixel-black'
              : 'bg-pixel-gray text-pixel-light-gray border-pixel-light-gray cursor-not-allowed'
          }`}
        >
          Execute {selectedAction}
        </button>
        
        {/* Error Messages */}
        {!canPerformAction() && (
          <div className="text-pixel-xs text-pixel-error font-bold text-center uppercase">
            {selectedAction === 'Buy' && currentPlayer.tokens < calculateCost() && 'Insufficient tokens'}
            {(selectedAction === 'Sell' || selectedAction === 'Burn') && currentPlayer.assets[getAssetKey(selectedResource)] < amount && 'Insufficient resources'}
            {selectedAction === 'Sabotage' && !targetPlayer && 'Select a target'}
            {selectedAction === 'Sabotage' && currentPlayer.tokens < 100 && 'Need 100 tokens'}
            {amount <= 0 && 'Invalid amount'}
          </div>
        )}
        
        {/* Action Summary for Advanced Mode */}
        {showAdvanced && canPerformAction() && (
          <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-2">
            <div className="text-pixel-xs text-pixel-primary font-bold uppercase mb-1">Action Summary</div>
            <div className="text-pixel-xs text-pixel-light-gray">
              {selectedAction === 'Buy' && `Buy ${amount} ${selectedResource} for ${calculateCost()} tokens`}
              {selectedAction === 'Sell' && `Sell ${amount} ${selectedResource} for ${calculateCost()} tokens`}
              {selectedAction === 'Burn' && `Burn ${amount} ${selectedResource} to boost market price`}
              {selectedAction === 'Sabotage' && `Attack ${targetPlayer}'s ${amount} ${selectedResource} for 100 tokens`}
            </div>
          </div>
        )}
      </div>
      
      {/* Quick Tips for Advanced Mode */}
      {showAdvanced && (
        <div className="border-t-2 border-pixel-gray pt-2">
          <div className="text-pixel-xs text-pixel-light-gray font-bold uppercase mb-1">Pro Tips</div>
          <div className="text-pixel-xs text-pixel-light-gray space-y-1">
            <div>• Burn resources to increase market prices</div>
            <div>• Sell at 80% of market value</div>
            <div>• Sabotage costs 100 tokens regardless of amount</div>
          </div>
        </div>
      )}
    </div>
  );
}
