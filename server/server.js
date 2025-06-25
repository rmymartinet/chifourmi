const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:4200", "https://chifourmi.vercel.app"],
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors({
  origin: ["http://localhost:4200", "https://chifourmi.vercel.app"],
  methods: ["GET", "POST"],
  credentials: true
}));
app.use(express.json());

// État du jeu
let gameState = {
  players: {},
  currentRound: 0,
  maxRounds: 3,
  scores: { bordeaux: 0, vienne: 0 },
  roundInProgress: false,
  choices: {},
  winner: null
};

// Gestion des connexions WebSocket
io.on('connection', (socket) => {
  console.log('🔌 Nouveau joueur connecté:', socket.id);

  // Rejoindre le jeu
  socket.on('joinGame', (playerData) => {
    const { name, city } = playerData;
    
    // Vérifier si la ville est disponible
    const existingPlayer = Object.values(gameState.players).find(p => p.city === city);
    if (existingPlayer) {
      socket.emit('error', `La ville ${city} est déjà prise par ${existingPlayer.name} !`);
      return;
    }

    // Ajouter le joueur
    gameState.players[socket.id] = {
      id: socket.id,
      name: name,
      city: city
    };

    socket.emit('gameJoined', { 
      playerId: socket.id, 
      gameState: gameState 
    });

    // Informer tous les joueurs
    io.emit('playerJoined', gameState.players[socket.id]);
    io.emit('gameUpdate', gameState);

    console.log(`👤 ${name} (${city}) a rejoint le jeu`);
  });

  // Faire un choix
  socket.on('makeChoice', (choice) => {
    if (!gameState.players[socket.id]) {
      socket.emit('error', 'Vous devez rejoindre le jeu d\'abord !');
      return;
    }
    
    if (gameState.roundInProgress) {
      socket.emit('error', 'Manche en cours, attendez le résultat !');
      return;
    }

    // Enregistrer le choix
    gameState.choices[socket.id] = choice;
    
    // Informer que le joueur a fait son choix
    const playerCity = gameState.players[socket.id].city;
    io.emit('choiceMade', { city: playerCity });

    console.log(`⚡ ${gameState.players[socket.id].name} (${playerCity}) a choisi ${choice}`);

    // Vérifier si les deux joueurs ont fait leur choix
    const playerIds = Object.keys(gameState.players);
    if (playerIds.length === 2 && 
        gameState.choices[playerIds[0]] && 
        gameState.choices[playerIds[1]]) {
      
      console.log('🎲 Traitement de la manche...');
      processRound();
    }
  });

  // Commencer une nouvelle partie
  socket.on('newGame', () => {
    console.log('🔄 Nouvelle partie demandée');
    resetGame();
    io.emit('gameUpdate', gameState);
  });

  // Déconnexion
  socket.on('disconnect', () => {
    if (gameState.players[socket.id]) {
      const player = gameState.players[socket.id];
      delete gameState.players[socket.id];
      delete gameState.choices[socket.id];
      
      io.emit('playerLeft', player);
      io.emit('gameUpdate', gameState);
      
      console.log(`👋 ${player.name} (${player.city}) a quitté le jeu`);
    }
  });
});

function processRound() {
  gameState.roundInProgress = true;
  gameState.currentRound++;

  const playerIds = Object.keys(gameState.players);
  const choice1 = gameState.choices[playerIds[0]];
  const choice2 = gameState.choices[playerIds[1]];
  
  const player1 = gameState.players[playerIds[0]];
  const player2 = gameState.players[playerIds[1]];

  console.log(`🥊 Manche ${gameState.currentRound}: ${player1.name} (${choice1}) vs ${player2.name} (${choice2})`);

  // Déterminer le gagnant de la manche
  let roundWinner = null;
  if (choice1 === choice2) {
    roundWinner = 'égalité';
    console.log('🤝 Égalité !');
  } else if (
    (choice1 === 'pierre' && choice2 === 'ciseaux') ||
    (choice1 === 'papier' && choice2 === 'pierre') ||
    (choice1 === 'ciseaux' && choice2 === 'papier')
  ) {
    roundWinner = player1.city;
    gameState.scores[player1.city]++;
    console.log(`🏆 ${player1.name} (${player1.city}) gagne la manche !`);
  } else {
    roundWinner = player2.city;
    gameState.scores[player2.city]++;
    console.log(`🏆 ${player2.name} (${player2.city}) gagne la manche !`);
  }

  // Résultat de la manche
  const roundResult = {
    round: gameState.currentRound,
    choices: {
      [player1.city]: { player: player1.name, choice: choice1 },
      [player2.city]: { player: player2.name, choice: choice2 }
    },
    winner: roundWinner,
    scores: { ...gameState.scores }
  };

  // Vérifier si le jeu est terminé
  if (gameState.currentRound >= gameState.maxRounds) {
    if (gameState.scores.bordeaux > gameState.scores.vienne) {
      gameState.winner = 'bordeaux';
      console.log('🎉 Bordeaux remporte la partie ! Direction Vienne ! 🎼');
    } else if (gameState.scores.vienne > gameState.scores.bordeaux) {
      gameState.winner = 'vienne';
      console.log('🎉 Vienne remporte la partie ! Direction Bordeaux ! 🍷');
    } else {
      gameState.winner = 'égalité';
      console.log('🤝 Match nul ! Personne ne voyage !');
    }
  }

  // Envoyer les résultats
  io.emit('roundResult', roundResult);
  
  if (gameState.winner) {
    io.emit('gameFinished', {
      winner: gameState.winner,
      finalScores: gameState.scores
    });
  }

  // Réinitialiser pour la prochaine manche
  gameState.choices = {};
  gameState.roundInProgress = false;
  
  io.emit('gameUpdate', gameState);
}

function resetGame() {
  gameState.currentRound = 0;
  gameState.scores = { bordeaux: 0, vienne: 0 };
  gameState.choices = {};
  gameState.winner = null;
  gameState.roundInProgress = false;
  console.log('🔄 Partie réinitialisée');
}

// Route de santé
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    players: Object.keys(gameState.players).length,
    gameState: gameState 
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🎮 Serveur Chifourmi démarré sur le port ${PORT}`);
  console.log(`🌐 Frontend Angular: http://localhost:4200`);
  console.log(`🔌 WebSocket: http://localhost:${PORT}`);
  console.log(`💚 Health check: http://localhost:${PORT}/health\n`);
}); 