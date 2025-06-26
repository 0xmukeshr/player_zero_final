import { useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { useMarket } from '../dojo/hooks/fetchMarket';

interface UseMarketSyncProps {
  isHost: boolean;
  gameStarted: boolean;
  onMarketFetched?: () => void;
}

/**
 * Hook for non-host players to automatically sync market data
 * when receiving socket events from the host
 */
export const useMarketSync = ({
  isHost,
  gameStarted,
  onMarketFetched
}: UseMarketSyncProps) => {
  const { socket } = useSocket();
  const { refetch: refetchMarket } = useMarket();
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (!socket || isHost || !gameStarted) {
      return;
    }

    console.log('📡 Setting up market sync for non-host player');

    // Fetch market data immediately when game starts (for non-hosts)
    if (!isInitializedRef.current) {
      console.log('🎮 Initial market data fetch for non-host player');
      if (refetchMarket) {
        refetchMarket()
          .then(() => {
            console.log('✅ Initial market data fetched for non-host');
            if (onMarketFetched) onMarketFetched();
          })
          .catch((error) => {
            console.error('❌ Error fetching initial market data:', error);
          });
      }
      isInitializedRef.current = true;
    }

    // Listen for next-round events and fetch market data
    const handleNextRound = (data: { round: number; delay: number }) => {
      console.log(`🔄 Non-host received next-round event for round ${data.round}`);
      
      // Wait for the delay period before fetching market data
      setTimeout(() => {
        console.log(`⏳ Fetching market data after ${data.delay}ms delay`);
        if (refetchMarket) {
          refetchMarket()
            .then(() => {
              console.log(`✅ Market data synced for round ${data.round}`);
              if (onMarketFetched) onMarketFetched();
            })
            .catch((error) => {
              console.error(`❌ Error syncing market data for round ${data.round}:`, error);
            });
        }
      }, data.delay);
    };

    // Listen for round-started events and optionally fetch market data again
    const handleRoundStarted = (data: { round: number }) => {
      console.log(`🎯 Non-host received round-started event for round ${data.round}`);
      
      // Optional: Fetch market data again when round officially starts
      // This ensures we have the most up-to-date data
      if (refetchMarket) {
        refetchMarket()
          .then(() => {
            console.log(`✅ Market data re-synced on round start for round ${data.round}`);
            if (onMarketFetched) onMarketFetched();
          })
          .catch((error) => {
            console.error(`❌ Error re-syncing market data on round start:`, error);
          });
      }
    };

    // Add event listeners
    socket.on('next-round', handleNextRound);
    socket.on('round-started', handleRoundStarted);

    // Cleanup
    return () => {
      socket.off('next-round', handleNextRound);
      socket.off('round-started', handleRoundStarted);
    };
  }, [socket, isHost, gameStarted, refetchMarket, onMarketFetched]);

  // Reset initialization when game status changes
  useEffect(() => {
    if (!gameStarted) {
      isInitializedRef.current = false;
    }
  }, [gameStarted]);
};
