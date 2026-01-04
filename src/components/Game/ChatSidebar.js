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

  // Get all players for color mapping
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
        isSystem: false,
        isCorrect: false
      });
      setInputMessage("");
    }
  }, [inputMessage, gameState, isArtist, hasGuessed, nickname, roomId, onGuessCorrect]);

  // Helper function to determine message style based on type
  const getMessageStyle = (msg) => {
    if (msg.isSystem) {
      // System messages - check for special types
      if (msg.message.includes('ha indovinato') || msg.message.includes('✅')) {
        return {
          background: '#dcfce7',
          borderLeft: '3px solid #22c55e',
          color: '#166534',
          fontWeight: 600
        };
      }
      if (msg.message.includes('Tempo scaduto') || msg.message.includes('⏰')) {
        return {
          background: '#fee2e2',
          borderLeft: '3px solid #ef4444',
          color: '#991b1b',
          fontWeight: 600
        };
      }
      if (msg.message.includes('Partita iniziata') || msg.message.includes('🎮') || msg.message.includes('sta disegnando')) {
        return {
          background: '#dbeafe',
          borderLeft: '3px solid #3b82f6',
          color: '#1e40af',
          fontWeight: 600
        };
      }
      if (msg.message.includes('Fine turno') || msg.message.includes('📊')) {
        return {
          background: '#fef3c7',
          borderLeft: '3px solid #f59e0b',
          color: '#92400e',
          fontWeight: 600
        };
      }
      if (msg.message.includes('Partita terminata') || msg.message.includes('🎉')) {
        return {
          background: '#f3e8ff',
          borderLeft: '3px solid #a855f7',
          color: '#6b21a8',
          fontWeight: 600
        };
      }
      // Default system message
      return {
        background: '#fef3c7',
        borderLeft: '3px solid #f59e0b',
        color: '#92400e',
        fontWeight: 600
      };
    }

    // Regular player messages
    return {
      background: '#f8fafc',
      borderLeft: '3px solid #6366f1',
      color: '#334155',
      fontWeight: 'normal'
    };
  };

  return (
    <aside className="chat-sidebar">
      <div className="sidebar-header">
        <h3>💬 Chat</h3>
      </div>

      <div className="chat-messages">
        {messages.map((msg) => {
          const messageStyle = getMessageStyle(msg);
          
          return (
            <div 
              key={msg.id} 
              className="chat-message"
              style={messageStyle}
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
          );
        })}
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
