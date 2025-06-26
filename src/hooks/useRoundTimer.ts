import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { useMarket } from '../dojo/hooks/fetchMarket';

interface UseRoundTimerProps {
  isHost: boolean;
  gameState: any;
  gameStarted: boolean;
  onRoundAdvance?: () => void;
}

interface UseRoundTimerReturn {
  timeUntilNextRound: number;
  isAutoAdvanceEnabled: boolean;
  toggleAutoAdvance: () => void;
  manualAdvanceRound: () => void;
}

export const useRoundTimer = ({
  isHost,
  gameState,
  gameStarted,
  onRoundAdvance
}: UseRoundTimerProps): UseRoundTimerReturn => {
  const { socket } = useSocket();
  const { refetch: refetchMarket } = useMarket();
  
  const [timeUntilNextRound, setTimeUntilNextRound] = useState(0);
  const [isAutoAdvanceEnabled, setIsAutoAdvanceEnabled] = useState(true);
  const [roundStartTime, setRoundStartTime] = useState<number | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoAdvanceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize round timer when game starts or round changes
  useEffect(() => {
    if (!gameStarted || !gameState || gameState.status !== 'playing') {
      return;
    }

    // Reset timer when round changes
    if (gameState.roundInProgress && !roundStartTime) {
      console.log(`🕐 Round ${gameState.currentRound} started - starting 1 minute timer`);
      setRoundStartTime(Date.now());
      setTimeUntilNextRound(60); // 60 seconds
    }

    // Clear timers when round is not in progress
    if (!gameState.roundInProgress && roundStartTime) {
      setRoundStartTime(null);
      setTimeUntilNextRound(0);
    }
  }, [gameState?.roundInProgress, gameState?.currentRound, gameStarted]);

  // Handle round countdown
  useEffect(() => {
    if (!roundStartTime || !gameStarted) {
      return;
    }

    // Clear existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - roundStartTime) / 1000);
      const remaining = Math.max(0, 60 - elapsed); // 60 seconds per round
      
      setTimeUntilNextRound(remaining);

      // Auto-advance round if host and timer reaches 0
      if (remaining === 0 && isHost && isAutoAdvanceEnabled) {
        console.log('⏰ Round timer expired - auto-advancing to next round');
        manualAdvanceRound();
        clearInterval(timerRef.current!);
        timerRef.current = null;
      }
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [roundStartTime, isHost, isAutoAdvanceEnabled, gameStarted]);

  // Host auto-advance logic with 10-second delay and market fetching
  const manualAdvanceRound = () => {
    if (!isHost || !socket) {
      console.warn('⚠️ Only host can advance rounds');
      return;
    }

    console.log('🎮 Host advancing to next round...');
    
    // Clear any existing auto-advance timeout
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
    }

    // Emit socket event to advance round
    socket.emit('next-round');
    
    // Set up 10-second delay before fetching market data
    autoAdvanceTimeoutRef.current = setTimeout(async () => {
      console.log('⏳ 10 seconds elapsed - fetching updated market data');
      
      try {
        if (refetchMarket) {
          await refetchMarket();
          console.log('✅ Market data updated after round advance');
        }
      } catch (error) {
        console.error('❌ Error fetching market data after round advance:', error);
      }

      if (onRoundAdvance) {
        onRoundAdvance();
      }
    }, 10000); // 10 seconds delay
  };

  const toggleAutoAdvance = () => {
    setIsAutoAdvanceEnabled(prev => !prev);
    console.log(`🔄 Auto-advance ${!isAutoAdvanceEnabled ? 'enabled' : 'disabled'}`);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (autoAdvanceTimeoutRef.current) {
        clearTimeout(autoAdvanceTimeoutRef.current);
      }
    };
  }, []);

  return {
    timeUntilNextRound,
    isAutoAdvanceEnabled,
    toggleAutoAdvance,
    manualAdvanceRound
  };
};
