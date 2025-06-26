import dotenv from 'dotenv';
// Load environment variables FIRST
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GameDatabase } from './src/services/database.js';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: true, // Allow all origins for development
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());

// Store active game states in memory for real-time operations
// Database stores persistent data, memory stores real-time state
const activeGameStates = new Map();
const players = new Map(); // socketId -> playerInfo
const gameTimers = new Map(); // gameId -> timer objects
const inactivityTimers = new Map(); // gameId -> inactivity timer
const roundTimers = new Map(); // gameId -> round timer objects

// Helper function to generate game ID
function generateGameId() {
  // Create a more unique game ID using timestamp and random string
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 6);
  return `${timestamp}${random}`.toUpperCase();
}

// Helper function to generate player ID
function generatePlayerId() {
  return 'player_' + Math.random().toString(36).substr(2, 9);
}

// Initial game state template
function createInitialGameState() {
  return {
    currentRound: 1,
    maxRounds: 20,
    timeRemaining: { hours: 0, minutes: 1, seconds: 0 },
    players: [],
    marketChanges: [
      { resource: 'gold', change: 0, percentage: '+0%' },
      { resource: 'water', change: 0, percentage: '+0%' },
      { resource: 'oil', change: 0, percentage: '+0%' }
    ],
    recentActions: [],
    actionHistory: {}, // Store actions by round: { roundNumber: [actions] }
    status: 'waiting', // waiting, playing, finished
    host: null,
    timerActive: false,
    roundInProgress: false,
    nextRoundStartTime: null
  };
}

// Create initial player state
function createPlayer(playerId, playerName, socketId, walletAddress = null) {
  return {
    id: playerId,
    name: playerName,
    socketId: socketId,
    walletAddress: walletAddress,
    tokens: 1000,
    assets: { gold: 0, water: 0, oil: 0 },
    totalAssets: 0,
    connected: true
  };
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Get public games list
  socket.on('get-public-games', async () => {
    try {
      const publicGames = await GameDatabase.getPublicGames();
      
      // Format for frontend
      const formattedGames = publicGames.map(game => ({
        id: game.game_id,
        name: game.game_name,
        status: game.current_players >= game.max_players ? 'Full' : 'Open',
        currentPlayers: game.current_players,
        maxPlayers: game.max_players,
        hostName: game.host_name || 'Unknown',
        createdAt: game.created_at
      }));
      
      socket.emit('public-games-list', formattedGames);
    } catch (error) {
      console.error('Error fetching public games:', error);
      socket.emit('public-games-list', []);
    }
  });

  // Create a new game
  socket.on('create-game', async (data) => {
    try {
      const { gameName,gameId, playerName, isPrivate, walletAddress } = data;
      
      // Use wallet address as playerId for consistent host detection
      const playerId = walletAddress || generatePlayerId();
      
      console.log(`🎮 Creating game with host wallet: ${walletAddress}, playerId: ${playerId}`);
      
      const gameState = createInitialGameState();
      const player = createPlayer(playerId, playerName, socket.id, walletAddress);
      
      gameState.players.push(player);
      gameState.host = playerId; // This will now be the wallet address
      gameState.gameName = gameName;
      gameState.isPrivate = isPrivate || false;
      gameState.createdAt = new Date();
      
      // Save to database
      const dbGame = await GameDatabase.createGame({
        gameName,
        gameId,
        isPrivate: isPrivate || false,
        players: [player],
        gameState,
        hostPlayerId: playerId
      });
      
      if (!dbGame) {
        socket.emit('error', { message: 'Failed to create game' });
        return;
      }
      
      // Store in memory for real-time operations
      activeGameStates.set(gameId, gameState);
      players.set(socket.id, { gameId, playerId, playerName });
      
      // Join the game room
      socket.join(gameId);
      
      console.log(`Server: Emitting game-created for game ${gameId}`);
      socket.emit('game-created', { gameId, playerId });
      
      // Add a small delay to ensure game-created is processed first
      setTimeout(() => {
        console.log(`Server: Sending initial game state for game ${gameId}`);
        socket.emit('game-state', gameState);
      }, 200); // Increased delay to 200ms for better synchronization
      
      console.log(`Game created: ${gameId} by ${playerName}`);
    } catch (error) {
      console.error('Error creating game:', {
        message: error.message,
        details: error.stack,
        hint: error.hint || '',
        code: error.code || ''
      });
      socket.emit('error', { 
        message: 'Failed to create game',
        details: error.message,
        errorType: error.name || 'UnknownError'
      });
    }
  });

  // Join an existing game
  socket.on('join-game', async (data) => {
    try {
      const { gameId, playerName, walletAddress } = data;
      
      console.log(`🎮 Player joining with wallet: ${walletAddress}`);
      
      
      // Check if game exists in memory first, otherwise load from database
      let game = activeGameStates.get(gameId);
      if (!game) {
        const dbGame = await GameDatabase.getGame(gameId);
        if (!dbGame) {
          socket.emit('error', { message: 'Game not found' });
          return;
        }
        
        // Reconstruct game state from database
        game = {
          ...dbGame.game_state,
          players: dbGame.players,
          gameName: dbGame.game_name,
          isPrivate: dbGame.visibility === 'private',
          status: dbGame.status,
          host: dbGame.host_player_id,
          createdAt: new Date(dbGame.created_at)
        };
        
        activeGameStates.set(gameId, game);
      }
      
      if (game.players.length >= 4) {
        socket.emit('error', { message: 'Game is full' });
        return;
      }
      
      if (game.status !== 'waiting') {
        socket.emit('error', { message: 'Game already in progress' });
        return;
      }
      
      // Use wallet address as playerId for consistent player identification
      const playerId = walletAddress || generatePlayerId();
      const player = createPlayer(playerId, playerName, socket.id, walletAddress);
      
      game.players.push(player);
      activeGameStates.set(gameId, game);
      players.set(socket.id, { gameId, playerId, playerName });
      
      // Update database
      await GameDatabase.addPlayerToGame(gameId, player);
      
      // Join the game room
      socket.join(gameId);
      
      console.log(`Server: Player ${playerName} joined game ${gameId}, sending game state`);
      
      // Notify all players in the game
      socket.emit('game-joined', { gameId, playerId });
      
      // Send game state to all players
      setTimeout(() => {
        console.log(`Server: Broadcasting game state to all players in game ${gameId}`);
        io.to(gameId).emit('game-state', game);
        io.to(gameId).emit('player-joined', { playerName });
      }, 100);
      
      console.log(`${playerName} joined game: ${gameId}`);
    } catch (error) {
      console.error('Error joining game:', error);
      socket.emit('error', { message: 'Failed to join game' });
    }
  });

  // Get current game state (useful when player enters an existing game)
  socket.on('get-game-state', async (data) => {
    try {
      console.log('Server: get-game-state request received:', data);
      const { gameId } = data;
      
      if (!gameId) {
        console.error('Server: No gameId provided in get-game-state request');
        socket.emit('error', { message: 'No game ID provided' });
        return;
      }
      
      // Check if game exists in memory first
      let game = activeGameStates.get(gameId);
      console.log(`Server: Game ${gameId} found in memory:`, !!game);
      
      if (!game) {
        console.log(`Server: Game ${gameId} not in memory, checking database...`);
        // Try to load from database
        const dbGame = await GameDatabase.getGame(gameId);
        if (!dbGame) {
          console.error(`Server: Game ${gameId} not found in database`);
          socket.emit('error', { message: 'Game not found' });
          return;
        }
        
        console.log(`Server: Game ${gameId} found in database, reconstructing state`);
        // Reconstruct game state from database
        game = {
          ...dbGame.game_state,
          players: dbGame.players,
          gameName: dbGame.game_name,
          isPrivate: dbGame.visibility === 'private',
          status: dbGame.status,
          host: dbGame.host_player_id,
          createdAt: new Date(dbGame.created_at)
        };
        
        activeGameStates.set(gameId, game);
      }
      
      console.log(`Server: Sending game state to player for game: ${gameId}`, {
        status: game.status,
        playerCount: game.players?.length || 0,
        host: game.host
      });
      socket.emit('game-state', game);
      
    } catch (error) {
      console.error('Error getting game state:', error);
      socket.emit('error', { message: 'Failed to get game state' });
    }
  });

  // Start the game
  socket.on('start-game', async () => {
    try {
      const playerInfo = players.get(socket.id);
      if (!playerInfo) return;
      
      const game = activeGameStates.get(playerInfo.gameId);
      
      // Enhanced host verification with multiple criteria
      const isHost = (
        game.host === playerInfo.playerId ||  // Primary: Direct host ID match
        game.players.find(p => p.id === playerInfo.playerId)?.walletAddress === game.players.find(p => p.id === game.host)?.walletAddress ||  // Secondary: Wallet match
        (game.players.length > 0 && game.players[0].id === playerInfo.playerId)  // Fallback: First player
      );
      
      console.log('🔍 HOST VERIFICATION:', {
        gameId: playerInfo.gameId,
        playerId: playerInfo.playerId,
        playerName: playerInfo.playerName,
        gameHost: game.host,
        playerWallet: game.players.find(p => p.id === playerInfo.playerId)?.walletAddress,
        hostWallet: game.players.find(p => p.id === game.host)?.walletAddress,
        isFirstPlayer: game.players.length > 0 && game.players[0].id === playerInfo.playerId,
        finalDecision: isHost ? 'ALLOW START' : 'DENY START'
      });
      
      if (!game || !isHost) {
        socket.emit('error', { message: 'Only the host can start the game' });
        return;
      }
      
      if (game.players.length < 2) {
        socket.emit('error', { message: 'Need at least 2 players to start' });
        return;
      }
      
      game.status = 'playing';
      game.timerActive = true;
      activeGameStates.set(playerInfo.gameId, game);
      
      // Update database status
      await GameDatabase.updateGameStatus(playerInfo.gameId, 'playing');
      
      io.to(playerInfo.gameId).emit('game-started');
      io.to(playerInfo.gameId).emit('game-state', game);
      
      // Start the game timer
      startGameTimer(playerInfo.gameId);
      
      console.log(`Game started: ${playerInfo.gameId}`);
    } catch (error) {
      console.error('Error starting game:', error);
      socket.emit('error', { message: 'Failed to start game' });
    }
  });

  // Handle player exit
  socket.on('exit-game', async (data) => {
    try {
      const playerInfo = players.get(socket.id);
      if (!playerInfo) return;
      
      const game = activeGameStates.get(playerInfo.gameId);
      if (!game) return;
      
      console.log(`Player ${playerInfo.playerName} is exiting game ${playerInfo.gameId}`);
      
      // Initialize exitedPlayers array if it doesn't exist
      if (!game.exitedPlayers) {
        game.exitedPlayers = new Set();
      }
      
      // Add player to exited players list
      game.exitedPlayers.add(playerInfo.playerId);
      
      // Reset inactivity timer since there's activity
      resetInactivityTimer(playerInfo.gameId);
      
      // Check if all players have exited
      const allPlayersExited = game.players.every(player => 
        game.exitedPlayers.has(player.id) || !player.connected
      );
      
      if (allPlayersExited) {
        console.log(`All players exited game ${playerInfo.gameId}, closing game`);
        await closeGame(playerInfo.gameId, 'All players exited');
      } else {
        // Just remove this player and update game state
        removePlayerFromGame(playerInfo.gameId, playerInfo.playerId);
        
        // Notify remaining players
        io.to(playerInfo.gameId).emit('player-disconnected', { 
          playerName: playerInfo.playerName,
          reason: 'exited'
        });
      }
      
      // Remove player from socket tracking
      players.delete(socket.id);
      socket.leave(playerInfo.gameId);
      
    } catch (error) {
      console.error('Error handling player exit:', error);
    }
  });

  // Handle next round (host only)
  socket.on('next-round', async () => {
    try {
      const playerInfo = players.get(socket.id);
      if (!playerInfo) return;
      
      const game = activeGameStates.get(playerInfo.gameId);
      if (!game || game.status !== 'playing') return;
      
      // Verify host
      const isHost = (
        game.host === playerInfo.playerId ||
        game.players.find(p => p.id === playerInfo.playerId)?.walletAddress === game.players.find(p => p.id === game.host)?.walletAddress
      );
      
      if (!isHost) {
        socket.emit('error', { message: 'Only the host can advance to next round' });
        return;
      }
      
      // Move current round actions to action history
      if (game.recentActions.length > 0) {
        game.actionHistory[game.currentRound] = [...game.recentActions];
      }
      
      // Advance to next round
      game.currentRound += 1;
      game.recentActions = [];
      game.roundInProgress = false;
      game.nextRoundStartTime = Date.now() + 10000;
      
      if (game.currentRound > game.maxRounds) {
        await finishGame(playerInfo.gameId);
        return;
      }
      
      game.timeRemaining = { hours: 0, minutes: 1, seconds: 0 };
      activeGameStates.set(playerInfo.gameId, game);
      
      io.to(playerInfo.gameId).emit('next-round', {
        round: game.currentRound,
        delay: 10000
      });
      
      io.to(playerInfo.gameId).emit('game-state', game);
      
      setTimeout(() => {
        const updatedGame = activeGameStates.get(playerInfo.gameId);
        if (updatedGame && updatedGame.currentRound === game.currentRound) {
          updatedGame.roundInProgress = true;
          updatedGame.nextRoundStartTime = null;
          activeGameStates.set(playerInfo.gameId, updatedGame);
          
          io.to(playerInfo.gameId).emit('round-started', {
            round: updatedGame.currentRound
          });
          
          io.to(playerInfo.gameId).emit('game-state', updatedGame);
        }
      }, 10000);
      
    } catch (error) {
      console.error('Error handling next round:', error);
      socket.emit('error', { message: 'Failed to advance to next round' });
    }
  });

  // Handle player actions
  socket.on('player-action', (data) => {
    const playerInfo = players.get(socket.id);
    
    if (!playerInfo) return;
    
    const game = activeGameStates.get(playerInfo.gameId);
     
    if (!game || game.status !== 'playing') return;
    
    // Reset inactivity timer since there's activity
    resetInactivityTimer(playerInfo.gameId);
    
    const { action, resource, amount, targetPlayer } = data;
    console.log("Daaaatttttttttaaaaaaaaaadata",action, resource.toLowerCase(), amount, targetPlayer);
    
    const player = game.players.find(p => p.id === playerInfo.playerId);
    
    if (!player) return;
    
    let actionText = '';
    const resourcePrices = { gold: 10, water: 15, oil: 25 };
    const price = resourcePrices[resource.toLowerCase()] * amount;
    
    switch (action) {
      case 'Buy':
        if (player.tokens >= price) {
          console.log("buying",resource.toLowerCase());
          
          player.tokens -= price;
          player.assets[resource.toLowerCase()] += amount;
          actionText = `${player.name} bought ${amount} ${resource.charAt(0).toUpperCase() + resource.slice(1)} for ${price} tokens`;
        }
        break;
        
      case 'Sell':
        if (player.assets[resource.toLowerCase()] >= amount) {
                    console.log("selling",resource.toLowerCase());

          const sellPrice = Math.floor(price * 0.8);
          player.tokens += sellPrice;
          player.assets[resource.toLowerCase()] -= amount;
          actionText = `${player.name} sold ${amount} ${resource.charAt(0).toUpperCase() + resource.slice(1)} for ${sellPrice} tokens`;
        }
        break;
        
      case 'Burn':
        if (player.assets[resource.toLowerCase()] >= amount) {
          player.assets[resource.toLowerCase()] -= amount;
          // Update market changes
          const marketChange = game.marketChanges.find(m => m.resource === resource.toLowerCase());
          if (marketChange) {
            marketChange.change += amount * 3;
            marketChange.percentage = `${marketChange.change > 0 ? '+' : ''}${marketChange.change}%`;
          }
          actionText = `${player.name} burned ${amount} ${resource.charAt(0).toUpperCase() + resource.slice(1)} to boost market price`;
        }
        break;
        
      case 'Sabotage':
        if (player.tokens >= 100 && targetPlayer) {
          player.tokens -= 100;
          const target = game.players.find(p => p.id === targetPlayer);
          console.log("target",target);
          
          if (target.assets[resource.toLowerCase()] >= amount) {
            target.assets[resource.toLowerCase()] = Math.max(0, target.assets[resource.toLowerCase()] - amount);
            target.totalAssets = target.assets.gold + target.assets.water + target.assets.oil;
            actionText = `${player.name} sabotaged ${target.name}'s ${resource.charAt(0).toUpperCase() + resource.slice(1)} reserves`;
          }
        }
        break;
    }
    // {"state":{"player":{"address":"0x5c4556fe32577eb35375d5bc9de4ee27dd5c099e312a8ddf367791e9f5bc11b","name":"CryptoHero414","token_balance":1000},"currentGame":{"id":"1750896436","round":"1","is_active":true,"max_rounds":"20","num_players":"3"},"gameStarted":true,"selectedAsset":"Water","selectedAction":"Buy","isHost":false,"gameFinished":false,"activeTab":"wallet"},"version":0}
    // Update player's total assets
    player.totalAssets = player.assets.gold + player.assets.water + player.assets.oil;
    console.log();
    
    // Add action to recent actions
    if (actionText) {
      game.recentActions.unshift(actionText);
      game.recentActions = game.recentActions.slice(0, 10); // Keep only last 10 actions
    }
    
    activeGameStates.set(playerInfo.gameId, game);
    // console.log("final state",game);
    
    io.to(playerInfo.gameId).emit('game-state', game);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    const playerInfo = players.get(socket.id);
    if (playerInfo) {
      const game = activeGameStates.get(playerInfo.gameId);
      if (game) {
        // Mark player as disconnected
        const player = game.players.find(p => p.id === playerInfo.playerId);
        if (player) {
          player.connected = false;
        }
        
        // If host disconnects, assign new host
        if (game.host === playerInfo.playerId) {
          const connectedPlayers = game.players.filter(p => p.connected);
          if (connectedPlayers.length > 0) {
            game.host = connectedPlayers[0].id;
          }
        }
        
        activeGameStates.set(playerInfo.gameId, game);
        io.to(playerInfo.gameId).emit('game-state', game);
        io.to(playerInfo.gameId).emit('player-disconnected', { playerName: playerInfo.playerName });
      }
      
      players.delete(socket.id);
    }
  });
});

// Helper function to finish game
async function finishGame(gameId) {
  try {
    const game = activeGameStates.get(gameId);
    if (!game) return;
    
    // Calculate final scores
    const finalPlayers = game.players.map(player => {
      const goldValue = player.assets.gold * 10;
      const waterValue = player.assets.water * 15;
      const oilValue = player.assets.oil * 25;
      const finalScore = player.tokens + goldValue + waterValue + oilValue;
      
      return {
        ...player,
        finalScore
      };
    });
    
    // Sort by final score to determine winner
    finalPlayers.sort((a, b) => b.finalScore - a.finalScore);
    
    game.status = 'finished';
    game.timerActive = false;
    game.winner = finalPlayers[0];
    game.finalScores = finalPlayers;
    
    activeGameStates.set(gameId, game);
    
    // Update database
    await GameDatabase.updateGameStatus(gameId, 'finished');
    
    // Notify all players
    io.to(gameId).emit('game-finished', {
      winner: game.winner,
      finalScores: finalPlayers
    });
    
    io.to(gameId).emit('game-state', game);
    
    
  } catch (error) {
    console.error('Error finishing game:', error);
  }
}

// Helper function to remove player from game
function removePlayerFromGame(gameId, playerId) {
  const game = activeGameStates.get(gameId);
  if (!game) return;
  
  game.players = game.players.filter(p => p.id !== playerId);
  activeGameStates.set(gameId, game);
}

// Helper function to close and cleanup a game
async function closeGame(gameId, reason = 'Game closed') {
  try {
    console.log(`Closing game ${gameId}: ${reason}`);
    
    // Clear any timers
    const timer = gameTimers.get(gameId);
    if (timer) {
      clearInterval(timer);
      gameTimers.delete(gameId);
    }
    
    const inactivityTimer = inactivityTimers.get(gameId);
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
      inactivityTimers.delete(gameId);
    }
    
    // Notify all remaining players
    io.to(gameId).emit('game-closed', { reason });
    
    // Remove from active games
    activeGameStates.delete(gameId);
    
    // Update database status
    await GameDatabase.updateGameStatus(gameId, 'closed');
    
    // Disconnect all sockets from this room
    const room = io.sockets.adapter.rooms.get(gameId);
    if (room) {
      room.forEach(socketId => {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          socket.leave(gameId);
          // Clear player tracking for this socket
          const playerInfo = players.get(socketId);
          if (playerInfo && playerInfo.gameId === gameId) {
            players.delete(socketId);
          }
        }
      });
    }
    
    console.log(`Game ${gameId} successfully closed and cleaned up`);
  } catch (error) {
    console.error(`Error closing game ${gameId}:`, error);
  }
}

// Helper function to reset inactivity timer
function resetInactivityTimer(gameId) {
  // Clear existing timer
  const existingTimer = inactivityTimers.get(gameId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  
  // Set new 20-minute inactivity timer
  const inactivityTimer = setTimeout(async () => {
    console.log(`Game ${gameId} has been inactive for 20 minutes, auto-closing`);
    await closeGame(gameId, 'Game closed due to 20 minutes of inactivity');
  }, 20 * 60 * 1000); // 20 minutes
  
  inactivityTimers.set(gameId, inactivityTimer);
}

// Game timer function
function startGameTimer(gameId) {
  // Start inactivity timer when game starts
  resetInactivityTimer(gameId);
  const timer = setInterval(async () => {
    const game = activeGameStates.get(gameId);
    if (!game || !game.timerActive) {
      clearInterval(timer);
      return;
    }
    
    const { hours, minutes, seconds } = game.timeRemaining;
    let newSeconds = seconds - 1;
    let newMinutes = minutes;
    let newHours = hours;
    
    if (newSeconds < 0) {
      newSeconds = 59;
      newMinutes -= 1;
    }
    if (newMinutes < 0) {
      newMinutes = 59;
      newHours -= 1;
    }
    
    if (newHours < 0) {
      // Round ended
      game.currentRound += 1;
      
      if (game.currentRound > game.maxRounds) {
        // Game finished
        game.status = 'finished';
        game.timerActive = false;
        
        // Update database status
        await GameDatabase.updateGameStatus(gameId, 'finished');
        
        io.to(gameId).emit('game-finished', game);
      } else {
        // New round
        game.timeRemaining = { hours: 0, minutes: 1, seconds: 0 };
        game.recentActions = [];
        
        // Generate new market trends
        game.marketChanges = game.marketChanges.map(change => {
          const randomChange = Math.floor(Math.random() * 40) - 20;
          return {
            ...change,
            change: randomChange,
            percentage: `${randomChange > 0 ? '+' : ''}${randomChange}%`
          };
        });
      }
    } else {
      game.timeRemaining = { hours: newHours, minutes: newMinutes, seconds: newSeconds };
    }
    
    activeGameStates.set(gameId, game);
    io.to(gameId).emit('game-state', game);
  }, 1000);
}

// Market fluctuations
setInterval(() => {
  activeGameStates.forEach((game, gameId) => {
    if (game.status === 'playing') {
      game.marketChanges = game.marketChanges.map(change => {
        const fluctuation = Math.floor(Math.random() * 10) - 5;
        const newChange = Math.max(-50, Math.min(50, change.change + fluctuation));
        return {
          ...change,
          change: newChange,
          percentage: `${newChange > 0 ? '+' : ''}${newChange}%`
        };
      });
      
      activeGameStates.set(gameId, game);
      io.to(gameId).emit('game-state', game);
    }
  });
}, 5000);

// Comprehensive database cleanup every hour
setInterval(async () => {
  try {
    console.log('🧹 Running scheduled database cleanup...');
    const result = await GameDatabase.performFullCleanup();
    
    if (result.success) {
      // Also clean up memory states for removed games
      if (result.staleGamesRemoved > 0 || result.abandonedGamesRemoved > 0) {
        console.log('🧹 Cleaning up memory states for removed games...');
        
        // Get current active game IDs from database to sync memory
        const activeDbGames = await GameDatabase.getPublicGames();
        const activeDbGameIds = new Set(activeDbGames.map(g => g.game_id));
        
        // Remove memory states for games that no longer exist in database
        for (const [gameId] of activeGameStates) {
          if (!activeDbGameIds.has(gameId)) {
            console.log(`🧹 Removing memory state for deleted game: ${gameId}`);
            activeGameStates.delete(gameId);
            
            // Clear any associated timers
            if (gameTimers.has(gameId)) {
              clearInterval(gameTimers.get(gameId));
              gameTimers.delete(gameId);
            }
            if (inactivityTimers.has(gameId)) {
              clearTimeout(inactivityTimers.get(gameId));
              inactivityTimers.delete(gameId);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Error during comprehensive cleanup:', error);
  }
}, 60 * 60 * 1000); // Every hour

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access from other devices: http://YOUR_IP_ADDRESS:${PORT}`);
  console.log('Supabase database integration enabled');
  
  // Cleanup old test games on startup
  try {
    await GameDatabase.cleanupOldGames(0.1); // Remove games older than 6 minutes for testing
    console.log('Cleaned up old test games on startup');
  } catch (error) {
    console.error('Error cleaning up old games on startup:', error);
  }
});

