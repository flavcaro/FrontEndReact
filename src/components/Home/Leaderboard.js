import React, { useEffect, useState } from "react";
import { subscribeLeaderboard } from "../../services/userService";

export default function Leaderboard({ show, onClose, limit = 20 }) {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState([]);

  useEffect(() => {
    if (!show) return;
    let mounted = true;
    setLoading(true);
    const unsub = subscribeLeaderboard((list) => {
      if (!mounted) return;
      setList(list);
      setLoading(false);
    }, limit, 'totalScore');
    return () => {
      mounted = false;
      if (typeof unsub === 'function') unsub();
    };
  }, [show, limit]);

  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="modal-illustration">🏆</div>
            <div>
              <h2>Classifica Globale</h2>
              <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Top utenti per punteggio totale</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div>Caricamento...</div>
          ) : list.length === 0 ? (
            <div>Nessun dato disponibile</div>
          ) : (
            <ol className="leaderboard-list" style={{ padding: 0, margin: 0 }}>
              {list.map((u, idx) => (
                <li key={u.uid || idx} style={{ listStyle: 'none', marginBottom: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="leader-left">
                      <div className={`leader-avatar`}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : (idx === 3 ? '🏅' : (idx+1))}</div>
                      <div>
                        <div className="leader-name">{u.email || u.displayName || `Utente-${(u.uid || '').slice(0,6)}`}</div>
                        <div className="leader-meta">Lv.{u.level || 1} • {u.gamesPlayed || 0} partite</div>
                      </div>
                    </div>
                    <div className="leader-score">⭐ {u.totalScore || 0}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
