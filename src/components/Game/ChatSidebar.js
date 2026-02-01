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
  timeLeft,
  isArtist,
  hasGuessed,
  onGuessCorrect,
  style,
  className,
  isMobile
}) {
  const [inputMessage, setInputMessage] = useState("");
  const [players, setPlayers] = useState([]);

  // Get all players for color mapping
  React.useEffect(() => {
    const playersRef = ref(db, `rooms/${roomId}/players`);
    const unsubscribe = onValue(playersRef, (snapshot) => {
      try {
        const data = snapshot.val() || {};
        setPlayers(Object.values(data));
      } catch (error) {
        console.error('Error in chat sidebar players listener:', error);
      }
    });
    return () => unsubscribe();
  }, [roomId]);

  const sendMessage = useCallback(async () => {
    if (!inputMessage.trim() || !gameState?.active || (typeof timeLeft === 'number' && timeLeft <= 0)) return;

    const msg = inputMessage.trim();
    const msgLower = msg.toLowerCase();
    const correctWord = gameState?.word?.toLowerCase();

    // Controlla se il giocatore può indovinare e se ha indovinato correttamente
    if (!isArtist && !hasGuessed && msgLower === correctWord) {
      // Notify guess handler with the player's nickname (not the guessed word)
      await onGuessCorrect(nickname);
      setInputMessage("");
    } else {
      // Invia il messaggio normale in chat
      console.log('[ChatSidebar] sending chat message', { roomId, user: nickname, message: msg });
      await push(ref(db, `rooms/${roomId}/chat`), {
        user: nickname,
        message: msg,
        timestamp: Date.now(),
        isSystem: false,
        isCorrect: false
      });
      setInputMessage("");
    }
  }, [inputMessage, gameState, isArtist, hasGuessed, nickname, roomId, onGuessCorrect, timeLeft]);

  // Helper function to determine message style based on type
  const getMessageStyle = (msg) => {
    if (msg.isSystem) {
      // Disegnatori - punti condivisi (stile blu)
      // Match both explicit "Disegnatori" messages and messages like "🎨 <name> riceve X punti!"
      if ((msg.message.includes('Disegnatori') && msg.message.includes('punti')) || (msg.message.includes('riceve') && msg.message.includes('punti')) || (msg.message.includes('🎨') && msg.message.includes('punti'))) {
        return {
          background: '#e0f2fe',
          borderLeft: '3px solid #0284c7',
          color: '#075985',
          fontWeight: 600
        };
      }
      // Player joined message
      if (msg.message.includes('è entrato') || msg.message.includes('👋')) {
        return {
          background: '#dbeafe',
          borderLeft: '3px solid #3b82f6',
          color: '#1e40af',
          fontWeight: 600
        };
      }
      // Player left message
      if (msg.message.includes('ha abbandonato') || msg.message.includes('🚪')) {
        return {
          background: '#fee2e2',
          borderLeft: '3px solid #ef4444',
          color: '#991b1b',
          fontWeight: 600
        };
      }
      // Correct guess messages
      if (msg.message.includes('ha indovinato') || msg.message.includes('✅')) {
        return {
          background: '#dcfce7',
          borderLeft: '3px solid #22c55e',
          color: '#166534',
          fontWeight: 600
        };
      }
      // Time expired messages
      if (msg.message.includes('Tempo scaduto') || msg.message.includes('⏰')) {
        return {
          background: '#fee2e2',
          borderLeft: '3px solid #ef4444',
          color: '#991b1b',
          fontWeight: 600
        };
      }
      // Game start/turn messages
      if (msg.message.includes('Partita iniziata') || msg.message.includes('🎮') || msg.message.includes('sta disegnando')) {
        return {
          background: '#dbeafe',
          borderLeft: '3px solid #3b82f6',
          color: '#1e40af',
          fontWeight: 600
        };
      }
      // Round end messages
      if (msg.message.includes('Fine turno') || msg.message.includes('📊')) {
        return {
          background: '#fef3c7',
          borderLeft: '3px solid #f59e0b',
          color: '#92400e',
          fontWeight: 600
        };
      }
      // Game end messages
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
    <aside className={`chat-sidebar ${className || ''}`} style={style}>
      {!isMobile && (
        <div className="sidebar-header">
          <h3>💬 Chat</h3>
        </div>
      )}

      <div className="chat-messages">
        {messages.map((msg) => {
          const messageStyle = getMessageStyle(msg);
          const classNames = `chat-message ${msg.isSystem ? 'system' : ''}`;

          return (
            <div
              key={msg.id}
              className={classNames}
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
            (typeof timeLeft === 'number' && timeLeft <= 0)
              ? "Tempo scaduto"
              : isArtist
                ? "Stai disegnando..."
                : hasGuessed
                  ? "Hai già indovinato!"
                  : "Scrivi la tua risposta..."
          }
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          disabled={!gameState?.active || isArtist || hasGuessed || (typeof timeLeft === 'number' && timeLeft <= 0)}
        />
        <button
          onClick={sendMessage}
          disabled={!gameState?.active || isArtist || hasGuessed || (typeof timeLeft === 'number' && timeLeft <= 0)}
        >
          ➤
        </button>
      </div>
    </aside>
  );
}
