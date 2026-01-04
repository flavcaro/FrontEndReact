import React, { useState, useCallback } from 'react';
import { push, ref, onValue } from "firebase/database";
import { db } from "../../firebase";
import { getColorForNickname } from "../../utils/nicknameUtils";

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
  const [players, setPlayers] = useState([]);

  // Get all players for color mapping - FIXED
  React.useEffect(() => {
    const playersRef = ref(db, `rooms/${roomId}/players`);
    const unsubscribe = onValue(playersRef, (snapshot) => {
      const data = snapshot.val() || {};
      setPlayers(Object.values(data));
    });
    return () => unsubscribe();
  }, [roomId]);

  const sendMessage = useCallback(async () => {
    if (!inputMessage.trim() || !gameState?.active) return;

    const msg = inputMessage.trim();
    const msgLower = msg.toLowerCase();
    const correctWord = gameState?.word?.toLowerCase();

    if (!isArtist && !hasGuessed && msgLower === correctWord) {
      await onGuessCorrect(nickname);
      setInputMessage("");
    } else {
      await push(ref(db, `rooms/${roomId}/chat`), {
        user: nickname,
        message: msg,
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
              <div 
                className="chat-user"
                style={{
                  color: getColorForNickname(msg.user, players)
                }}
              >
                {msg.user}
              </div>
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
