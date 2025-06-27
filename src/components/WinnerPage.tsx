import React, { useState, useEffect } from 'react';
import { Trophy, Users, Target, TrendingUp, Award, Star, Zap, Clock } from 'lucide-react';
import { useAudio } from '../hooks/useAudio';

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

interface MarketPrices {
  gold: number;
  water: number;
  oil: number;
}

interface PlayerScore extends Player {
  finalScore: number;
  assetValue: number;
  rank: number;
  portfolio: {
    goldValue: number;
    waterValue: number;
    oilValue: number;
  };
  percentageOfTotal: number;
}

interface WinnerPageProps {
  players: Player[];
  marketPrices: MarketPrices;
  gameState: any;
  onExitGame: () => void;
  onPlayAgain?: () => void;
}

export const WinnerPage: React.FC<WinnerPageProps> = ({
  players,
  marketPrices,
  gameState,
  onExitGame,
  onPlayAgain
}) => {
  const { playSound } = useAudio();
  const [currentTab, setCurrentTab] = useState<'rankings' | 'details' | 'stats'>('rankings');
  const [isMobile, setIsMobile] = useState(false);
  const [showCelebration, setShowCelebration] = useState(true);

  // Check screen size for responsive design
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Play victory sound on mount
  useEffect(() => {
    playSound('action');
    // Hide celebration animation after 3 seconds
    const timer = setTimeout(() => setShowCelebration(false), 3000);
    return () => clearTimeout(timer);
  }, [playSound]);

  // Calculate final scores for all players with enhanced details
  const calculateFinalScores = (): PlayerScore[] => {
    const scoredPlayers = players.map(player => {
      const goldValue = player.assets.gold * marketPrices.gold;
      const waterValue = player.assets.water * marketPrices.water;
      const oilValue = player.assets.oil * marketPrices.oil;
      const assetValue = goldValue + waterValue + oilValue;
      const finalScore = player.tokens + assetValue;
      
      return {
        ...player,
        assetValue,
        finalScore,
        rank: 0, // Will be set after sorting
        portfolio: {
          goldValue,
          waterValue,
          oilValue
        },
        percentageOfTotal: 0 // Will be calculated
      };
    });

    // Sort by final score (highest first) and assign ranks
    scoredPlayers.sort((a, b) => b.finalScore - a.finalScore);
    
    // Calculate total score for percentage calculation
    const totalScore = scoredPlayers.reduce((sum, player) => sum + player.finalScore, 0);
    
    scoredPlayers.forEach((player, index) => {
      player.rank = index + 1;
      player.percentageOfTotal = totalScore > 0 ? (player.finalScore / totalScore) * 100 : 0;
    });

    return scoredPlayers;
  };

  const finalScores = calculateFinalScores();
  const winner = finalScores[0];
  const topThree = finalScores.slice(0, 3);


  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'text-pixel-success';
      case 2: return 'text-pixel-warning';
      case 3: return 'text-pixel-accent';
      default: return 'text-pixel-base-gray';
    }
  };

  const getRankBgColor = (rank: number) => {
    switch (rank) {
      case 1: return 'bg-pixel-success';
      case 2: return 'bg-pixel-warning';
      case 3: return 'bg-pixel-accent';
      default: return 'bg-pixel-gray';
    }
  };

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1: return '🏆';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const getAssetEmoji = (asset: string) => {
    switch (asset) {
      case 'gold': return '🪙';
      case 'water': return '💧';
      case 'oil': return '🛢️';
      default: return '💰';
    }
  };

  // Victory celebration component
  const VictoryCelebration = () => (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 transition-opacity duration-1000 ${
      showCelebration ? 'opacity-100' : 'opacity-0 pointer-events-none'
    }`}>
      <div className="text-center animate-pulse">
        <div className="text-6xl mb-4">🎉</div>
        <div className="text-pixel-2xl font-bold text-pixel-success mb-2">
          VICTORY!
        </div>
        <div className="text-pixel-lg text-pixel-primary">
          {winner.name} Wins!
        </div>
      </div>
    </div>
  );


  // Mobile player card component
  const MobilePlayerCard = ({ player }: { player: PlayerScore }) => (
    <div className={`pixel-panel border-pixel-gray p-4 mb-4 ${
      player.rank === 1 ? 'bg-pixel-success bg-opacity-20' :
      player.rank === 2 ? 'bg-pixel-warning bg-opacity-20' :
      player.rank === 3 ? 'bg-pixel-accent bg-opacity-20' : 'bg-pixel-dark-gray'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <span className={`text-2xl ${getRankColor(player.rank)}`}>
            {getRankBadge(player.rank)}
          </span>
          <div>
            <div className={`font-bold text-pixel-sm ${getRankColor(player.rank)}`}>
              {player.name}
            </div>
            <div className="text-pixel-xs text-pixel-base-gray">
              Rank #{player.rank}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className={`font-bold text-pixel-lg ${getRankColor(player.rank)}`}>
            {formatNumber(player.finalScore)}
          </div>
          <div className="text-pixel-xs text-pixel-base-gray">
            Final Score
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3 text-pixel-xs">
        <div className="bg-pixel-gray pixel-panel border-pixel-light-gray p-2">
          <div className="text-pixel-primary font-bold mb-1">Tokens</div>
          <div className="text-pixel-base-gray">{formatNumber(player.tokens)}</div>
        </div>
        <div className="bg-pixel-gray pixel-panel border-pixel-light-gray p-2">
          <div className="text-pixel-primary font-bold mb-1">Assets</div>
          <div className="text-pixel-base-gray">{formatNumber(player.assetValue)}</div>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-2 mt-3 text-pixel-xs">
        <div className="text-center p-2 bg-pixel-gray pixel-panel border-pixel-light-gray">
          <div className="text-pixel-accent font-bold">🪙</div>
          <div className="text-pixel-base-gray">{player.assets.gold}</div>
          <div className="text-pixel-xs text-pixel-base-gray">×{marketPrices.gold}</div>
        </div>
        <div className="text-center p-2 bg-pixel-gray pixel-panel border-pixel-light-gray">
          <div className="text-pixel-accent font-bold">💧</div>
          <div className="text-pixel-base-gray">{player.assets.water}</div>
          <div className="text-pixel-xs text-pixel-base-gray">×{marketPrices.water}</div>
        </div>
        <div className="text-center p-2 bg-pixel-gray pixel-panel border-pixel-light-gray">
          <div className="text-pixel-accent font-bold">🛢️</div>
          <div className="text-pixel-base-gray">{player.assets.oil}</div>
          <div className="text-pixel-xs text-pixel-base-gray">×{marketPrices.oil}</div>
        </div>
      </div>
      
      <div className="mt-3 p-2 bg-pixel-black pixel-panel border-pixel-gray">
        <div className="text-pixel-xs text-pixel-base-gray">
          <span className="text-pixel-primary font-bold">Portfolio: </span>
          {player.percentageOfTotal.toFixed(1)}% of total wealth
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-pixel-black scanlines font-pixel">
      {showCelebration && <VictoryCelebration />}
      
      <div className={`${isMobile ? 'p-4' : 'p-6'} max-w-6xl mx-auto`}>
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className={`${isMobile ? 'text-pixel-xl' : 'text-pixel-3xl'} font-bold text-pixel-primary uppercase tracking-wider mb-2`}>
             Game Over
          </h1>
          <div className="text-pixel-base-gray">
            <Clock className="inline w-4 h-4 mr-1" />
            Round {gameState?.currentRound || gameState?.maxRounds}/{gameState?.maxRounds}
          </div>
        </div>

        {/* Winner Announcement */}
        <div className="bg-pixel-success pixel-panel border-pixel-black p-6 mb-6 text-center">
          <div className={`${isMobile ? 'text-pixel-lg' : 'text-pixel-2xl'} font-bold text-pixel-black mb-2`}>
            🏆 CHAMPION 🏆
          </div>
          <div className={`${isMobile ? 'text-pixel-base' : 'text-pixel-xl'} font-bold text-pixel-black mb-2`}>
            {winner.name}
          </div>
          <div className={`${isMobile ? 'text-pixel-sm' : 'text-pixel-lg'} text-pixel-black`}>
            Final Score: {formatNumber(winner.finalScore)} Tokens
          </div>
          <div className="mt-2 text-pixel-xs text-pixel-black opacity-75">
            {winner.percentageOfTotal.toFixed(1)}% of total wealth
          </div>
        </div>


        {/* Mobile Tab Navigation */}
        {isMobile && (
          <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray mb-4">
            <div className="flex overflow-x-auto">
              {[
                { id: 'rankings', label: 'Rankings' },
                { id: 'details', label: 'Details'},
                { id: 'stats', label: 'Stats' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    playSound('click');
                    setCurrentTab(tab.id as typeof currentTab);
                  }}
                  className={`flex-1 min-w-0 px-3 py-2 text-pixel-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                    currentTab === tab.id
                      ? 'bg-pixel-gray text-pixel-primary border-b-2 border-pixel-primary'
                      : 'text-pixel-base-gray hover:text-pixel-primary hover:bg-pixel-gray'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-1">
                    <span className="text-sm">{tab.icon}</span>
                    <span>{tab.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content based on tab/screen size */}
        {isMobile ? (
          // Mobile Tabbed Content
          <div className="space-y-4">
            {currentTab === 'rankings' && (
              <div>
                <h2 className="text-pixel-lg font-bold text-pixel-primary mb-4 text-center">
                  Final Rankings
                </h2>
                {finalScores.map((player) => (
                  <MobilePlayerCard key={player.id} player={player} />
                ))}
              </div>
            )}
            
            {currentTab === 'details' && (
              <div className="space-y-4">
                <h2 className="text-pixel-lg font-bold text-pixel-primary mb-4 text-center">
                  Score Breakdown
                </h2>
                
                {/* Market Prices */}
                <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-4">
                  <h3 className="text-pixel-sm font-bold text-pixel-primary mb-3">
                    Final Market Prices
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-pixel-gray pixel-panel border-pixel-light-gray p-3 text-center">
                      <div className="text-xl mb-1">🪙</div>
                      <div className="text-pixel-accent font-bold text-pixel-xs">Gold</div>
                      <div className="text-pixel-primary font-bold">{marketPrices.gold}</div>
                    </div>
                    <div className="bg-pixel-gray pixel-panel border-pixel-light-gray p-3 text-center">
                      <div className="text-xl mb-1">💧</div>
                      <div className="text-pixel-accent font-bold text-pixel-xs">Water</div>
                      <div className="text-pixel-primary font-bold">{marketPrices.water}</div>
                    </div>
                    <div className="bg-pixel-gray pixel-panel border-pixel-light-gray p-3 text-center">
                      <div className="text-xl mb-1">🛢️</div>
                      <div className="text-pixel-accent font-bold text-pixel-xs">Oil</div>
                      <div className="text-pixel-primary font-bold">{marketPrices.oil}</div>
                    </div>
                  </div>
                </div>
                
                {/* Formula */}
                <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-4">
                  <h3 className="text-pixel-sm font-bold text-pixel-primary mb-3">
                    Calculation Formula
                  </h3>
                  <div className="text-pixel-xs text-pixel-base-gray space-y-2">
                    <div className="bg-pixel-gray pixel-panel border-pixel-light-gray p-3">
                      <div className="text-pixel-primary font-bold mb-2">Final Score =</div>
                      <div>💰 Tokens +</div>
                      <div>🪙 (Gold × {marketPrices.gold}) +</div>
                      <div>💧 (Water × {marketPrices.water}) +</div>
                      <div>🛢️ (Oil × {marketPrices.oil})</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {currentTab === 'stats' && (
              <div className="space-y-4">
                <h2 className="text-pixel-lg font-bold text-pixel-primary mb-4 text-center">
                   Game Statistics
                </h2>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-4 text-center">
                    <div className="text-2xl mb-2">⏱️</div>
                    <div className="text-pixel-accent font-bold text-pixel-xs mb-1">Total Rounds</div>
                    <div className="text-pixel-primary font-bold">{gameState?.maxRounds || 0}</div>
                  </div>
                  <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-4 text-center">
                    <div className="text-2xl mb-2">👥</div>
                    <div className="text-pixel-accent font-bold text-pixel-xs mb-1">Players</div>
                    <div className="text-pixel-primary font-bold">{players.length}</div>
                  </div>
                  <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-4 text-center">
                    <div className="text-2xl mb-2">🎯</div>
                    <div className="text-pixel-accent font-bold text-pixel-xs mb-1">Highest Score</div>
                    <div className="text-pixel-primary font-bold text-pixel-xs">{formatNumber(winner.finalScore)}</div>
                  </div>
                  <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-4 text-center">
                    <div className="text-2xl mb-2">⚡</div>
                    <div className="text-pixel-accent font-bold text-pixel-xs mb-1">Total Actions</div>
                    <div className="text-pixel-primary font-bold">
                      {Object.values(gameState?.actionHistory || {}).flat().length || 0}
                    </div>
                  </div>
                </div>
                
                {/* Top Performer Insights */}
                <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-4">
                  <h3 className="text-pixel-sm font-bold text-pixel-primary mb-3">
                    🏅 Champion Analysis
                  </h3>
                  <div className="space-y-2 text-pixel-xs text-pixel-base-gray">
                    <div className="flex justify-between">
                      <span>💰 Liquid Tokens:</span>
                      <span className="text-pixel-primary">{formatNumber(winner.tokens)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Asset Portfolio:</span>
                      <span className="text-pixel-primary">{formatNumber(winner.assetValue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>🎯 Portfolio Split:</span>
                      <span className="text-pixel-primary">{((winner.tokens / winner.finalScore) * 100).toFixed(1)}% / {((winner.assetValue / winner.finalScore) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>🏆 Victory Margin:</span>
                      <span className="text-pixel-primary">
                        {finalScores.length > 1 ? formatNumber(winner.finalScore - finalScores[1].finalScore) : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Desktop Layout - All content visible
          <div className="space-y-8">
            {/* Desktop Rankings Table */}
            <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-6">
              <h2 className="text-pixel-xl font-bold text-pixel-primary mb-6 text-center">
                 Final Standings
              </h2>
              
              <div className="overflow-x-auto">
                <table className="w-full text-pixel-sm">
                  <thead>
                    <tr className="border-b border-pixel-gray">
                      <th className="text-left p-3 text-pixel-primary font-bold">Rank</th>
                      <th className="text-left p-3 text-pixel-primary font-bold">Player</th>
                      <th className="text-right p-3 text-pixel-primary font-bold">Tokens</th>
                      <th className="text-right p-3 text-pixel-primary font-bold">Gold</th>
                      <th className="text-right p-3 text-pixel-primary font-bold">Water</th>
                      <th className="text-right p-3 text-pixel-primary font-bold">Oil</th>
                      <th className="text-right p-3 text-pixel-primary font-bold">Asset Value</th>
                      <th className="text-right p-3 text-pixel-primary font-bold">Final Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finalScores.map((player) => (
                      <tr 
                        key={player.id} 
                        className={`border-b border-pixel-gray ${
                          player.rank === 1 ? 'bg-pixel-success bg-opacity-20' : 
                          player.rank === 2 ? 'bg-pixel-warning bg-opacity-20' : 
                          player.rank === 3 ? 'bg-pixel-accent bg-opacity-20' : ''
                        }`}
                      >
                        <td className="p-3">
                          <div className="flex items-center space-x-2">
                            <span className={`text-pixel-lg ${getRankColor(player.rank)}`}>
                              {getRankBadge(player.rank)}
                            </span>
                            <span className={`font-bold ${getRankColor(player.rank)}`}>
                              {player.rank}
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`font-bold ${getRankColor(player.rank)}`}>
                            {player.name}
                          </span>
                        </td>
                        <td className="p-3 text-right text-pixel-base-gray">
                          {formatNumber(player.tokens)}
                        </td>
                        <td className="p-3 text-right text-pixel-base-gray">
                          {player.assets.gold}
                          <span className="text-pixel-xs text-pixel-base-gray ml-1">
                            (×{marketPrices.gold})
                          </span>
                        </td>
                        <td className="p-3 text-right text-pixel-base-gray">
                          {player.assets.water}
                          <span className="text-pixel-xs text-pixel-base-gray ml-1">
                            (×{marketPrices.water})
                          </span>
                        </td>
                        <td className="p-3 text-right text-pixel-base-gray">
                          {player.assets.oil}
                          <span className="text-pixel-xs text-pixel-base-gray ml-1">
                            (×{marketPrices.oil})
                          </span>
                        </td>
                        <td className="p-3 text-right text-pixel-base-gray">
                          {formatNumber(player.assetValue)}
                        </td>
                        <td className="p-3 text-right">
                          <span className={`font-bold text-pixel-lg ${getRankColor(player.rank)}`}>
                            {formatNumber(player.finalScore)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Desktop Enhanced Layout - Two Row Grid */}
            <div className="space-y-6">
              {/* Top Row - Market Data and Score Calculation */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Market Information Panel */}
                <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-6">
                  <h3 className="text-pixel-xl font-bold text-pixel-primary mb-6 flex items-center">
                    Market Overview
                  </h3>
                  
                  {/* Final Market Prices */}
                  <div className="mb-6">
                    <h4 className="text-pixel-sm font-bold text-pixel-accent mb-3">Final Market Prices</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-pixel-gray pixel-panel border-pixel-light-gray p-4 text-center">
                        <div className="text-2xl mb-2">🪙</div>
                        <div className="text-pixel-accent font-bold text-pixel-xs mb-1">Gold</div>
                        <div className="text-pixel-primary font-bold text-pixel-lg">{marketPrices.gold}</div>
                        <div className="text-pixel-xs text-pixel-base-gray mt-1">tokens</div>
                      </div>
                      <div className="bg-pixel-gray pixel-panel border-pixel-light-gray p-4 text-center">
                        <div className="text-2xl mb-2">💧</div>
                        <div className="text-pixel-accent font-bold text-pixel-xs mb-1">Water</div>
                        <div className="text-pixel-primary font-bold text-pixel-lg">{marketPrices.water}</div>
                        <div className="text-pixel-xs text-pixel-base-gray mt-1">tokens</div>
                      </div>
                      <div className="bg-pixel-gray pixel-panel border-pixel-light-gray p-4 text-center">
                        <div className="text-2xl mb-2">🛢️</div>
                        <div className="text-pixel-accent font-bold text-pixel-xs mb-1">Oil</div>
                        <div className="text-pixel-primary font-bold text-pixel-lg">{marketPrices.oil}</div>
                        <div className="text-pixel-xs text-pixel-base-gray mt-1">tokens</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Score Calculation Formula */}
                  <div>
                    <h4 className="text-pixel-sm font-bold text-pixel-accent mb-3">Score Formula</h4>
                    <div className="bg-pixel-gray pixel-panel border-pixel-light-gray p-4">
                      <div className="text-pixel-primary font-bold mb-3 text-center">Final Score =</div>
                      <div className="grid grid-cols-1 gap-2 text-pixel-sm">
                        <div className="flex items-center justify-between px-2 py-1 bg-pixel-black border border-pixel-gray">
                          <span className="flex items-center"><span className="mr-2">💰</span> Liquid Tokens</span>
                          <span className="text-pixel-primary">+ Direct Value</span>
                        </div>
                        <div className="flex items-center justify-between px-2 py-1 bg-pixel-black border border-pixel-gray">
                          <span className="flex items-center"><span className="mr-2">🪙</span> Gold × {marketPrices.gold}</span>
                          <span className="text-pixel-primary">+ Asset Value</span>
                        </div>
                        <div className="flex items-center justify-between px-2 py-1 bg-pixel-black border border-pixel-gray">
                          <span className="flex items-center"><span className="mr-2">💧</span> Water × {marketPrices.water}</span>
                          <span className="text-pixel-primary">+ Asset Value</span>
                        </div>
                        <div className="flex items-center justify-between px-2 py-1 bg-pixel-black border border-pixel-gray">
                          <span className="flex items-center"><span className="mr-2">🛢️</span> Oil × {marketPrices.oil}</span>
                          <span className="text-pixel-primary">+ Asset Value</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Champion Spotlight Panel */}
                <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-6">
                  <h3 className="text-pixel-xl font-bold text-pixel-primary mb-6 flex items-center">
                    Champion Spotlight
                  </h3>
                  
                  {/* Winner Card */}
                  <div className="bg-pixel-success bg-opacity-20 pixel-panel border-pixel-success p-5 mb-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <span className="text-3xl">🏆</span>
                        <div>
                          <div className="text-pixel-lg font-bold text-pixel-success">{winner.name}</div>
                          <div className="text-pixel-xs text-pixel-base-gray">Champion</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-pixel-xl font-bold text-pixel-success">{formatNumber(winner.finalScore)}</div>
                        <div className="text-pixel-xs text-pixel-base-gray">Final Score</div>
                      </div>
                    </div>
                    
                    {/* Portfolio Breakdown */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-pixel-gray pixel-panel border-pixel-light-gray p-3 text-center">
                        <div className="text-pixel-primary font-bold text-pixel-sm">{formatNumber(winner.tokens)}</div>
                        <div className="text-pixel-xs text-pixel-base-gray">💰 Liquid Tokens</div>
                        <div className="text-pixel-xs text-pixel-accent">{((winner.tokens / winner.finalScore) * 100).toFixed(1)}%</div>
                      </div>
                      <div className="bg-pixel-gray pixel-panel border-pixel-light-gray p-3 text-center">
                        <div className="text-pixel-primary font-bold text-pixel-sm">{formatNumber(winner.assetValue)}</div>
                        <div className="text-pixel-xs text-pixel-base-gray">📈 Asset Value</div>
                        <div className="text-pixel-xs text-pixel-accent">{((winner.assetValue / winner.finalScore) * 100).toFixed(1)}%</div>
                      </div>
                    </div>
                    
                    {/* Asset Holdings */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-pixel-black pixel-panel border-pixel-gray p-2 text-center">
                        <div className="text-lg">🪙</div>
                        <div className="text-pixel-xs text-pixel-base-gray">{winner.assets.gold} units</div>
                        <div className="text-pixel-xs text-pixel-primary font-bold">{formatNumber(winner.portfolio.goldValue)}</div>
                      </div>
                      <div className="bg-pixel-black pixel-panel border-pixel-gray p-2 text-center">
                        <div className="text-lg">💧</div>
                        <div className="text-pixel-xs text-pixel-base-gray">{winner.assets.water} units</div>
                        <div className="text-pixel-xs text-pixel-primary font-bold">{formatNumber(winner.portfolio.waterValue)}</div>
                      </div>
                      <div className="bg-pixel-black pixel-panel border-pixel-gray p-2 text-center">
                        <div className="text-lg">🛢️</div>
                        <div className="text-pixel-xs text-pixel-base-gray">{winner.assets.oil} units</div>
                        <div className="text-pixel-xs text-pixel-primary font-bold">{formatNumber(winner.portfolio.oilValue)}</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Performance Metrics */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center px-3 py-2 bg-pixel-gray pixel-panel border-pixel-light-gray">
                      <span className="text-pixel-sm text-pixel-base-gray">🎯 Wealth Share</span>
                      <span className="text-pixel-primary font-bold">{winner.percentageOfTotal.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center px-3 py-2 bg-pixel-gray pixel-panel border-pixel-light-gray">
                      <span className="text-pixel-sm text-pixel-base-gray">📊 Victory Margin</span>
                      <span className="text-pixel-primary font-bold">
                        {finalScores.length > 1 ? formatNumber(winner.finalScore - finalScores[1].finalScore) : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Bottom Row - Game Statistics */}
              <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-6">
                <h3 className="text-pixel-xl font-bold text-pixel-primary mb-6 flex items-center">
                  Game Analytics
                </h3>
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-pixel-gray pixel-panel border-pixel-light-gray p-5 text-center">
                    <div className="text-3xl mb-3">⏱️</div>
                    <div className="text-pixel-primary font-bold text-2xl mb-1">{gameState?.maxRounds || 0}</div>
                    <div className="text-pixel-accent font-bold text-pixel-sm mb-1">Total Rounds</div>
                    <div className="text-pixel-xs text-pixel-base-gray">Completed</div>
                  </div>
                  
                  <div className="bg-pixel-gray pixel-panel border-pixel-light-gray p-5 text-center">
                    <div className="text-3xl mb-3">👥</div>
                    <div className="text-pixel-primary font-bold text-2xl mb-1">{players.length}</div>
                    <div className="text-pixel-accent font-bold text-pixel-sm mb-1">Players</div>
                    <div className="text-pixel-xs text-pixel-base-gray">Participated</div>
                  </div>
                  
                  <div className="bg-pixel-gray pixel-panel border-pixel-light-gray p-5 text-center">
                    <div className="text-3xl mb-3">⚡</div>
                    <div className="text-pixel-primary font-bold text-2xl mb-1">
                      {Object.values(gameState?.actionHistory || {}).flat().length || 0}
                    </div>
                    <div className="text-pixel-accent font-bold text-pixel-sm mb-1">Total Actions</div>
                    <div className="text-pixel-xs text-pixel-base-gray">Executed</div>
                  </div>
                  
                  <div className="bg-pixel-gray pixel-panel border-pixel-light-gray p-5 text-center">
                    <div className="text-3xl mb-3">🎯</div>
                    <div className="text-pixel-primary font-bold text-2xl mb-1">{formatNumber(winner.finalScore)}</div>
                    <div className="text-pixel-accent font-bold text-pixel-sm mb-1">High Score</div>
                    <div className="text-pixel-xs text-pixel-base-gray">Achievement</div>
                  </div>
                </div>
                
                {/* Additional Game Insights */}
                <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="bg-pixel-black pixel-panel border-pixel-gray p-4">
                    <div className="text-pixel-sm font-bold text-pixel-accent mb-2">Competition Level</div>
                    <div className="text-pixel-xs text-pixel-base-gray">
                      Average score: {formatNumber(finalScores.reduce((sum, p) => sum + p.finalScore, 0) / finalScores.length)}
                    </div>
                  </div>
                  
                  <div className="bg-pixel-black pixel-panel border-pixel-gray p-4">
                    <div className="text-pixel-sm font-bold text-pixel-accent mb-2">Market Activity</div>
                    <div className="text-pixel-xs text-pixel-base-gray">
                      {(Object.values(gameState?.actionHistory || {}).flat().length / (gameState?.maxRounds || 1)).toFixed(1)} actions per round
                    </div>
                  </div>
                  
                  <div className="bg-pixel-black pixel-panel border-pixel-gray p-4">
                    <div className="text-pixel-sm font-bold text-pixel-accent mb-2">Game Duration</div>
                    <div className="text-pixel-xs text-pixel-base-gray">
                      {gameState?.maxRounds || 0} rounds completed
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className={`flex ${isMobile ? 'flex-col space-y-3' : 'flex-row justify-center space-x-6'} items-center mt-8`}>
          {onPlayAgain && (
            <button
              onClick={() => {
                playSound('switch');
                onPlayAgain();
              }}
              className={`${isMobile ? 'w-full' : ''} px-8 py-4 bg-pixel-primary hover:bg-pixel-success text-pixel-black font-bold text-pixel-lg pixel-btn uppercase tracking-wider min-h-touch`}
            >
               Play Again
            </button>
          )}
          <button
            onClick={() => {
              playSound('click');
              onExitGame();
            }}
            className={`${isMobile ? 'w-full' : ''} px-8 py-4 bg-pixel-gray hover:bg-pixel-light-gray text-pixel-primary font-bold text-pixel-lg pixel-btn uppercase tracking-wider min-h-touch`}
          >
             Exit to Lobby
          </button>
        </div>
      </div>
    </div>
  );
};

