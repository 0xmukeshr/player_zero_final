import React, { useState, useEffect } from "react";
import { useSocket } from "../context/SocketContext";
import { useGame } from "../dojo/hooks/useGame";
import { useAccount } from "@starknet-react/core";
import { addAddressPadding } from "starknet";
import useAppStore from "../zustand/store";

interface GameLobbyProps {
  onPlayGame: () => void;
}

export function GameLobby({ onPlayGame }: GameLobbyProps) {
  const { socket, connected, setGameInfo } = useSocket();
  const { createGame, joinGame } = useGame();
  const { account } = useAccount();

  const [userProfile, setUserProfile] = useState<{ name: string } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [joinGameId, setJoinGameId] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState("");

  // Load user profile
  useEffect(() => {
    const profile = localStorage.getItem("userProfile");
    if (profile) {
      try {
        setUserProfile(JSON.parse(profile));
      } catch (e) {
        console.error("Error loading profile:", e);
      }
    }
  }, []);

  // Socket listeners for join by ID mechanics
  useEffect(() => {
    if (!socket) return;

    socket.on("game-created", (data: { gameId: string; playerId: string }) => {
      console.log("Game created:", data);
      if (userProfile?.name) {
        setGameInfo(data.gameId, data.playerId, userProfile.name);
        setIsCreating(false);
        onPlayGame();
      }
    });

    socket.on("game-joined", (data: { gameId: string; playerId: string }) => {
      console.log("Game joined via ID:", data);
      if (userProfile?.name) {
        setGameInfo(data.gameId, data.playerId, userProfile.name);
        setIsJoining(false);
        onPlayGame();
      }
    });

    socket.on("error", (err: { message: string }) => {
      setError(err.message);
      setIsCreating(false);
      setIsJoining(false);
    });

    return () => {
      socket.off("game-created");
      socket.off("game-joined");
      socket.off("error");
    };
  }, [socket, userProfile, setGameInfo, onPlayGame]);

  const handleCreateGame = async () => {
    if (!userProfile?.name || !account) {
      setError("Need profile and wallet");
      return;
    }

    setIsCreating(true);
    setError("");

    try {
      const response = await createGame(20);
      console.log("game created...joining game");

      if (response.success) {
        const game = useAppStore.getState().currentGame;
        await joinGame(game?.id!, userProfile.name);
        console.log("game created...joined game");
        if (game?.id) {
          socket?.emit("create-game", {
            gameName: `${userProfile.name}'s Game`,
            gameId: game.id,
            playerName: userProfile.name,
            isPrivate: false,
            walletAddress: addAddressPadding(account.address).toLowerCase(),
          });
        } else {
          throw new Error("Game ID not available");
        }
      } else {
        throw new Error(response.error || "Failed to create game");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create game");
      setIsCreating(false);
    }
  };

  const handleJoinGame = async () => {
    if (!userProfile?.name || !account || !joinGameId.trim()) {
      setError("Missing required information");
      return;
    }

    setIsJoining(true);
    setError("");
    await joinGame(joinGameId, userProfile.name);
    const playerAddress = addAddressPadding(account.address).toLowerCase();

    socket?.emit("join-game", {
      gameId: joinGameId.trim(),
      playerName: userProfile.name,
      walletAddress: playerAddress,
    });
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-pixel-black flex items-center justify-center p-4">
        <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-8 text-center">
          <h2 className="text-pixel-xl font-bold text-pixel-primary mb-4">
            Connecting...
          </h2>
          <p className="text-pixel-base-gray">
            Please wait while we connect to the server
          </p>
        </div>
      </div>
    );
  }

  if (!userProfile?.name) {
    return (
      <div className="min-h-screen bg-pixel-black flex items-center justify-center p-4">
        <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-8 text-center">
          <h2 className="text-pixel-xl font-bold text-pixel-primary mb-4">
            Profile Required
          </h2>
          <p className="text-pixel-base-gray mb-4">
            Please set up your profile first
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-pixel-primary hover:bg-pixel-success text-pixel-black font-bold pixel-btn"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pixel-black p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-pixel-2xl font-bold text-pixel-primary mb-2">
            Game Lobby
          </h1>
          <p className="text-pixel-base-gray">Welcome {userProfile.name}!</p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-pixel-error pixel-panel border-pixel-black p-4 mb-6">
            <p className="text-pixel-black font-bold text-center">{error}</p>
          </div>
        )}

        {/* Main Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Create Game */}
          <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-6">
            <h3 className="text-pixel-lg font-bold text-pixel-primary mb-4 text-center">
              Create Game
            </h3>
            <p className="text-pixel-base-gray text-center mb-6">
              Start a new multiplayer game
            </p>
            <button
              onClick={handleCreateGame}
              disabled={isCreating || !account}
              className="w-full px-6 py-4 bg-pixel-primary hover:bg-pixel-success text-pixel-black font-bold pixel-btn disabled:opacity-50"
            >
              {isCreating ? "Creating..." : "Create New Game"}
            </button>
          </div>

          {/* Join Game by ID */}
          <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-6">
            <h3 className="text-pixel-lg font-bold text-pixel-primary mb-4 text-center">
              Join Game
            </h3>
            <p className="text-pixel-base-gray text-center mb-4">
              Enter a game ID to join
            </p>
            <input
              type="text"
              value={joinGameId}
              onChange={(e) => setJoinGameId(e.target.value)}
              placeholder="Game ID"
              className="w-full px-4 py-3 bg-pixel-gray border-2 border-pixel-light-gray text-pixel-primary font-bold mb-4 focus:outline-none focus:border-pixel-accent"
              maxLength={20}
            />
            <button
              onClick={handleJoinGame}
              disabled={isJoining || !joinGameId.trim() || !account}
              className="w-full px-6 py-4 bg-pixel-accent hover:bg-pixel-warning text-pixel-black font-bold pixel-btn disabled:opacity-50"
            >
              {isJoining ? "Joining..." : "Join Game"}
            </button>
          </div>
        </div>

        {/* Status Info */}
        <div className="bg-pixel-gray pixel-panel border-pixel-light-gray p-4 text-center">
          <div className="text-pixel-xs text-pixel-base-gray">
            <span className="text-pixel-primary">Status:</span>{" "}
            {connected ? "🟢 Connected" : "🔴 Disconnected"} |
            <span className="text-pixel-primary"> Wallet:</span>{" "}
            {account ? "🟢 Connected" : "🔴 Not Connected"}
          </div>
        </div>
      </div>
    </div>
  );
}
