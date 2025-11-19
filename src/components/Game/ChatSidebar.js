import React, { useState, useCallback } from 'react';
import { push } from "firebase/database";
import { ref } from "firebase/database";
import { db } from "../../firebase";

export default function ChatSidebar({ 
  roomId, 
  nickname, 
  messages, 
  messagesEndRef, 
  gameState, 
  isArtist, 
  hasGuessed,
  onGuessCorrect
}) {
  const [inputMessage, setInputMessage] = useState("");

  const sendMessage = useCallback(async () => {
    if (!inputMessage.trim() || !gameState?.active) return;

    const msg = inputMessage.trim();
    const msgLower = msg.toLowerCase();
    const correctWord = gameState?.word?.toLowerCase();

    // 🎯 Controllo risposta - PRIMA di inviare il messaggio
    if (!isArtist && !hasGuessed && msgLower === correctWord) {
      // Indovinato! Non inviare il messaggio in chat
      await onGuessCorrect(nickname);
      setInputMessage("");
    } else {
      // Messaggio normale (risposta sbagliata o chat normale)
      await push(ref(db, `rooms/${roomId}/chat`), {
        user: nickname,
        message: msg, // Usa il messaggio originale, non lowercase
        timestamp: Date.now(),
        isSystem: false
      });
      setInputMessage("");
    }
  }, [inputMessage, gameState, isArtist, hasGuessed, nickname, roomId, onGuessCorrect]);

  return (
    <aside className="chat-sidebar">
      <div className="sidebar-header">
        <h3>💬 Chat</h3>
      </div>

      <div className="chat-messages">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={msg.isSystem ? 'chat-message system' : 'chat-message'}
          >
            {!msg.isSystem && (
              <div className="chat-user">{msg.user}</div>
            )}
            <div className="chat-text">{msg.message}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input">
        <input
          type="text"
          placeholder={
            isArtist 
              ? "Stai disegnando..." 
              : hasGuessed 
                ? "Hai già indovinato!" 
                : "Scrivi la tua risposta..."
          }
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          disabled={!gameState?.active || isArtist || hasGuessed}
        />
        <button 
          onClick={sendMessage}
          disabled={!gameState?.active || isArtist || hasGuessed}
        >
          ➤
        </button>
      </div>
    </aside>
  );
}
