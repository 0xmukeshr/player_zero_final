import React, { useState, useEffect } from "react";
import { Timer } from "./Timer";
import { PlayerWallet } from "./PlayerWallet";
import { AssetsList } from "./AssetsList";
import { PlayerStats } from "./PlayerStats";
import { ActionPanel } from "./ActionPanelSimple";
import { GameErrorBoundary } from "./GameErrorBoundary";
import { useSocket } from "../context/SocketContext";
import { useAudio } from "../hooks/useAudio";
import { useGame } from "../dojo/hooks/useGame"; //
import useAppStore, { AssetType, ActionType } from "../zustand/store";
import { useUnifiedActions } from "../hooks/useUnifiedActions";
import { UseGameData } from "../dojo/hooks/fetchGame";
import { useNextRound } from "../dojo/hooks/useNextRound";
import { useMarket } from "../dojo/hooks/fetchMarket";

interface GameInterfaceProps {
  onExitGame: () => void;
}

function GameInterfaceInner({ onExitGame }: GameInterfaceProps) {
  const { socket, connected, gameId, playerId, playerName, clearGameInfo } =
    useSocket();
  const { playSound } = useAudio();

  // Add useGame hook
  const {
    startGame,
    isProcessing: gameActionProcessing,
    error: gameActionError,
    currentStep,
    resetGameState,
  } = useGame();

  // Zustand store
  const {
    currentGame,
    market,
    player,
    inventory,
    gameStarted,
    selectedAsset,
    selectedAction,
    setSelectedAsset,
    setSelectedAction,
    startGame: storeStartGame,
    endGame: storeEndGame,
  } = useAppStore();
  const { nextRound } = useNextRound();
  const { refetch: fetchGameData } = UseGameData();
  const { refetch: fetchMarketData } = useMarket();
  // Unified actions
  const { executeAction, isProcessing } = useUnifiedActions();

  // Local state - minimal
  const [gameState, setGameState] = useState<any>(null);
  const [currentPlayer, setCurrentPlayer] = useState<any>(null);
  const [isHost, setIsHost] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [targetPlayer, setTargetPlayer] = useState<string>("");
  const [gameIdCopied, setGameIdCopied] = useState(false);

  async function updateGamedata() {
    console.log("updating gamedata");

    await fetchGameData(currentGame?.id);
    console.log("gamedata updated");
  }

  async function updateMarketdata() {
    console.log("updating Market data");

    await fetchMarketData(currentGame?.id);
    console.log("Market data updated");
  }
  // Socket event listeners
  useEffect(() => {
    if (!socket) return;
    socket.on("round-ended", async (data) => {
      try {
        addNotification("Advancing to next round...");
        if (isHost) {
          const result = await nextRound(currentGame?.id!);
          if (result.success) {
            addNotification(`Round ${data.round} started!`);
          } else {
            addNotification(`Failed to advance round: ${result.error}`);
          }
        }

        // Wait 5 seconds then fetch market data
        setTimeout(async () => {
          await updateMarketdata();
          addNotification("Market data updated");
        }, 6500);


        // Send updated market prices to server
          if (market && socket) {
            socket.emit("update-market-prices", {
              gameId,
              marketPrices: market,
            });
          }
      } catch (error) {
        addNotification(`Round advancement failed: ${error}`);
      }
    });

    socket.on("game-state", (state: any) => {
      // console.log(state);

      setGameState(state);

      if (state?.status === "playing" && !gameStarted) {
        storeStartGame();
      }
      if (state?.status !== "playing" && gameStarted) {
        storeEndGame();
      }
    });

    socket.on("game-started", async () => {
      await updateGamedata();
      playSound("switch");
      addNotification("Game started!");
    });

    socket.on("game-finished", () => {
      playSound("action");
      addNotification("Game finished!");
    });

    return () => {
      socket.off("game-state");
      socket.off("game-started");
      socket.off("game-finished");
      socket.off("next-round");
    };
  }, [socket, gameStarted, storeStartGame, storeEndGame]);

  // Update current player and host status
  useEffect(() => {
    if (!gameState || !playerId) return;

    const player = gameState.players?.find((p: any) => p.id === playerId);
    setCurrentPlayer(player || null);
    setIsHost(gameState.host === playerId);
  }, [gameState, playerId]);

  // Handle game action errors
  useEffect(() => {
    if (gameActionError) {
      addNotification(`Error: ${gameActionError}`);
    }
  }, [gameActionError]);

  const addNotification = (message: string) => {
    setNotifications((prev) => [message, ...prev.slice(0, 2)]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n !== message));
    }, 3000);
  };

  const handleStartGame = async () => {
    console.log(currentGame?.id);

    try {
      addNotification("Starting game on blockchain...");

      // Start game on blockchain first
      const result = await startGame(currentGame?.id!);

      if (result.success) {
        // Then emit to socket for real-time updates
        socket?.emit("start-game");
        addNotification("Game started successfully!");
        playSound("switch");
      } else {
        addNotification(`Failed to start game: ${result.error}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      addNotification(`Failed to start game: ${errorMessage}`);
    }
  };

  const handleExitGame = () => {
    if (socket && gameId && playerId) {
      socket.emit("exit-game", { gameId, playerId });
    }

    // Reset game action state when exiting
    resetGameState();
    clearGameInfo();
    onExitGame();
  };

  const handlePlayerAction = async () => {
    console.log("Action call", selectedAction, selectedAsset);
    if (!selectedAction || !selectedAsset) return;

    try {
      const result = await executeAction(
        selectedAction,
        selectedAsset,
        selectedAction === "Sabotage" ? targetPlayer : undefined
      );

      if (result.success) {
        addNotification(`${selectedAction} ${selectedAsset} successful!`);
      } else {
        addNotification(`${selectedAction} failed: ${result.error}`);
      }
    } catch (error) {
      addNotification(
        `Action failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }

    // Reset target player
    setTargetPlayer("");
  };

  // Loading states
  if (!connected) {
    return (
      <div className="min-h-screen bg-pixel-black flex items-center justify-center">
        <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-8">
          <h2 className="text-pixel-xl font-bold text-pixel-primary text-center">
            Connecting...
          </h2>
        </div>
      </div>
    );
  }

  if (!gameId) {
    return (
      <div className="min-h-screen bg-pixel-black flex items-center justify-center">
        <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-8">
          <h2 className="text-pixel-xl font-bold text-pixel-primary text-center mb-4">
            No game selected
          </h2>
          <button
            onClick={handleExitGame}
            className="px-6 py-3 bg-pixel-gray hover:bg-pixel-light-gray text-pixel-primary font-bold pixel-btn"
          >
            Exit to Lobby
          </button>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-pixel-black flex items-center justify-center">
        <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-8">
          <h2 className="text-pixel-xl font-bold text-pixel-primary text-center mb-4">
            Loading game...
          </h2>
          <p className="text-pixel-base-gray text-center">Game ID: {gameId}</p>
          <div className="mt-6 text-center">
            <button
              onClick={handleExitGame}
              className="px-6 py-3 bg-pixel-gray hover:bg-pixel-light-gray text-pixel-primary font-bold pixel-btn"
            >
              Exit to Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Waiting room
  if (!gameStarted) {
    const handleCopyGameId = async () => {
      if (gameId) {
        try {
          await navigator.clipboard.writeText(gameId);
          setGameIdCopied(true);
          addNotification("Game ID copied to clipboard!");

          // Reset the copied state after 2 seconds
          setTimeout(() => {
            setGameIdCopied(false);
          }, 2000);
        } catch (err) {
          console.error("Failed to copy game ID:", err);
          addNotification("Failed to copy Game ID");
        }
      } else {
        addNotification("No Game ID to copy");
      }
    };

    return (
      <div className="min-h-screen bg-pixel-black scanlines p-6 font-pixel">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-pixel-2xl font-bold text-pixel-primary uppercase tracking-wider">
              Waiting Room
            </h1>
            <button
              onClick={handleExitGame}
              className="px-4 py-2 bg-pixel-error hover:bg-pixel-warning text-pixel-black font-bold text-pixel-sm pixel-btn border-pixel-black uppercase tracking-wider"
            >
              Exit Game
            </button>
          </div>

          {/* Game Info - Split into two halves */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Left Half - Game Details */}
            <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-pixel-lg font-bold text-pixel-primary">
                  Game Info
                </h3>
                <div className="flex items-center space-x-2">
                  <div
                    className="w-2 h-2 bg-pixel-success pixel-notification border-pixel-success"
                    title="Live Sync Active"
                  ></div>
                  <span className="text-pixel-xs text-pixel-success font-bold">
                    LIVE
                  </span>
                </div>
              </div>
              <div className="space-y-2 text-pixel-base-gray">
                <p>
                  <span className="text-pixel-primary">Game Name:</span>{" "}
                  {gameState?.gameName || "Unnamed Game"}
                </p>
                <p>
                  <span className="text-pixel-primary">Game ID:</span> {gameId}
                </p>
                <p>
                  <span className="text-pixel-primary">Host:</span>{" "}
                  {isHost
                    ? "You"
                    : gameState?.players?.find(
                        (p: any) => p.id === gameState.host
                      )?.name || "Unknown"}
                </p>
                <p>
                  <span className="text-pixel-primary">Players:</span>{" "}
                  {gameState?.players?.length || 0}/4
                </p>
                <p>
                  <span className="text-pixel-primary">Status:</span> Waiting
                  for players
                </p>
              </div>
            </div>

            {/* Right Half - How to Invite */}
            <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-6">
              <h3 className="text-pixel-lg font-bold text-pixel-primary mb-4">
                How to Invite
              </h3>
              <div className="space-y-2 text-pixel-base-gray text-pixel-sm">
                <p>1. Share the Game ID with friends</p>
                <p>2. They join using "Join by ID"</p>
                <p>3. Host starts the game when ready</p>
              </div>
              <button
                onClick={handleCopyGameId}
                disabled={gameIdCopied}
                className={`mt-4 w-full px-4 py-2 font-bold text-pixel-sm pixel-btn border-pixel-black uppercase tracking-wider transition-colors ${
                  gameIdCopied
                    ? "bg-pixel-success text-pixel-black"
                    : "bg-pixel-accent hover:bg-pixel-success text-pixel-black"
                }`}
              >
                {gameIdCopied ? "Copied!" : "Copy Game ID"}
              </button>
            </div>
          </div>

          {/* Players List */}
          <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-6 mb-6">
            <h3 className="text-pixel-lg font-bold text-pixel-primary mb-4">
              Players ({gameState.players?.length || 0}/4)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {gameState.players?.map((player: any) => (
                <div
                  key={player.id}
                  className="bg-pixel-gray pixel-panel border-pixel-light-gray p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-pixel-primary font-bold">
                      {player.name} {player.id === playerId && "(You)"}
                    </span>
                    {player.id === gameState.host && (
                      <span className="text-pixel-xs bg-pixel-warning text-pixel-black px-2 py-1 pixel-notification">
                        HOST
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Blockchain Action Status */}
          {/* {gameActionProcessing && (
            <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-6 mb-6">
              <h3 className="text-pixel-lg font-bold text-pixel-warning mb-2">
                Processing on Blockchain...
              </h3>
              <div className="space-y-2">
                <p className="text-pixel-base-gray">
                  Step: <span className="text-pixel-primary font-bold">{currentStep}</span>
                </p>
                <div className="bg-pixel-gray h-2 rounded-full overflow-hidden">
                  <div className="bg-pixel-primary h-full animate-pulse" style={{ width: '60%' }}></div>
                </div>
              </div>
            </div>
          )} */}

          {/* Start Game Button */}
          {isHost && (
            <div className="text-center">
              <button
                onClick={handleStartGame}
                disabled={
                  (gameState.players?.length || 0) < 2 || gameActionProcessing
                }
                className="px-8 py-4 bg-pixel-primary hover:bg-pixel-success text-pixel-black font-bold text-pixel-lg pixel-btn disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {gameActionProcessing
                  ? "Starting Game..."
                  : (gameState.players?.length || 0) < 2
                  ? "Need 2+ Players"
                  : "Start Game"}
              </button>
            </div>
          )}

          {!isHost && (
            <div className="text-center">
              <div className="bg-pixel-warning pixel-panel border-pixel-black p-4">
                <p className="text-pixel-black font-bold">
                  {gameActionProcessing
                    ? "Host is starting the game..."
                    : "Waiting for host to start the game..."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Game interface (rest remains the same)
  return (
    <div className="min-h-screen bg-pixel-black p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-pixel-xl font-bold text-pixel-primary">
            Trading Game
          </h1>
          <div className="flex items-center space-x-4">
            <div className="text-pixel-base-gray font-bold bg-pixel-dark-gray border-pixel-gray px-3 py-1 pixel-panel">
              Round {gameState.currentRound}/{gameState.maxRounds}
            </div>
            <button
              onClick={handleExitGame}
              className="px-4 py-2 bg-pixel-error hover:bg-pixel-warning text-pixel-black font-bold pixel-btn"
            >
              Exit
            </button>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column */}
          <div className="lg:col-span-3 space-y-4">
            <Timer timeRemaining={gameState.timeRemaining} />
            <AssetsList
              assets={currentPlayer?.assets || { gold: 0, water: 0, oil: 0 }}
            />
          </div>

          {/* Middle Column */}
          <div className="lg:col-span-6 space-y-4">
            <PlayerWallet
              tokens={currentPlayer?.tokens || 0}
              assets={inventory}
            />
            <PlayerStats players={gameState.players || []} />
          </div>

          {/* Right Column */}
          <div className="lg:col-span-3 space-y-4">
            <ActionPanel
              selectedAction={selectedAction || "Buy"}
              selectedResource={selectedAsset || "Gold"}
              amount={1}
              targetPlayer={targetPlayer}
              players={gameState.players || []}
              currentPlayer={
                currentPlayer || {
                  id: "",
                  name: "",
                  tokens: 0,
                  assets: { gold: 0, water: 0, oil: 0 },
                  totalAssets: 0,
                }
              }
              onActionChange={(action: ActionType) => setSelectedAction(action)}
              onResourceChange={(resource: AssetType) =>
                setSelectedAsset(resource)
              }
              onAmountChange={() => {}} // Fixed amount of 1
              onTargetChange={setTargetPlayer}
              onConfirmAction={handlePlayerAction}
            />

            {/* Processing Status */}
            {(isProcessing || gameActionProcessing) && (
              <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-4">
                <div className="text-pixel-sm font-bold text-pixel-primary mb-2">
                  {gameActionProcessing
                    ? "Blockchain Processing..."
                    : "Processing..."}
                </div>
                <div className="text-pixel-xs text-pixel-warning">
                  {gameActionProcessing
                    ? "Transaction in progress"
                    : "Action in progress"}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notifications */}
        {notifications.length > 0 && (
          <div className="fixed top-4 right-4 space-y-2 z-50">
            {notifications.map((notification, index) => (
              <div
                key={index}
                className="bg-pixel-accent text-pixel-black p-3 pixel-panel border-pixel-black"
              >
                <p className="font-bold text-pixel-sm">{notification}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Export wrapped component with error boundary
export const GameInterface: React.FC<GameInterfaceProps> = ({ onExitGame }) => (
  <GameErrorBoundary>
    <GameInterfaceInner onExitGame={onExitGame} />
  </GameErrorBoundary>
);
