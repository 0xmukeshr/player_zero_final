import React, { useState, useEffect } from 'react';
import { useAudio } from '../hooks/useAudio';

interface RecentActionsProps {
  actions: string[];
  currentRound: number;
  maxRounds: number;
  actionsByRound?: { [round: number]: string[] };
}

export function RecentActions({ actions, currentRound, maxRounds, actionsByRound = {} }: RecentActionsProps) {
  const [selectedRound, setSelectedRound] = useState<number>(currentRound);
  const [transactionAddresses, setTransactionAddresses] = useState<{[key: string]: string}>({});
  const { playSound } = useAudio();

  // Function to generate a stable transaction address for an action
  const getTransactionAddress = (roundIndex: number, actionIndex: number, actionText: string) => {
    const key = `${roundIndex}-${actionIndex}-${actionText}`;
    if (!transactionAddresses[key]) {
      // Generate deterministic address based on action content
      const hash = actionText.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      const randomSeed = Math.abs(hash) + roundIndex + actionIndex;
      const address = '0x' + randomSeed.toString(16).padStart(8, '0') + 
                     Math.abs(hash).toString(16).padStart(32, '0').substring(0, 32);
      
      setTransactionAddresses(prev => ({
        ...prev,
        [key]: address
      }));
      return address;
    }
    return transactionAddresses[key];
  };
  
  // Auto-switch to current round when round changes, but don't play sound
  useEffect(() => {
    setSelectedRound(currentRound);
  }, [currentRound]);
  
  // Get actions for the selected round
  // If it's the current round, use the live actions prop
  // Otherwise, use historical actions from actionsByRound
const displayActions = selectedRound === currentRound 
    ? actions
    : (actionsByRound[selectedRound] || []);
  
  // Generate round options (show ALL rounds from 1 to current round)
  const availableRounds = Array.from({ length: currentRound }, (_, i) => i + 1)
    .sort((a, b) => b - a); // Sort descending (most recent first)

  return (
    <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray overflow-hidden">
      <div className="px-3 py-2 border-b-2 border-pixel-gray flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="text-pixel-sm font-bold text-pixel-primary uppercase tracking-wider">Recent Actions</h3>
          <div className="flex items-center space-x-1">
    
  
          </div>
        </div>
        <div className="text-pixel-xs text-pixel-base-gray font-bold">
          {currentRound}/{maxRounds}
        </div>
      </div>
      
      {/* Round Selector and Actions in horizontal layout */}
      <div className="p-3">
        <div className="flex items-center space-x-3 mb-3">
          <label className="text-pixel-xs font-bold text-pixel-base-gray uppercase tracking-wider whitespace-nowrap"></label>
          <select 
            value={selectedRound}
            onChange={(e) => {
              playSound('click');
              setSelectedRound(Number(e.target.value));
            }}
            className="flex-1 bg-pixel-gray border-2 border-pixel-base-gray text-pixel-xs text-pixel-base-gray font-bold p-1 pixel-card uppercase tracking-wider focus:border-pixel-primary focus:outline-none"
          >
            {availableRounds.map(round => {
              const actionCount = round === currentRound 
                ? actions.length 
                : (actionsByRound[round]?.length || 0);
              
              return (
                <option key={round} value={round} className="bg-pixel-gray">
                  Round {round}{round === currentRound ? ' (Current)' : ''} ({actionCount})
                </option>
              );
            })}
          </select>
        </div>
        
        {/* Actions in two-column grid layout for all screen sizes */}
        {displayActions.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {displayActions.slice(0, 6).map((action, index) => {
              // Get stable transaction address
              const transactionAddress = getTransactionAddress(selectedRound, index, action);
              
              return (
                <div key={`${selectedRound}-${index}`} className="pixel-card bg-pixel-gray border-pixel-base-gray p-2 hover:bg-pixel-base-gray transition-colors group flex flex-col min-h-[80px]">
                  {(() => {
                    // Check if action contains transaction hash
                    const txHashMatch = action.match(/\(TX: (0x[a-fA-F0-9]+)\)/);
                    const hasRealTxHash = txHashMatch && txHashMatch[1];
                    const actionTextWithoutTx = hasRealTxHash 
                      ? action.replace(/\s*\(TX: 0x[a-fA-F0-9]+\)/, '')
                      : action;
                    const displayTxHash = hasRealTxHash ? txHashMatch[1] : transactionAddress;
                    
                    return (
                      <>
                        <div className="text-pixel-xs text-pixel-base-gray group-hover:text-black font-bold leading-tight transition-colors break-words hyphens-auto flex-1">
                          {actionTextWithoutTx}
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-1 border-t border-pixel-base-gray">
                          <div className="text-pixel-xs text-pixel-primary opacity-75">
                            #{index + 1}
                          </div>
                          <div
                            className={`text-pixel-xs opacity-75 cursor-pointer hover:opacity-100 transition-opacity truncate max-w-[80px] ${
                              hasRealTxHash ? 'text-pixel-success' : 'text-pixel-warning'
                            }`}
                            onClick={() => {
                              navigator.clipboard.writeText(displayTxHash);
                              playSound('click');
                            }}
                            title={`${hasRealTxHash ? 'Real transaction hash' : 'Simulated address'} - Click to copy: ${displayTxHash}`}
                          >
                            {displayTxHash.substring(0, 6)}...{displayTxHash.substring(displayTxHash.length - 4)}
                          </div>
                        </div>
                      </>
                    );
                  })()
                  }
                </div>
              );
            })}
          </div>
        ) : (
          <div className="pixel-card bg-pixel-gray border-pixel-base-gray p-4 text-center">
            <div className="text-pixel-sm text-pixel-base-gray font-bold mb-2">
            </div>
            <div className="text-pixel-xs text-pixel-base-gray font-bold">
              {selectedRound === currentRound 
                ? "No actions this round yet. Make the first move!" 
                : `No actions recorded for Round ${selectedRound}`
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
