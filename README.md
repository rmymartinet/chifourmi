# 🎮 Chifourmi : Bordeaux vs Vienne

Une application de pierre-papier-ciseaux en temps réel entre Bordeaux et Vienne ! Le perdant va visiter la ville du gagnant ! 🍷 ⚔️ 🎼

## 🎯 Le Défi

- **Bordeaux** 🍷 vs **Vienne** 🎼
- Premier à **3 manches gagnées** remporte la partie
- Le **perdant voyage** dans la ville du gagnant !

## 🛠️ Technologies

- **Frontend** : Angular 18 + Tailwind CSS
- **Backend** : Node.js + Express + Socket.io
- **Communication** : WebSocket temps réel

## 🚀 Installation et Démarrage

### 1. Installer les dépendances du serveur
```bash
cd server
npm install
```

### 2. Installer les dépendances d'Angular
```bash
cd chifourmi-app
npm install
```

### 3. Démarrer le serveur backend
```bash
cd server
npm start
# Ou pour le développement avec auto-reload :
npm run dev
```

### 4. Démarrer l'application Angular
```bash
cd chifourmi-app
ng serve
```

## 🌐 Accès à l'application

- **Frontend Angular** : http://localhost:4200
- **Serveur WebSocket** : http://localhost:3001
- **Health Check** : http://localhost:3001/health

## 🎯 Comment jouer

1. **Connexion** : Entrez votre nom et choisissez votre ville (Bordeaux ou Vienne)
2. **Attendez** votre adversaire qui doit choisir l'autre ville
3. **Jouez** : Choisissez pierre 🪨, papier 📄 ou ciseaux ✂️
4. **Gagnez** : Premier à 3 manches remporte la partie !
5. **Voyage** : Le perdant va visiter la ville du gagnant ! 

## 🎨 Fonctionnalités

- ⚡ **Temps réel** : Jeu instantané avec WebSocket
- 🎨 **Interface moderne** : Design responsive avec Tailwind CSS
- 🏆 **Système de scores** : Suivi des manches et scores
- 🎯 **Enjeu amusant** : Voyage dans la ville du gagnant
- 🔄 **Parties multiples** : Bouton "Nouvelle partie"
- 📱 **Responsive** : Fonctionne sur mobile et desktop

## 🎭 Règles du jeu

- Pierre 🪨 bat Ciseaux ✂️
- Papier 📄 bat Pierre 🪨  
- Ciseaux ✂️ bat Papier 📄
- Égalité = manche nulle

## 🎊 Résultat final

- **Bordeaux gagne** → Direction Vienne ! 🎼
- **Vienne gagne** → Direction Bordeaux ! 🍷
- **Égalité** → Personne ne voyage ! 🤝

Amusez-vous bien ! 🎉 