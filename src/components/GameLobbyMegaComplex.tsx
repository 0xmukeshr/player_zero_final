import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { useGame } from '../dojo/hooks/useGame';
import useAppStore from '../zustand/store';
import { useAccount } from '@starknet-react/core';
import { addAddressPadding } from 'starknet';

interface GameLobbyProps {
  onPlayGame: () => void;
}

export function GameLobby({ onPlayGame }: GameLobbyProps) {
  const { socket, connected, setGameInfo } = useSocket();
  const { createGame } = useGame();
  const { account } = useAccount();
  
  const [userProfile, setUserProfile] = useState<{ name: string } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [joinGameId, setJoinGameId] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  // Load user profile on mount
  useEffect(() => {
    const existingProfile = localStorage.getItem('userProfile');
    if (existingProfile) {
      try {
        const profile = JSON.parse(existingProfile);
        setUserProfile(profile);
      } catch (error) {
        console.error('Error loading profile:', error);
      }
    }
  }, []);

  useEffect(() => {
    if (!socket) return;

    // Load public games on mount
    loadPublicGames();

    // Set up socket event listeners
    socket.on('public-games-list', (games: PublicGame[]) => {
      setPublicGames(games);
      setRefreshingGames(false);
    });

    socket.on('game-created', (data: { gameId: string; playerId: string }) => {
      console.log('Game created event received in GameLobby:', data);
      setCreatedGameId(data.gameId);
      setShowGameCreated(true);
      setShowCreateModal(true);
      setLoading(false);
      setError('');
      
      // Immediately set the game info in context with the received player ID
      if (userProfile?.name) {
        console.log('GameLobby: Setting game info immediately after creation:', {
          gameId: data.gameId,
          playerId: data.playerId,
          playerName: userProfile.name
        });
        setGameInfo(data.gameId, data.playerId, userProfile.name);
        
        // Also store in localStorage immediately with host flag
        try {
          const gameInfo = {
            gameId: data.gameId,
            playerId: data.playerId,
            playerName: userProfile.name,
            isCreator: true
          };
          localStorage.setItem('currentGameInfo', JSON.stringify(gameInfo));
          console.log('GameLobby: Stored game info in localStorage immediately:', gameInfo);
        } catch (error) {
          console.error('GameLobby: Error storing game info:', error);
        }
      }
    });
    
    // Listen for the gameInfoReady event from SocketContext
    const handleGameInfoReady = (event: CustomEvent) => {
      console.log('GameLobby: gameInfoReady event received:', event.detail);
      const { gameId, playerId, playerName } = event.detail;
      setCreatedGameId(gameId);
    };
    
    window.addEventListener('gameInfoReady', handleGameInfoReady as EventListener);

    socket.on('game-joined', (data: { gameId: string; playerId: string }) => {
      setLoading(false);
      setJoiningGameId(null);
      setError('');
      // Store game info in context with player name
      if (userProfile?.name) {
        setGameInfo(data.gameId, data.playerId, userProfile.name);
      }
      onPlayGame();
    });

    socket.on('error', (error: { message: string }) => {
      setError(error.message);
      setJoinError(error.message);
      setLoading(false);
      setJoiningGameId(null);
    });

    // Auto-refresh public games every 10 seconds
    const refreshInterval = setInterval(() => {
      if (connected) {
        loadPublicGames();
      }
    }, 10000);

    return () => {
      clearInterval(refreshInterval);
      socket.off('public-games-list');
      socket.off('game-created');
      socket.off('game-joined');
      socket.off('error');
      window.removeEventListener('gameInfoReady', handleGameInfoReady as EventListener);
    };
  }, [socket, connected, onPlayGame]);

  const loadPublicGames = () => {
    if (!socket || !connected) {
      console.log('Socket not connected, skipping public games load');
      return;
    }
    
    setRefreshingGames(true);
    socket.emit('get-public-games');
  };

  const handleCreateGame = async () => {
    setLoading(true);
    setError('');
    console.log("🎮 Creating new game with max rounds:");
   
    if (!userProfile?.name) {
      // Try to reload userProfile from localStorage one more time
      try {
        const existingProfile = localStorage.getItem('userProfile');
        if (existingProfile) {
          const profile = JSON.parse(existingProfile);
          setUserProfile(profile);
          console.log('Reloaded userProfile from localStorage:', profile);
          
          if (!profile.name) {
            setError('User profile loaded but name is missing. Please refresh the page and try again.');
            setLoading(false);
            return;
          }
        } else {
          setError('User profile not found. Please refresh the page and try again.');
          setLoading(false);
          return;
        }
      } catch (error) {
        setError('Error loading user profile. Please refresh the page and try again.');
        setLoading(false);
        return;
      }
    }
    
    try {
      console.log('🔥 BEFORE createGame call - Store state:', useAppStore.getState().currentGame);
      const response = await createGame(20);
      console.log('🔥 AFTER createGame call - Store state:', useAppStore.getState().currentGame);
      console.log('Game created transaction response:', response);
        
        if (response.success) {
          console.log("Game created successfully. Transaction hash:", response.transactionHash);
          
          // Wait for the store to update with the correct game ID
          let updatedGame = null;
          let attempts = 0;
          const maxAttempts = 20; // Wait up to 2 seconds
          
          while (!updatedGame?.id && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            updatedGame = useAppStore.getState().currentGame;
            attempts++;
            console.log(`Attempt ${attempts}: Checking for updated game in store:`, updatedGame);
          }
          
          if (!updatedGame?.id) {
            console.error('Game ID not available after waiting. Current store state:', useAppStore.getState());
            throw new Error('Game ID not available after transaction completion. Please try again.');
          }
          
          console.log('Final updated game from store:', updatedGame);
        console.log('Connected account:', account);
        console.log('User profile:', userProfile);
        
        // Use wallet account and userProfile (get current userProfile in case it was reloaded)
        const currentUserProfile = userProfile || JSON.parse(localStorage.getItem('userProfile') || '{}');
        const playerAddress = addAddressPadding(account.address).toLowerCase();
        const playerName = currentUserProfile.name;
        
        console.log('Player info to use:', { playerAddress, playerName });
        
        // Ensure we have game ID from the store
        if (!updatedGame?.id) {
          throw new Error(`Game ID not available in store after creation. Store game: ${JSON.stringify(updatedGame)}`);
        }
        
        console.log("Emitting create-game event with:", {
          gameName: gameName.trim(),
          gameId: updatedGame.id,
          playerName: playerName,
          isPrivate,
          walletAddress: playerAddress
        });
        
        // Emit socket event for multiplayer coordination
        socket?.emit('create-game', {
          gameName: gameName.trim(),
          gameId: updatedGame.id,
          playerName: playerName,
          isPrivate,
          walletAddress: playerAddress
        });
        
        // Set game info in socket context immediately - use wallet address as player ID
        setGameInfo(updatedGame.id, playerAddress, playerName);
        
        // Store complete game info in localStorage
        const gameInfo = {
          gameId: updatedGame.id,
          playerId: playerAddress, // Use starknet address as player ID
          playerName: playerName, // Use random generated name
          isCreator: true
        };
        
        try {
          localStorage.setItem('currentGameInfo', JSON.stringify(gameInfo));
          console.log('Game info stored immediately after creation:', gameInfo);
        } catch (error) {
          console.error('Error storing game info:', error);
        }
        
        // Auto-enter the waiting room
        console.log('Auto-entering waiting room after successful game creation');
        setLoading(false);
        setShowCreateModal(false); // Close the modal
        setGameName(''); // Reset form
        setIsPrivate(false);
        setError('');
        
        // Navigate to game interface directly
        onPlayGame();
        
      } else {
        throw new Error(response.error || 'Failed to create game');
      }
    } catch (error) {
      console.error('Error creating game:', error);
      setError(error instanceof Error ? error.message : 'Failed to create game');
      setLoading(false);
    }
  };

  const handleJoinPublicGame = (gameId: string, gameName?: string) => {
    if (userProfile?.name && socket && connected && account) {
      setJoiningGameId(gameId);
      setError('');
      setJoinError('');
      
      const playerAddress = addAddressPadding(account.address).toLowerCase();
      
      socket.emit('join-game', {
        gameId,
        playerName: userProfile.name,
        walletAddress: playerAddress
      });
    }
  };


  const handleJoinById = () => {
    if (joinGameId.trim() && userProfile?.name && socket && connected && account) {
      setLoading(true);
      setJoinError('');
      setError('');
      
      const playerAddress = addAddressPadding(account.address).toLowerCase();
      
      socket.emit('join-game', {
        gameId: joinGameId.trim(),
        playerName: userProfile.name,
        walletAddress: playerAddress
      });
    }
  };

  const handleCopyGameId = async () => {
    if (createdGameId) {
      try {
        // Try modern clipboard API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(createdGameId);
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000);
        } else {
          // Fallback for older browsers or non-HTTPS contexts
          const textArea = document.createElement('textarea');
          textArea.value = createdGameId;
          textArea.style.position = 'fixed';
          textArea.style.top = '0';
          textArea.style.left = '0';
          textArea.style.width = '2em';
          textArea.style.height = '2em';
          textArea.style.padding = '0';
          textArea.style.border = 'none';
          textArea.style.outline = 'none';
          textArea.style.boxShadow = 'none';
          textArea.style.background = 'transparent';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          
          try {
            const successful = document.execCommand('copy');
            if (successful) {
              setCopySuccess(true);
              setTimeout(() => setCopySuccess(false), 2000);
            } else {
              alert(`Game ID: ${createdGameId}\n\nPlease copy this manually.`);
            }
          } catch (fallbackErr) {
            alert(`Game ID: ${createdGameId}\n\nPlease copy this manually.`);
          }
          
          document.body.removeChild(textArea);
        }
      } catch (err) {
        console.error('Failed to copy game ID:', err);
        // Final fallback - show alert with game ID
        alert(`Game ID: ${createdGameId}\n\nPlease copy this manually.`);
      }
    }
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setShowGameCreated(false);
    setCreatedGameId(null);
    setGameName('');
    setIsPrivate(false);
    setCopySuccess(false);
    setError('');
  };

  const handleCloseJoinModal = () => {
    setShowJoinModal(false);
    setJoinGameId('');
    setJoinError('');
    setError('');
  };

  const handlePlayCreatedGame = async () => {
    console.log('Entering created game...', { createdGameId, connected, gameId, playerId });
    if (!connected) {
      setError('Not connected to server. Please wait for connection.');
      return;
    }
    if (!createdGameId) {
      setError('Game ID not available. Please try creating the game again.');
      return;
    }
    
    setEnteringGame(true);
    
    // Use player info from zustand store first, then fallback to context/localStorage
    let effectivePlayerId = playerId;
    let effectivePlayerName = player?.name || userProfile?.name;
    let attempts = 0;
    const maxAttempts = 10;
    
    // If we have player info from store, use it directly
    if (player?.address && player?.name && createdGameId) {
      console.log('Using player info from zustand store:', {
        gameId: createdGameId,
        playerId: player.address, // Use wallet address as player ID
        playerName: player.name
      });
      
      // Set the game info in context with store data
      setGameInfo(createdGameId, player.address, player.name.toString());
      
      // Store complete game info
      const gameInfo = {
        gameId: createdGameId,
        playerId: player.address,
        playerName: player.name,
        isCreator: true
      };
      
      try {
        localStorage.setItem('currentGameInfo', JSON.stringify(gameInfo));
        console.log('Complete game info stored in localStorage using store data:', gameInfo);
      } catch (error) {
        console.error('Error storing game info:', error);
      }
      
      // Close modal and navigate
      handleCloseCreateModal();
      setEnteringGame(false);
      onPlayGame();
      return;
    }
    
    // Poll for game info with timeout as fallback
    while (attempts < maxAttempts) {
      try {
        // First check context values
        if (gameId === createdGameId && playerId) {
          effectivePlayerId = playerId;
          effectivePlayerName = userProfile?.name;
          console.log('Using game info from context:', {
            gameId,
            playerId: effectivePlayerId,
            playerName: effectivePlayerName
          });
          break;
        }
        
        // Then check localStorage
        const storedGameInfo = localStorage.getItem('currentGameInfo');
        console.log(`Attempt ${attempts + 1}: Checking localStorage for game info:`, storedGameInfo);
        
        if (storedGameInfo) {
          const parsed = JSON.parse(storedGameInfo);
          console.log('Parsed localStorage game info:', parsed);
          
          if (parsed.gameId === createdGameId && parsed.playerId) {
            effectivePlayerId = parsed.playerId;
            effectivePlayerName = parsed.playerName || userProfile?.name;
            console.log('Using game info from localStorage:', {
              gameId: parsed.gameId,
              playerId: effectivePlayerId,
              playerName: effectivePlayerName
            });
            break;
          }
        }
        
        // Wait 100ms before next attempt
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      } catch (error) {
        console.error('Error reading game info:', error);
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Ensure we have all required info before proceeding
    if (!effectivePlayerId || !effectivePlayerName) {
      console.error('Missing game information after polling:', {
        effectivePlayerId,
        effectivePlayerName,
        createdGameId,
        contextGameId: gameId,
        contextPlayerId: playerId,
        userProfileName: userProfile?.name,
        playerFromStore: player,
        attempts
      });
      setError(`Missing game information after ${attempts} attempts. Player ID: ${effectivePlayerId || 'missing'}, Player Name: ${effectivePlayerName || 'missing'}`);
      setEnteringGame(false);
      return;
    }
    
    // Create complete game info object
    const gameInfo = {
      gameId: createdGameId,
      playerId: effectivePlayerId,
      playerName: effectivePlayerName,
      isCreator: true
    };
    
    console.log('Setting complete game info in both context and localStorage:', gameInfo);
    
    // Set the game info in context
    setGameInfo(createdGameId, effectivePlayerId, effectivePlayerName.toString());
    
    // Ensure localStorage is updated with complete info
    try {
      localStorage.setItem('currentGameInfo', JSON.stringify(gameInfo));
      console.log('Complete game info stored in localStorage:', gameInfo);
    } catch (error) {
      console.error('Error storing game info:', error);
    }
    
    console.log('Navigating to game interface with complete info');
    
    // Close modal first
    handleCloseCreateModal();
    
    // Navigate immediately - context should be set synchronously
    setEnteringGame(false);
    onPlayGame();
  };

  return (
    <div className="min-h-screen-safe bg-pixel-black scanlines p-4 sm:p-8 font-pixel">
      <div className="max-w-6xl mx-auto px-2 sm:px-4">
        {/* Header with connection status */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 space-y-3 sm:space-y-0">
          <h2 className="text-pixel-xl sm:text-pixel-2xl font-bold text-pixel-primary uppercase tracking-wide">
            <span className="hidden sm:inline">Multiplayer Lobby</span>
            <span className="sm:hidden">Lobby</span>
          </h2>
          {/* <div className="flex flex-col xs:flex-row items-start xs:items-center space-y-2 xs:space-y-0 xs:space-x-3">
            <div className="text-pixel-base-gray text-pixel-xs sm:text-pixel-sm font-bold pixel-notification bg-pixel-dark-gray border-pixel-gray px-2 sm:px-3 py-1">
              {connected ? '🟢 Connected' : '🟡 Connecting...'}
            </div>
            {status === 'connected' ? (
              <div className="bg-pixel-success pixel-notification border-pixel-success text-pixel-black px-2 sm:px-3 py-1 font-bold text-pixel-xs sm:text-pixel-sm">
                <span className="hidden xs:inline">✓ Wallet Connected</span>
                <span className="xs:hidden">✓ Wallet</span>
              </div>
            ) : (
              <div className="bg-pixel-warning pixel-notification border-pixel-warning text-pixel-black px-2 sm:px-3 py-1 font-bold text-pixel-xs sm:text-pixel-sm">
                <span className="hidden xs:inline">⚠ Connect Wallet</span>
                <span className="xs:hidden">⚠ Wallet</span>
              </div>
            )}
          </div> */}
        </div>
      
        {!connected && (
          <div className="bg-pixel-error p-4 pixel-panel border-pixel-error mb-6">
            <p className="text-pixel-black text-center font-bold text-pixel-sm sm:text-pixel-base">
              Connecting to server...
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
        {/* Create Game Card */}
        <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-5 sm:p-8">
          <h3 className="text-pixel-xl font-bold text-pixel-primary mb-3 uppercase tracking-wide text-center">
            Create Game
          </h3>
          <p className="text-pixel-base-gray text-pixel-sm mb-4 text-center">
            Start a new multiplayer game and invite friends
          </p>
          <button
            onClick={() => {
              playSound('click');
              setShowCreateModal(true);
            }}
            disabled={!connected}
            className="w-full px-6 py-3 bg-pixel-primary hover:bg-pixel-success text-pixel-black font-bold text-pixel-base pixel-btn border-pixel-black uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create New Game
          </button>
        </div>

        {/* Join Game Card */}
        <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-5 sm:p-8">
          <h3 className="text-pixel-xl font-bold text-pixel-primary mb-3 uppercase tracking-wide text-center">
            Join Game
          </h3>
          <p className="text-pixel-base-gray text-pixel-sm mb-4 text-center">
            Enter a game ID to join an existing game
          </p>
          <button
            onClick={() => {
              playSound('click');
              setShowJoinModal(true);
            }}
            disabled={!connected}
            className="w-full px-6 py-3 bg-pixel-accent hover:bg-pixel-success text-pixel-black font-bold text-pixel-base pixel-btn border-pixel-black uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Join by Game ID
          </button>
        </div>
      </div>

      {/* Public Games Section */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-pixel-xl font-bold text-pixel-primary uppercase tracking-wide">
            Public Games
          </h3>
          <button
            onClick={() => {
              playSound('click');
              loadPublicGames();
            }}
            disabled={refreshingGames || !connected}
            className="px-3 py-2 bg-pixel-accent hover:bg-pixel-primary text-pixel-black font-bold text-pixel-sm pixel-btn border-pixel-black uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {refreshingGames ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {publicGames.length === 0 ? (
          <div className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-8 text-center">
            <p className="text-pixel-base-gray text-pixel-sm sm:text-pixel-base">
              No public games available. Create one to get started!
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block bg-pixel-dark-gray pixel-panel border-pixel-gray overflow-hidden mx-2 sm:mx-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-pixel-gray border-b-4 border-pixel-black">
                      <th className="text-left px-6 py-4 text-pixel-base font-bold text-pixel-primary uppercase tracking-wider">
                        Name
                      </th>
                      <th className="text-center px-6 py-4 text-pixel-base font-bold text-pixel-primary uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-center px-4 py-3 text-pixel-base font-bold text-pixel-primary uppercase tracking-wider">
                        Host
                      </th>
                      <th className="text-center px-4 py-3 text-pixel-base font-bold text-pixel-primary uppercase tracking-wider">
                        Players
                      </th>
                      <th className="text-center px-4 py-3 text-pixel-base font-bold text-pixel-primary uppercase tracking-wider">
                        Join Game
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {publicGames.map((game, index) => (
                      <tr 
                        key={game.id} 
                        className={`border-b-2 border-pixel-black hover:bg-pixel-light-gray transition-colors ${
                          index % 2 === 0 ? 'bg-pixel-dark-gray' : 'bg-pixel-black'
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div className="text-pixel-base font-bold text-pixel-base-gray truncate max-w-xs">
                            {game.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-3 py-1 text-pixel-xs font-bold pixel-notification ${
                            game.status === 'Open' 
                              ? 'bg-pixel-success text-pixel-black border-pixel-success'
                              : 'bg-pixel-warning text-pixel-black border-pixel-warning'
                          }`}>
                            {game.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-pixel-sm font-bold text-pixel-base-gray">
                            {game.hostName}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-pixel-sm font-bold text-pixel-base-gray">
                            {game.currentPlayers}/{game.maxPlayers}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => {
                              playSound('click');
                              handleJoinPublicGame(game.id);
                            }}
                            disabled={game.status !== 'Open' || !connected || joiningGameId !== null}
                            className="px-4 py-2 bg-pixel-primary hover:bg-pixel-success text-pixel-black font-bold text-pixel-sm pixel-btn border-pixel-black uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed min-h-touch"
                          >
                            {joiningGameId === game.id ? 'Joining...' : (game.status === 'Open' ? 'Join' : 'Full')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card Layout */}
            <div className="md:hidden space-y-4 px-2">
              {publicGames.map((game, index) => (
                <div key={game.id} className="bg-pixel-dark-gray pixel-panel border-pixel-gray p-5 hover:bg-pixel-gray transition-colors">
                  <div className="flex flex-col space-y-3">
                    {/* Game Name */}
                    <div className="flex items-center justify-between">
                      <h4 className="text-pixel-sm font-bold text-pixel-primary truncate flex-1 mr-2">
                        {game.name}
                      </h4>
                      <span className={`px-2 py-1 text-pixel-xs font-bold pixel-notification whitespace-nowrap ${
                        game.status === 'Open' 
                          ? 'bg-pixel-success text-pixel-black border-pixel-success'
                          : 'bg-pixel-warning text-pixel-black border-pixel-warning'
                      }`}>
                        {game.status}
                      </span>
                    </div>
                    
                    {/* Game Info */}
                    <div className="grid grid-cols-2 gap-3 text-pixel-xs">
                      <div>
                        <span className="text-pixel-base-gray font-bold block">Host:</span>
                        <span className="text-pixel-accent">{game.hostName}</span>
                      </div>
                      <div>
                        <span className="text-pixel-base-gray font-bold block">Players:</span>
                        <span className="text-pixel-accent">{game.currentPlayers}/{game.maxPlayers}</span>
                      </div>
                    </div>
                    
                    {/* Join Button */}
                    <button
                      onClick={() => {
                        playSound('click');
                        handleJoinPublicGame(game.id);
                      }}
                      disabled={game.status !== 'Open' || !connected || joiningGameId !== null}
                      className="w-full px-4 py-3 bg-pixel-primary hover:bg-pixel-success text-pixel-black font-bold text-pixel-sm pixel-btn border-pixel-black uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed min-h-touch"
                    >
                      {joiningGameId === game.id ? 'Joining...' : (game.status === 'Open' ? 'Join Game' : 'Game Full')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Create Game Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-50 p-4">
          <div className="bg-pixel-light-gray p-8 sm:p-10 pixel-panel border-pixel-black max-w-lg w-full mx-4">
            <h3 className="text-pixel-xl font-bold text-pixel-primary text-center mb-6 uppercase tracking-wider">
              Create New Game
            </h3>
            
            {error && (
              <div className="bg-pixel-error p-3 pixel-panel border-pixel-error mb-4">
                <p className="text-pixel-black text-pixel-sm font-bold text-center">
                  {error}
                </p>
              </div>
            )}
            
            {!showGameCreated ? (
              <>
                {/* Show player info */}
                <div className="bg-pixel-gray pixel-panel border-pixel-light-gray p-3 mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">{userProfile?.avatar}</div>
                    <div>
                      <div className="text-pixel-sm font-bold text-pixel-accent">{userProfile?.name}</div>
                      <div className="text-pixel-xs text-pixel-light-gray">Player</div>
                    </div>
                  </div>
                </div>
                
                <input
                  type="text"
                  value={gameName}
                  onChange={(e) => setGameName(e.target.value)}
                  placeholder="Enter game name"
                  className="w-full px-4 py-3 text-pixel-base font-bold bg-pixel-dark-gray text-pixel-base-gray border-4 border-pixel-gray focus:border-pixel-primary focus:outline-none mb-4"
                  maxLength={30}
                />
                
                <div className="mb-6">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPrivate}
                      onChange={(e) => setIsPrivate(e.target.checked)}
                      className="w-5 h-5 accent-pixel-primary"
                    />
                    <span className="text-pixel-base text-pixel-base-gray font-bold">
                      Private Game
                    </span>
                  </label>
                  <p className="text-pixel-xs text-pixel-base-gray mt-1 ml-8">
                    {isPrivate ? 'Only players with the Game ID can join' : 'Game will appear in public lobby'}
                  </p>
                </div>
                
                <div className="flex space-x-4">
                  <button
                    onClick={() => {
                      playSound('click');
                      handleCreateGame();
                    }}
                    disabled={!gameName.trim() || !userProfile?.name || !connected || loading}
                    className="flex-1 px-6 py-3 bg-pixel-primary hover:bg-pixel-success text-pixel-black font-bold text-pixel-base pixel-btn border-pixel-black uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Creating...' : 'Create'}
                  </button>
                  <button
                    onClick={() => {
                      playSound('click');
                      handleCloseCreateModal();
                    }}
                    className="flex-1 px-6 py-3 bg-pixel-gray hover:bg-pixel-light-gray text-pixel-primary font-bold text-pixel-base pixel-btn border-pixel-gray uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bg-pixel-dark-gray p-6 pixel-panel border-pixel-gray mb-6">
                  <div className="text-center">
                    <p className="text-pixel-sm font-bold text-pixel-light-gray mb-2 uppercase tracking-wider">
                      Game Created Successfully!
                    </p>
                    <p className="text-pixel-base font-bold text-pixel-primary mb-4">
                      Game ID:
                    </p>
                    <div className="flex items-center justify-center space-x-3 mb-4">
                      <span className="text-pixel-lg font-bold text-pixel-secondary bg-pixel-black px-4 py-2 pixel-notification border-pixel-secondary">
                        {createdGameId}
                      </span>
                      <button
                        onClick={handleCopyGameId}
                        className="px-4 py-2 bg-pixel-accent hover:bg-pixel-warning text-pixel-black font-bold text-pixel-sm pixel-btn border-pixel-black uppercase tracking-wider transition-colors"
                        title="Copy Game ID"
                      >
                        {copySuccess ? '✓ Copied!' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-pixel-xs text-pixel-base-gray">
                      Share this ID with friends to let them join!
                    </p>
                  </div>
                </div>
                <div className="flex space-x-4">
                  <button
                    onClick={() => {
                      playSound('click');
                      handlePlayCreatedGame();
                    }}
                    disabled={enteringGame}
                    className="flex-1 px-6 py-3 bg-pixel-primary hover:bg-pixel-success text-pixel-black font-bold text-pixel-base pixel-btn border-pixel-black uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {enteringGame ? 'Entering...' : 'Enter Game'}
                  </button>
                  <button
                    onClick={() => {
                      playSound('click');
                      handleCloseCreateModal();
                    }}
                    className="flex-1 px-6 py-3 bg-pixel-gray hover:bg-pixel-light-gray text-pixel-primary font-bold text-pixel-base pixel-btn border-pixel-gray uppercase tracking-wider"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Join by ID Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-50 p-4">
          <div className={`p-8 sm:p-10 pixel-panel max-w-lg w-full mx-4 ${
            joinError ? 'bg-pixel-error border-pixel-error' : 'bg-pixel-light-gray border-pixel-black'
          }`}>
            <h3 className={`text-pixel-xl font-bold text-center mb-6 uppercase tracking-wider ${
              joinError ? 'text-pixel-black' : 'text-pixel-primary'
            }`}>
              {joinError ? 'Error!' : 'Join Game'}
            </h3>
            
            {joinError && (
              <div className="bg-pixel-black p-3 pixel-panel border-pixel-error mb-4">
                <p className="text-pixel-error text-pixel-sm font-bold text-center uppercase tracking-wider">
                  {joinError}
                </p>
              </div>
            )}
            
            {/* Show player info */}
            <div className="bg-pixel-gray pixel-panel border-pixel-light-gray p-3 mb-4">
              <div className="flex items-center space-x-3">
                <div className="text-2xl">{userProfile?.avatar}</div>
                <div>
                  <div className="text-pixel-sm font-bold text-pixel-accent">{userProfile?.name}</div>
                  <div className="text-pixel-xs text-pixel-light-gray">Player</div>
                </div>
              </div>
            </div>
            
            <input
              type="text"
              value={joinGameId}
              onChange={(e) => {
                setJoinGameId(e.target.value.trim());
                if (joinError) setJoinError(''); // Reset error when typing
              }}
              placeholder="Enter Game ID"
              className={`w-full px-4 py-3 text-pixel-base font-bold border-4 focus:outline-none mb-6 uppercase tracking-wider text-center ${
                joinError 
                  ? 'bg-pixel-dark-gray text-pixel-error border-pixel-error focus:border-pixel-error'
                  : 'bg-pixel-dark-gray text-pixel-base-gray border-pixel-gray focus:border-pixel-primary'
              }`}
              maxLength={11}
            />
            
            <div className="flex space-x-4">
              <button
                onClick={() => {
                  playSound('click');
                  handleJoinById();
                }}
                disabled={!joinGameId.trim() || !userProfile?.name || !connected || loading}
                className={`flex-1 px-6 py-3 font-bold text-pixel-base pixel-btn uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed ${
                  joinError
                    ? 'bg-pixel-black hover:bg-pixel-dark-gray text-pixel-error border-pixel-error'
                    : 'bg-pixel-primary hover:bg-pixel-success text-pixel-black border-pixel-black'
                }`}
              >
                {loading ? 'Joining...' : 'Join Game'}
              </button>
              <button
                onClick={() => {
                  playSound('click');
                  handleCloseJoinModal();
                }}
                className={`flex-1 px-6 py-3 font-bold text-pixel-base pixel-btn uppercase tracking-wider ${
                  joinError
                    ? 'bg-pixel-dark-gray hover:bg-pixel-gray text-pixel-error border-pixel-error'
                    : 'bg-pixel-gray hover:bg-pixel-light-gray text-pixel-primary border-pixel-gray'
                }`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
   </div>
  );
  
}
