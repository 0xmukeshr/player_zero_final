import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useAccount } from "@starknet-react/core";
import { BigNumberish } from "starknet";
import { dojoConfig } from "../dojoConfig";
import { Market, Game } from '../../zustand/store';
import useAppStore from '../../zustand/store';

interface UseGameReturn {
  game: Game | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

interface UseGameDataOptions {
  enabled?: boolean;
  refetchInterval?: number;
  refetchOnWindowFocus?: boolean;
  refetchOnMount?: boolean;
  refetchOnReconnect?: boolean;
}

// Constants
const TORII_URL = dojoConfig.toriiUrl + "/graphql";
const GAME_QUERY = `
    query GetGame($gameId: felt252!) {
        playerzeroGameModels(where: { id: $gameId }) {
            edges {
                node {
                    id
                    round
                    is_active
                    max_rounds
                    num_players
                }
            }
            totalCount
        }
         
    }
`;

// Helper to convert hex/string values to BigNumberish
const toBigNumberish = (value: string | number): string => {
  if (typeof value === 'number') return value.toString();
  
  if (typeof value === 'string' && value.startsWith('0x')) {
    return parseInt(value, 16).toString();
  }
  
  if (typeof value === 'string') {
    return value;
  }
  
  return "0";
};

// Function to fetch game and market data from GraphQL
const fetchGameData = async (gameId: BigNumberish): Promise<{ game: Game | null}> => {
  try {
    console.log("🔍 Fetching game and market data for game:", gameId);

    const response = await fetch(TORII_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: GAME_QUERY,
        variables: { gameId: gameId.toString() }
      }),
    });

    const result = await response.json();
    console.log("📡 Game/Market GraphQL response:", result);

    let gameData: Game | null = null;

    // Extract game data
    if (result.data?.playerzeroGameModels?.edges?.length) {
      const rawGameData = result.data.playerzeroGameModels.edges[0].node;
      console.log("🎮 Raw game data:", rawGameData);

      gameData = {
        id: toBigNumberish(rawGameData.id),
        round: toBigNumberish(rawGameData.round),
        is_active: Boolean(rawGameData.is_active),
        max_rounds: toBigNumberish(rawGameData.max_rounds),
        num_players: toBigNumberish(rawGameData.num_players),
      };

      console.log("✅ Game data after conversion:", gameData);
    } else {
      console.log("❌ No game found in response");
    }

    return { game: gameData};
    
  } catch (error) {
    console.error("❌ Error fetching game/market data:", error);
    throw error;
  }
};

// Main hook with fixed dependency issues
export const UseGameData = (
  gameId?: BigNumberish, 
  options: UseGameDataOptions = {}
): UseGameReturn => {
  const {
    enabled = true,
    refetchInterval = 0,
    refetchOnWindowFocus = false,
    refetchOnMount = true,
    refetchOnReconnect = false
  } = options;

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const { account } = useAccount();
  
  // CRITICAL FIX: Use separate selectors to avoid circular dependencies
  const currentGame = useAppStore(state => state.currentGame);
  const setCurrentGame = useAppStore(state => state.setCurrentGame);
  const updateGameRound = useAppStore(state => state.updateGameRound);

  // Use refs to track values and prevent unnecessary re-renders
  const lastFetchedGameId = useRef<string | null>(null);
  const lastFetchTimestamp = useRef<number>(0);
  const isFetchingRef = useRef<boolean>(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Determine the effective game ID
  const effectiveGameId = useMemo(() => {
    return gameId || currentGame?.id;
  }, [gameId, currentGame?.id]);

  // Memoize the refetch function to prevent recreation on every render
  const refetch = useCallback(async () => {
    const targetGameId = effectiveGameId;
    
    if (!targetGameId) {
      console.log("❌ No game ID available for fetch");
      setIsLoading(false);
      return;
    }

    if (!enabled) {
      console.log("⏸️ Fetch disabled");
      return;
    }

    // Prevent concurrent fetches for the same game ID
    if (isFetchingRef.current && lastFetchedGameId.current === targetGameId.toString()) {
      console.log("⏳ Already fetching for game ID:", targetGameId);
      return;
    }

    // Throttle requests - prevent fetching the same game too frequently
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimestamp.current;
    const minInterval = 1000; // Minimum 1 second between fetches

    if (
      lastFetchedGameId.current === targetGameId.toString() && 
      timeSinceLastFetch < minInterval
    ) {
      console.log("🚫 Throttling fetch request, too soon since last fetch");
      return;
    }

    try {
      isFetchingRef.current = true;
      lastFetchedGameId.current = targetGameId.toString();
      lastFetchTimestamp.current = now;
      
      setIsLoading(true);
      setError(null);

      const { game } = await fetchGameData(targetGameId);
      console.log("🎮💰 Game and market data fetched:", { game });

      // Update game data in store only if it's different
      if (game) {
        const currentStoreGame = useAppStore.getState().currentGame;
        
        if (!currentStoreGame || currentStoreGame.id !== game.id) {
          // Set new game
          setCurrentGame(game);
          console.log("📝 Set new game in store:", game);
        } else {
          // Check if update is needed
          const needsUpdate = 
            game.round !== currentStoreGame.round ||
            game.is_active !== currentStoreGame.is_active ||
            game.num_players !== currentStoreGame.num_players;

          if (needsUpdate) {
            // Update specific fields to avoid unnecessary re-renders
            if (game.round !== currentStoreGame.round) {
              updateGameRound(game.round);
            }
            
            // Update other properties if they changed
            setCurrentGame({
              ...currentStoreGame,
              ...game
            });
            console.log("🔄 Updated existing game in store:", game);
          } else {
            console.log("✨ No update needed, game data unchanged");
          }
        }
      }

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error occurred');
      console.error("❌ Error in game/market refetch:", error);
      setError(error);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [effectiveGameId, enabled, setCurrentGame, updateGameRound]);

  // Set up polling interval if specified
  useEffect(() => {
    if (refetchInterval > 0 && enabled && effectiveGameId) {
      intervalRef.current = setInterval(() => {
        refetch();
      }, refetchInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [refetch, refetchInterval, enabled, effectiveGameId]);

  // Initial fetch when gameId changes (with proper dependency management)
  useEffect(() => {
    if (effectiveGameId && enabled && refetchOnMount) {
      // Only fetch if it's a different game ID or enough time has passed
      const gameIdString = effectiveGameId.toString();
      const now = Date.now();
      const timeSinceLastFetch = now - lastFetchTimestamp.current;
      
      if (
        lastFetchedGameId.current !== gameIdString || 
        timeSinceLastFetch > 5000 // 5 seconds
      ) {
        console.log("🔄 Game ID changed or sufficient time passed, refetching:", effectiveGameId);
        refetch();
      }
    }
  }, [effectiveGameId, enabled, refetchOnMount]); // Removed refetch from dependencies to prevent loop

  // Handle account changes
  useEffect(() => {
    if (!account) {
      console.log("❌ No account, clearing game data");
      setCurrentGame(null);
      setError(null);
      setIsLoading(false);
      lastFetchedGameId.current = null;
      lastFetchTimestamp.current = 0;
    }
  }, [account, setCurrentGame]);

  // Handle window focus refetch
  useEffect(() => {
    if (!refetchOnWindowFocus || !enabled) return;

    const handleFocus = () => {
      if (effectiveGameId) {
        refetch();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetch, refetchOnWindowFocus, enabled, effectiveGameId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      isFetchingRef.current = false;
    };
  }, []);

  return {
    game: currentGame,
    isLoading,
    error,
    refetch
  };
};