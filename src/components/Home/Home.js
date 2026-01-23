import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";
import { useUserData } from "../../hooks/useUserData";
import Button from "../common/Button";
import Input from "../common/Input";
import {
generateRoomCode,
validateNickname,
extractRoomCode,
} from "../../utils/roomUtils";
import { CLASSICA } from "../../constants/gameModes/classica";
import { SOPRAVVIVENZA } from "../../constants/gameModes/sopravvivenza";
import { CHAOS_TOOLS } from "../../constants/gameModes/chaosTools";


import "../../styles/home.css";


export default function Home() {
const navigate = useNavigate();
const { nickname, setNickname, user, isGuest } = useUserData();
const [joinCode, setJoinCode] = useState("");


const handleLogout = async () => {
await signOut(auth);
localStorage.removeItem("nickname");
navigate("/");
};


const handleQuickCreateRoom = (gameMode) => {
if (!validateNickname(nickname)) {
alert("Inserisci un nickname valido");
return;
}
const roomId = generateRoomCode();
localStorage.setItem("nickname", nickname);
// Passa la modalità di gioco come parametro nell'URL
navigate(`/room/${roomId}?mode=${gameMode.id}&rounds=3`);
};


const handleJoinRoom = () => {
const code = extractRoomCode(joinCode);
if (!code) {
alert("Codice stanza non valido");
return;
}
localStorage.setItem("nickname", nickname);
navigate(`/room/${code}`);
};


return (
<div className="home">
<header className="home-header">
<div className="logo">🎨 SketchUp</div>
{user && (
<div className="header-right">
<span className="user-name">{user.email}</span>
<button className="logout-btn" onClick={handleLogout}>Logout</button>
</div>
)}
</header>


{/* HERO FULL-PAGE CON ILLUSTRATION */}
<section className="hero-section">

<div className="hero-layout">
{/* LATO SINISTRO - LOGO + TESTO DESCRITTIVO */}

<div className="hero-text-side">
  <div className="hero-illustration">
<div className="main-emoji">🎨</div>
<div className="floating-elements">
<div className="float-1">🖌️</div>
<div className="float-2">✏️</div>
<div className="float-3">🎯</div>
<div className="float-4">🏆</div>
</div>
</div>
<div className="hero-content">
<h1>Il gioco di disegno dove indovini le parole</h1>
<p>Un giocatore disegna, gli altri indovinano. Divertente e creativo!</p>
</div>
</div>

{/* LATO DESTRO - SOLO BOTTONI RAPIDI */}
<div className="hero-actions-side">
<div className="quick-create-section">
<h2 className="quick-create-title">🎮 Scegli la tua modalità</h2>
<p className="quick-create-subtitle">Clicca su una modalità per creare una stanza!</p>

<div className="quick-buttons-grid">
<div className="quick-button-card" onClick={() => handleQuickCreateRoom(CLASSICA)}>
<div className="quick-button-icon">{CLASSICA.icon}</div>
<div className="quick-button-content">
<h3>{CLASSICA.name}</h3>
<p>60 secondi • 3 round</p>
</div>
</div>

<div className="quick-button-card" onClick={() => handleQuickCreateRoom(SOPRAVVIVENZA)}>
<div className="quick-button-icon">{SOPRAVVIVENZA.icon}</div>
<div className="quick-button-content">
<h3>{SOPRAVVIVENZA.name}</h3>
<p>30 secondi • 3 round</p>
</div>
</div>

<div className="quick-button-card" onClick={() => handleQuickCreateRoom(CHAOS_TOOLS)}>
<div className="quick-button-icon">{CHAOS_TOOLS.icon}</div>
<div className="quick-button-content">
<h3>{CHAOS_TOOLS.name}</h3>
<p>45 secondi • 3 round</p>
</div>
</div>
</div>
</div>
</div>
</div>
</section>

{/* JOIN SECTION SEPARATA */}
<section className="join-section">
<div className="join-container">
<div className="join-card">
<h3>Unisciti a una stanza esistente</h3>
<p className="join-subtitle">Hai ricevuto un codice? Inseriscilo qui per giocare con i tuoi amici!</p>
<div className="join-inputs">
<Input
placeholder="Inserisci codice stanza"
value={joinCode}
onChange={(e) => setJoinCode(e.target.value)}
/>
<Button variant="secondary" onClick={handleJoinRoom}>
🔗 Unisciti
</Button>
</div>
</div>
</div>
</section>

{/* NICKNAME DISCRETO IN BASSO */}
<section className="nickname-section">
<div className="nickname-card">
<div className="nickname-header">Il tuo nickname</div>
<div className="nickname-inputs">
<Input
value={nickname}
onChange={(e) => setNickname(e.target.value)}
maxLength={15}
placeholder="Come vuoi chiamarti?"
/>
<Button variant="tertiary" size="small" onClick={() => localStorage.setItem('nickname', nickname)}>
💾 Salva
</Button>
</div>

{isGuest && (
<div className="guest-badge">
Giocando come ospite
</div>
)}
</div>
</section>

{/* BACKGROUND ANIMATO */}
<div className="bg-elements">
<div className="bg-shape shape-1"></div>
<div className="bg-shape shape-2"></div>
<div className="bg-shape shape-3"></div>
</div>
</div>
);
}