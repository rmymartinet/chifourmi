import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { io, Socket } from 'socket.io-client';
import { environment } from '../environments/environment';

interface Player {
  id: string;
  name: string;
  city: 'bordeaux' | 'vienne';
}

interface GameState {
  players: { [socketId: string]: Player };
  currentRound: number;
  maxRounds: number;
  scores: { bordeaux: number; vienne: number };
  roundInProgress: boolean;
  choices: { [socketId: string]: string };
  winner: string | null;
}

interface RoundResult {
  round: number;
  choices: {
    bordeaux?: { player: string; choice: string };
    vienne?: { player: string; choice: string };
  };
  winner: string;
  scores: { bordeaux: number; vienne: number };
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
  selectedCity: 'bordeaux' | 'vienne' | '' = '';
  playerId = '';
  
  // État du jeu
  players: { bordeaux?: Player; vienne?: Player } = {};
  scores = { bordeaux: 0, vienne: 0 };
  currentRound = 0;
  gameFinished = false;
  finalWinner = '';
  
  // État de la manche
  roundWinner = '';
  lastRoundResult: RoundResult | null = null;
  waitingChoices = { bordeaux: false, vienne: false };
  
  constructor(private cdr: ChangeDetectorRef) {
    this.socket = io(environment.socketUrl);
    console.log('🔌 Connecting to:', environment.socketUrl);
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
      console.log('✅ Connecté au serveur WebSocket');
      // Reset connection state si on était en train de se connecter
      if (this.isConnecting) {
        console.log('🔄 Réinitialisation état de connexion');
      }
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      console.log('Déconnecté du serveur');
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
      this.waitingChoices[data.city as 'bordeaux' | 'vienne'] = true;
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

  private getPlayerCity(): 'bordeaux' | 'vienne' | null {
    if (this.players.bordeaux?.id === this.playerId) return 'bordeaux';
    if (this.players.vienne?.id === this.playerId) return 'vienne';
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
