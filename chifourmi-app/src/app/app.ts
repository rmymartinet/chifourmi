import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { io, Socket } from 'socket.io-client';
import { environment } from '../environments/environment';

type CityType = 'bordeaux' | 'vienne' | 'france' | 'tunisie' | 'chelsea' | 'esperance';

interface Player {
  id: string;
  name: string;
  city: CityType;
}

interface GameTheme {
  name: string;
  cities: {
    city1: { name: string; emoji: string; color: string };
    city2: { name: string; emoji: string; color: string };
  };
  specialMessage?: string;
  winnerMessage?: string;
}

interface GameState {
  players: { [socketId: string]: Player };
  currentRound: number;
  maxRounds: number;
  scores: { [key: string]: number };
  roundInProgress: boolean;
  choices: { [socketId: string]: string };
  winner: string | null;
  theme?: string;
}

interface RoundResult {
  round: number;
  choices: { [key: string]: { player: string; choice: string } };
  winner: string;
  scores: { [key: string]: number };
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class AppComponent implements OnInit, OnDestroy {
  private socket: Socket;
  
  // État de connexion
  isConnected = false;
  isConnecting = false;
  errorMessage = '';
  
  // Données du joueur
  playerName = '';
  selectedCity: CityType | '' = '';
  playerId = '';
  
  // Thème du jeu
  currentTheme: GameTheme = this.getDefaultTheme();
  
  // État du jeu
  players: { [key: string]: Player } = {};
  scores: { [key: string]: number } = {};
  currentRound = 0;
  gameFinished = false;
  finalWinner = '';
  
  // État de la manche
  roundWinner = '';
  lastRoundResult: RoundResult | null = null;
  waitingChoices: { [key: string]: boolean } = {};
  
  constructor(private cdr: ChangeDetectorRef) {
    this.socket = io(environment.socketUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });
    console.log('🔌 Connecting to:', environment.socketUrl);
    console.log('🌍 Environment:', environment);
  }

  private getDefaultTheme(): GameTheme {
    return {
      name: 'default',
      cities: {
        city1: { name: 'France', emoji: '🇫🇷', color: 'blue' },
        city2: { name: 'Tunisie', emoji: '🇹🇳', color: 'red' }
      }
    };
  }

  private getThemeForPlayers(): GameTheme {
    // Inclure le nom du joueur local aussi
    const allNames = [this.playerName, ...Object.values(this.players).map(p => p.name)];
    const playerNames = allNames.map(name => name.toLowerCase()).filter(name => name);
    
    if (playerNames.includes('maria')) {
      return {
        name: 'romantic',
        cities: {
          city1: { name: 'Bordeaux', emoji: '🍷', color: 'red' },
          city2: { name: 'Vienne', emoji: '🎼', color: 'purple' }
        },
        specialMessage: 'Rémy je t\'aime',
        winnerMessage: 'vienne'
      };
    }
    
    if (playerNames.includes('sarra')) {
      return {
        name: 'tunisia-france',
        cities: {
          city1: { name: 'France', emoji: '🇫🇷', color: 'blue' },
          city2: { name: 'Tunisie', emoji: '🇹🇳', color: 'red' }
        },
        specialMessage: 'La Tunisie perd encore une fois !',
        winnerMessage: 'france'
      };
    }
    
    return this.getDefaultTheme();
  }

  private updateTheme() {
    this.currentTheme = this.getThemeForPlayers();
    this.initializeScoresForTheme();
  }

  private initializeScoresForTheme() {
    const cities = Object.keys(this.currentTheme.cities);
    this.scores = {};
    this.waitingChoices = {};
    
    if (this.currentTheme.name === 'romantic') {
      this.scores = { bordeaux: 0, vienne: 0 };
      this.waitingChoices = { bordeaux: false, vienne: false };
    } else if (this.currentTheme.name === 'tunisia-france') {
      this.scores = { france: 0, tunisie: 0 };
      this.waitingChoices = { france: false, tunisie: false };
    } else {
      this.scores = { france: 0, tunisie: 0 };
      this.waitingChoices = { france: false, tunisie: false };
    }
  }

  getCityOptions(): Array<{key: CityType, name: string, emoji: string}> {
    if (this.currentTheme.name === 'romantic') {
      return [
        { key: 'bordeaux' as CityType, name: 'Bordeaux', emoji: '🍷' },
        { key: 'vienne' as CityType, name: 'Vienne', emoji: '🎼' }
      ];
    } else if (this.currentTheme.name === 'tunisia-france') {
      return [
        { key: 'france' as CityType, name: 'France', emoji: '🇫🇷' },
        { key: 'tunisie' as CityType, name: 'Tunisie', emoji: '🇹🇳' }
      ];
    } else {
      // Thème par défaut : France vs Tunisie
      return [
        { key: 'france' as CityType, name: 'France', emoji: '🇫🇷' },
        { key: 'tunisie' as CityType, name: 'Tunisie', emoji: '🇹🇳' }
      ];
    }
  }

  ngOnInit() {
    this.setupSocketListeners();
  }

  ngOnDestroy() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  private setupSocketListeners() {
    this.socket.on('connect', () => {
      console.log('✅ Connecté au serveur WebSocket, ID:', this.socket.id);
      // Reset connection state si on était en train de se connecter
      if (this.isConnecting) {
        console.log('🔄 Réinitialisation état de connexion');
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Erreur de connexion Socket.io:', error);
      this.isConnecting = false;
      this.showError('Erreur de connexion au serveur. Vérifiez votre connexion.');
      this.cdr.detectChanges();
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      console.log('❌ Déconnecté du serveur:', reason);
    });

    this.socket.on('gameJoined', (data: { playerId: string; gameState: GameState }) => {
      console.log('🎉 Jeu rejoint avec succès !', data);
      this.playerId = data.playerId;
      this.isConnected = true;
      this.isConnecting = false;
      this.updateGameState(data.gameState);
      this.clearError();
      this.cdr.detectChanges(); // Force la détection de changement
      console.log('🔄 Interface mise à jour, isConnecting:', this.isConnecting);
    });

    this.socket.on('gameUpdate', (gameState: GameState) => {
      this.updateGameState(gameState);
      this.cdr.detectChanges();
    });

    this.socket.on('playerJoined', (player: Player) => {
      this.players[player.city] = player;
      this.cdr.detectChanges();
    });

    this.socket.on('playerLeft', (player: Player) => {
      delete this.players[player.city];
      this.cdr.detectChanges();
    });

    this.socket.on('choiceMade', (data: { city: string }) => {
      console.log('⚡ Choix reçu pour', data.city);
      this.waitingChoices[data.city] = true;
      this.cdr.detectChanges();
    });

    this.socket.on('roundResult', (result: RoundResult) => {
      console.log('🎯 Résultat de manche reçu:', result);
      this.lastRoundResult = result;
      this.roundWinner = result.winner;
      this.scores = result.scores;
      this.waitingChoices = { bordeaux: false, vienne: false };
      this.cdr.detectChanges();
      
      // Effacer le résultat après 3 secondes
      setTimeout(() => {
        this.roundWinner = '';
        this.lastRoundResult = null;
        this.cdr.detectChanges();
      }, 3000);
    });

    this.socket.on('gameFinished', (data: { winner: string; finalScores: any }) => {
      console.log('🏆 Partie terminée:', data);
      console.log('🎯 finalWinner sera:', data.winner);
      this.gameFinished = true;
      this.finalWinner = data.winner;
      this.scores = data.finalScores;
      this.cdr.detectChanges();
      console.log('✅ Interface mise à jour - gameFinished:', this.gameFinished, 'finalWinner:', this.finalWinner);
    });

    this.socket.on('error', (message: string) => {
      console.log('❌ Erreur du serveur:', message);
      this.isConnecting = false;
      this.showError(message);
      this.cdr.detectChanges(); // Force la détection de changement
    });
  }

  private updateGameState(gameState: GameState) {
    this.currentRound = gameState.currentRound;
    this.scores = gameState.scores;
    this.gameFinished = !!gameState.winner;
    this.finalWinner = gameState.winner || '';
    
    // Mettre à jour les joueurs
    Object.values(gameState.players).forEach(player => {
      this.players[player.city] = player;
    });
    
    // Mettre à jour le thème si nécessaire
    this.updateTheme();
  }

  onPlayerNameChange() {
    // Mettre à jour le thème en fonction du nom
    this.updateTheme();
    // Réinitialiser la ville sélectionnée si elle n'est plus valide
    const validCities = this.getCityOptions().map(c => c.key);
    if (this.selectedCity && !validCities.includes(this.selectedCity as CityType)) {
      this.selectedCity = '';
    }
  }

  joinGame() {
    if (!this.playerName || !this.selectedCity || this.isConnecting) return;
    
    this.isConnecting = true;
    console.log('🚀 Tentative de connexion...', { name: this.playerName, city: this.selectedCity });
    
    this.socket.emit('joinGame', {
      name: this.playerName,
      city: this.selectedCity
    });
    
    // Timeout de sécurité au cas où le serveur ne répond pas
    setTimeout(() => {
      if (this.isConnecting) {
        console.log('⏰ Timeout de connexion - état socket:', this.socket.connected);
        this.isConnecting = false;
        this.showError('Connexion échouée. Vérifiez que le serveur fonctionne.');
        this.cdr.detectChanges();
      }
    }, 5000);
  }

  makeChoice(choice: string) {
    if (!this.canPlay()) return;
    
    this.socket.emit('makeChoice', choice);
    
    // Marquer que ce joueur a fait son choix
    const playerCity = this.getPlayerCity();
    if (playerCity) {
      this.waitingChoices[playerCity] = true;
    }
  }

  newGame() {
    console.log('🔄 Nouvelle partie demandée');
    this.socket.emit('newGame');
    this.gameFinished = false;
    this.finalWinner = '';
    this.roundWinner = '';
    this.lastRoundResult = null;
    this.waitingChoices = { bordeaux: false, vienne: false };
    this.cdr.detectChanges();
  }

  canPlay(): boolean {
    const playerCity = this.getPlayerCity();
    return playerCity ? !this.waitingChoices[playerCity] && !this.gameFinished : false;
  }

  private getPlayerCity(): CityType | null {
    for (const [city, player] of Object.entries(this.players)) {
      if (player.id === this.playerId) return city as CityType;
    }
    return null;
  }

  getChoiceEmoji(choice: string): string {
    switch (choice) {
      case 'pierre': return '🪨';
      case 'papier': return '📄';
      case 'ciseaux': return '✂️';
      default: return '❓';
    }
  }

  getWinnerDisplayName(winner: string): string {
    const cityOption = this.getCityOptions().find(c => c.key === winner);
    return cityOption ? cityOption.name : winner;
  }

  shouldShowSpecialMessage(): boolean {
    if (!this.gameFinished || !this.currentTheme.specialMessage) return false;
    
    if (this.currentTheme.name === 'romantic') {
      return this.finalWinner === 'bordeaux'; // Si Maria (Vienne) perd
    }
    
    if (this.currentTheme.name === 'tunisia-france') {
      return this.finalWinner === 'france'; // Si Sarra (Tunisie) perd
    }
    
    return false;
  }

  private showError(message: string) {
    this.errorMessage = message;
    setTimeout(() => {
      this.errorMessage = '';
    }, 5000);
  }

  private clearError() {
    this.errorMessage = '';
  }
}
