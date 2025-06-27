import { useState, useCallback } from "react";
import { useAccount } from "@starknet-react/core";
import { useDojoSDK } from "@dojoengine/sdk/react";
import { Account, CairoCustomEnum } from "starknet";
import useAppStore, { AssetType } from "../../zustand/store";

interface BuyAssetActionState {
  isLoading: boolean;
  error: string | null;
  txHash: string | null;
  txStatus: 'PENDING' | 'SUCCESS' | 'REJECTED' | null;
}

interface UseBuyAssetReturn {
  buyAssetState: BuyAssetActionState;
  executeBuyAsset: (asset: AssetType) => Promise<{ success: boolean; txHash?: string; error?: string }>;
  canBuyAsset: boolean;
  resetBuyAssetState: () => void;
}

export const useBuyAsset = (): UseBuyAssetReturn => {
  const { account, status } = useAccount();
  const { client } = useDojoSDK();
  const { 
    player, 
    currentGame, 
    inventory,  
    updateInventoryAsset,
    updatePlayerBalance,
    getAssetPrice 
  } = useAppStore();

  const [buyAssetState, setBuyAssetState] = useState<BuyAssetActionState>({
    isLoading: false,
    error: null,
    txHash: null,
    txStatus: null
  });

  const isConnected = status === "connected";
  const hasPlayer = player !== null;
  const hasActiveGame = currentGame?.is_active === true;
  const canBuyAsset = isConnected && hasPlayer && hasActiveGame && !buyAssetState.isLoading;
  // console.log(isConnected , hasPlayer , hasActiveGame , !buyAssetState.isLoading);
  
  const executeBuyAsset = useCallback(async (asset: AssetType) => {
    console.log("buying 0",asset);
    if (!canBuyAsset || !account || !currentGame) {
      const errorMessage = !account ? "Please connect your controller" : 
                          !currentGame ? "No active game found" : 
                          "Cannot buy asset right now";
      setBuyAssetState(prev => ({
        ...prev,
        error: errorMessage
      }));
      return { success: false, error: errorMessage };
    }

    // Check if player has enough balance
    const assetPrice = getAssetPrice(asset);
    const playerBalance = player?.token_balance || 0;
    console.log("buying 1",asset);
    if (Number(playerBalance) < Number(assetPrice)) {
      const errorMessage = `Insufficient balance. Need ${assetPrice} tokens`;
      setBuyAssetState(prev => ({
        ...prev,
        error: errorMessage
      }));
      return { success: false, error: errorMessage };
    }
console.log("buying 2",asset);
    try {
      setBuyAssetState({
        isLoading: true,
        error: null,
        txHash: null,
        txStatus: 'PENDING'
      });

      console.log(`📤 Executing buy ${asset} transaction...`,currentGame.id);

      // Create asset enum for the transaction
      const assetEnum = new CairoCustomEnum({ 
        Gold: asset === 'Gold' ? "" : undefined,
        Water: asset === 'Water' ? "" : undefined,
        Oil: asset === 'Oil' ? "" : undefined,
      });

      const tx = await client.actions.buyAsset(
        account as Account, 
        currentGame.id, 
        assetEnum
      );
      
      console.log("📥 Buy asset transaction response:", tx);

      if (tx?.transaction_hash) {
        setBuyAssetState(prev => ({ ...prev, txHash: tx.transaction_hash }));
      }

      if (tx && tx.code === "SUCCESS") {
        console.log(`✅ Buy ${asset} transaction successful!`);

        // Optimistic updates
        const currentAssetAmount = inventory ? Number(inventory[asset.toLowerCase() as keyof typeof inventory]) : 0;
        const newAssetAmount = currentAssetAmount + 1;
        const newPlayerBalance = Number(playerBalance) - Number(assetPrice);

        updateInventoryAsset(asset, newAssetAmount);
        updatePlayerBalance(newPlayerBalance);

        setBuyAssetState(prev => ({
          ...prev,
          txStatus: 'SUCCESS',
          isLoading: false
        }));

        // Auto-clear after 3 seconds
        setTimeout(() => {
          setBuyAssetState({
            isLoading: false,
            error: null,
            txHash: null,
            txStatus: null
          });
        }, 3000);

        return { success: true, txHash: tx.transaction_hash };
      } else {
        throw new Error(`Buy asset transaction failed with code: ${tx?.code || 'unknown'}`);
      }

    } catch (error) {
      console.error(`❌ Error executing buy ${asset}:`, error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setBuyAssetState({
        isLoading: false,
        error: errorMessage,
        txHash: null,
        txStatus: 'REJECTED'
      });

      // Auto-clear error after 5 seconds
      setTimeout(() => {
        setBuyAssetState({
          isLoading: false,
          error: null,
          txHash: null,
          txStatus: null
        });
      }, 5000);

      return { success: false, error: errorMessage };
    }
  }, [
    canBuyAsset, 
    account, 
    currentGame, 
    client.actions, 
    player, 
    inventory,
    getAssetPrice,
    updateInventoryAsset,
    updatePlayerBalance
  ]);

  const resetBuyAssetState = useCallback(() => {
    setBuyAssetState({
      isLoading: false,
      error: null,
      txHash: null,
      txStatus: null
    });
  }, []);

  return {
    buyAssetState,
    executeBuyAsset,
    canBuyAsset,
    resetBuyAssetState
  };
};