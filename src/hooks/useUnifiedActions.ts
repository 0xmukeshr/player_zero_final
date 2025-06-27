import { useCallback } from 'react';
import { AssetType, ActionType } from '../zustand/store';
import { useBuyAsset } from '../dojo/hooks/useBuyAsset';
import { useSellAsset } from '../dojo/hooks/useSellAsset';
import { useBurnAsset } from '../dojo/hooks/useBurnAsset';
import { useSabotage } from '../dojo/hooks/useSabotage';
import { useSocket } from '../context/SocketContext';

interface UseUnifiedActionsReturn {
  executeAction: (
    actionType: ActionType,
    assetType: AssetType,
    targetPlayer?: string
  ) => Promise<{
    success: boolean;
    dojoSuccess?: boolean;
    socketSuccess?: boolean;
    error?: string;
  }>;
  isProcessing: boolean;
  canExecuteAction: (actionType: ActionType) => boolean;
}

export const useUnifiedActions = (): UseUnifiedActionsReturn => {
  const { socket } = useSocket();
  
  // Dojo hooks
  const { executeBuyAsset, canBuyAsset, buyAssetState } = useBuyAsset();
  const { executeSellAsset, canSellAsset, sellAssetState } = useSellAsset();
  const { executeBurnAsset, canBurnAsset, burnAssetState } = useBurnAsset();
  const { executeSabotage, canSabotage, sabotageState } = useSabotage();

  const isProcessing = 
    buyAssetState.isLoading ||
    sellAssetState.isLoading ||
    burnAssetState.isLoading ||
    sabotageState.isLoading;

  const canExecuteAction = useCallback((actionType: ActionType): boolean => {
    switch (actionType) {
      case 'Buy':
        return canBuyAsset;
      case 'Sell':
        return canSellAsset;
      case 'Burn':
        return canBurnAsset;
      case 'Sabotage':
        return canSabotage;
      default:
        return false;
    }
  }, [canBuyAsset, canSellAsset, canBurnAsset, canSabotage]);

  const executeAction = useCallback(async (
    actionType: ActionType,
    assetType: AssetType,
    targetPlayer?: string
  ) => {
    let dojoSuccess = false;
    let socketSuccess = false;
    let error: string | undefined;
    let transactionHash: string | undefined;

    console.log(`🎮 Executing unified action: ${actionType} ${assetType}`, { targetPlayer });

    // Execute Dojo action first
    try {
      switch (actionType) {
        case 'Buy':
          console.log("buying 1",canBuyAsset);
          if (canBuyAsset) {
            const buyResult = await executeBuyAsset(assetType);
            if (buyResult?.success) {
              dojoSuccess = true;
              console.log(`✅ Dojo ${actionType} executed successfully with tx: ${buyResult.txHash}`);
              // Store transaction hash for socket emission
              transactionHash = buyResult.txHash;
            } else {
              throw new Error(buyResult?.error || 'Buy action failed');
            }
          } else {
            throw new Error('Cannot execute buy action via Dojo');
          }
          break;
        
        case 'Sell':
          if (canSellAsset) {
            const sellResult = await executeSellAsset(assetType);
            if (sellResult?.success) {
              dojoSuccess = true;
              console.log(`✅ Dojo ${actionType} executed successfully with tx: ${sellResult.txHash}`);
              transactionHash = sellResult.txHash;
            } else {
              throw new Error(sellResult?.error || 'Sell action failed');
            }
          } else {
            throw new Error('Cannot execute sell action via Dojo');
          }
          break;
        
        case 'Burn':
          if (canBurnAsset) {
            const burnResult = await executeBurnAsset(assetType);
            if (burnResult?.success) {
              dojoSuccess = true;
              console.log(`✅ Dojo ${actionType} executed successfully with tx: ${burnResult.txHash}`);
              transactionHash = burnResult.txHash;
            } else {
              throw new Error(burnResult?.error || 'Burn action failed');
            }
          } else {
            throw new Error('Cannot execute burn action via Dojo');
          }
          break;
        
        case 'Sabotage':
          if (canSabotage && targetPlayer) {
            const sabotageResult = await executeSabotage(targetPlayer, assetType);
            if (sabotageResult?.success) {
              dojoSuccess = true;
              console.log(`✅ Dojo ${actionType} executed successfully with tx: ${sabotageResult.txHash}`);
              transactionHash = sabotageResult.txHash;
            } else {
              throw new Error(sabotageResult?.error || 'Sabotage action failed');
            }
          } else {
            throw new Error('Cannot execute sabotage action via Dojo');
          }
          break;
        
        default:
          throw new Error(`Unknown action type: ${actionType}`);
      }
    } catch (err) {
      console.error(`❌ Dojo ${actionType} failed:`, err);
      error = err instanceof Error ? err.message : 'Dojo action failed';
    }
    // Execute socket action (for UI updates and legacy compatibility)
    try {
      
      
      if (socket) {
        const actionData = {
          action: actionType,
          resource: assetType,
          amount: 1, // Default amount
          targetPlayer: actionType === 'Sabotage' ? targetPlayer : undefined,
          transactionHash: transactionHash // Use actual transaction hash if available
        };
        console.log("actionData",actionData);
        
        socket.emit('player-action', actionData);
        socketSuccess = true;
        console.log(`✅ Socket ${actionType} emitted successfully`);
      } else {
        console.warn('⚠️ No socket connection available');
      }
    } catch (err) {
      console.error(`❌ Socket ${actionType} failed:`, err);
      // Don't update error here since socket failure is not critical
    }

    const success = dojoSuccess; // Primary success is based on Dojo
    
    return {
      success,
      dojoSuccess,
      socketSuccess,
      error: success ? undefined : error
    };
  }, [
    socket,
    executeBuyAsset,
    executeSellAsset,
    executeBurnAsset,
    executeSabotage,
    canBuyAsset,
    canSellAsset,
    canBurnAsset,
    canSabotage
  ]);

  return {
    executeAction,
    isProcessing,
    canExecuteAction
  };
};
