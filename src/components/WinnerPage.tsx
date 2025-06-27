import React from 'react';

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
  // Calculate final scores for all players
  const calculateFinalScores = (): PlayerScore[] => {
    const scoredPlayers = players.map(player => {
      const assetValue = 
        (player.assets.gold * marketPrices.gold) +
        (player.assets.water * marketPrices.water) +
        (player.assets.oil * marketPrices.oil);
      
      const finalScore = player.tokens + assetValue;
      
      return {
        ...player,
        assetValue,
        finalScore,
        rank: 0 // Will be set after sorting
      };
    });

    // Sort by final score (highest first) and assign ranks
    scoredPlayers.sort((a, b) => b.finalScore - a.finalScore);
    scoredPlayers.forEach((player, index) => {
      player.rank = index + 1;
    });

    return scoredPlayers;
  };

  const finalScores = calculateFinalScores();
  const winner = finalScores[0];

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return 'text-pixel-success';
      case 2: return 'text-pixel-warning';
      case 3: return 'text-pixel-accent';
      default: return 'text-pixel-base-gray';
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

  return (
    <div className="min-h-screen bg-pixel-black scanlines p-6 font-pixel">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-pixel-3xl font-bold text-pixel-primary uppercase tracking-wider mb-2">
            Game Over
          </h1>
          <div className="text-pixel-base-gray">
            Round {gameState?.currentRound || gameState?.maxRounds}/{gameState?.maxRounds}
          </div>
        </div>

        {/* Winner Announcement */}
        <div className="bg-pixel-success pixel-panel border-pixel-black p-8 mb-8 text-center">
          <div className="text-pixel-2xl font-bold text-pixel-black mb-2">
            🏆 WINNER 🏆
          </div>
          <div className="text-pixel-xl font-bold text-pixel-black mb-2">
            {winner.name}
          </div>
          <div className="text-pixel-lg text-pixel-black">
            Final Score: {formatNumber(winner.finalScore)} Tokens
          </div>
        </div>

        {/* Final Scores Table */}
        <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-6 mb-8">
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
                {finalScores.map((player, index) => (
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

        {/* Score Calculation Info */}
        <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-6 mb-8">
          <h3 className="text-pixel-lg font-bold text-pixel-primary mb-4">
            Score Calculation
          </h3>
          <div className="text-pixel-sm text-pixel-base-gray space-y-2">
            <p>
              <span className="text-pixel-primary font-bold">Final Score = </span>
              Total Tokens + (Gold × Gold Price) + (Water × Water Price) + (Oil × Oil Price)
            </p>
            <p>
              <span className="text-pixel-primary font-bold">Final Market Prices:</span>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
              <div className="bg-pixel-gray pixel-panel border-pixel-light-gray p-3 text-center">
                <div className="text-pixel-accent font-bold">Gold</div>
                <div className="text-pixel-lg text-pixel-primary">{marketPrices.gold}</div>
              </div>
              <div className="bg-pixel-gray pixel-panel border-pixel-light-gray p-3 text-center">
                <div className="text-pixel-accent font-bold">Water</div>
                <div className="text-pixel-lg text-pixel-primary">{marketPrices.water}</div>
              </div>
              <div className="bg-pixel-gray pixel-panel border-pixel-light-gray p-3 text-center">
                <div className="text-pixel-accent font-bold">Oil</div>
                <div className="text-pixel-lg text-pixel-primary">{marketPrices.oil}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Game Statistics */}
        <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-6 mb-8">
          <h3 className="text-pixel-lg font-bold text-pixel-primary mb-4">
            Game Statistics
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-pixel-sm">
            <div className="bg-pixel-gray pixel-panel border-pixel-light-gray p-4 text-center">
              <div className="text-pixel-accent font-bold mb-2">Total Rounds</div>
              <div className="text-pixel-lg text-pixel-primary">{gameState?.maxRounds || 0}</div>
            </div>
            <div className="bg-pixel-gray pixel-panel border-pixel-light-gray p-4 text-center">
              <div className="text-pixel-accent font-bold mb-2">Players</div>
              <div className="text-pixel-lg text-pixel-primary">{players.length}</div>
            </div>
            <div className="bg-pixel-gray pixel-panel border-pixel-light-gray p-4 text-center">
              <div className="text-pixel-accent font-bold mb-2">Highest Score</div>
              <div className="text-pixel-lg text-pixel-primary">{formatNumber(winner.finalScore)}</div>
            </div>
            <div className="bg-pixel-gray pixel-panel border-pixel-light-gray p-4 text-center">
              <div className="text-pixel-accent font-bold mb-2">Total Actions</div>
              <div className="text-pixel-lg text-pixel-primary">
                {Object.values(gameState?.actionHistory || {}).flat().length || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-6">
          {onPlayAgain && (
            <button
              onClick={onPlayAgain}
              className="px-8 py-4 bg-pixel-primary hover:bg-pixel-success text-pixel-black font-bold text-pixel-lg pixel-btn uppercase tracking-wider"
            >
              Play Again
            </button>
          )}
          <button
            onClick={onExitGame}
            className="px-8 py-4 bg-pixel-gray hover:bg-pixel-light-gray text-pixel-primary font-bold text-pixel-lg pixel-btn uppercase tracking-wider"
          >
            Exit to Lobby
          </button>
        </div>
      </div>
    </div>
  );
};

