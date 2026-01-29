import React, { useEffect, useState } from "react";
import { subscribeLeaderboard } from "../../services/userService";
import { ref, get } from "firebase/database";
import { db } from "../../firebase";
import { useUserData } from "../../hooks/useUserData";

export default function Leaderboard({ show, onClose, limit = 20 }) {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState([]);
  const { user, nickname } = useUserData();

  useEffect(() => {
    if (!show) return;
    let mounted = true;
    setLoading(true);
    const unsub = subscribeLeaderboard(async (list) => {
      if (!mounted) return;
      // attempt to enrich list entries with latest nickname from users/{uid}
      try {
        const uids = Array.from(new Set(list.map(u => u.uid).filter(Boolean)));
        const userFetches = uids.map(async (uid) => {
          try {
            const snap = await get(ref(db, `users/${uid}`));
            return [uid, snap.val() || null];
          } catch (err) {
            console.warn('Could not fetch user data for', uid, err);
            return [uid, null];
          }
        });
        const fetched = await Promise.all(userFetches);
        const usersMap = Object.fromEntries(fetched);
        const merged = list.map((u) => {
          if (u.uid && usersMap[u.uid]) {
            const data = usersMap[u.uid] || {};
            return { ...u, nickname: data.nickname || u.nickname, displayName: data.displayName || u.displayName, level: data.level || u.level, xpPoints: data.xpPoints || u.xpPoints, gamesPlayed: data.gamesPlayed || u.gamesPlayed, wins: data.wins || u.wins };
          }
          return u;
        });
        if (!mounted) return;
        setList(merged);
      } catch (err) {
        console.warn('Error enriching leaderboard list', err);
        if (!mounted) return;
        setList(list);
      } finally {
        if (mounted) setLoading(false);
      }
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
              {(() => {
                // find current user's index by uid (preferred) or by nickname
                const foundIndex = list.findIndex((u) => (user && u.uid && user.uid && u.uid === user.uid) || (nickname && (u.nickname === nickname || u.email === nickname || u.displayName === nickname)));
                let displayRange = [];
                if (foundIndex !== -1) {
                  const start = Math.max(0, foundIndex - 1);
                  const end = Math.min(list.length - 1, foundIndex + 1);
                  for (let i = start; i <= end; i++) displayRange.push({ item: list[i], index: i });
                } else {
                  // if user not found, show top 3 as fallback
                  for (let i = 0; i < Math.min(3, list.length); i++) displayRange.push({ item: list[i], index: i });
                }
                return displayRange.map(({ item: u, index: idx }) => {
                  const isCurrent = (foundIndex !== -1 && idx === foundIndex);
                  return (
                    <li key={u.uid || idx} className={`leader-row ${isCurrent ? 'current' : ''}`} aria-current={isCurrent ? 'true' : 'false'} style={{ listStyle: 'none', marginBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="leader-left">
                          <div className={`leader-avatar`}>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : (idx === 3 ? '🏅' : (idx+1))}</div>
                          <div>
                            <div className="leader-name">{u.nickname || u.email || u.displayName || `Utente-${(u.uid || '').slice(0,6)}`}</div>
                            <div className="leader-meta">Lv.{u.level || 1} • {u.gamesPlayed || 0} partite</div>
                          </div>
                        </div>
                        <div className="leader-score">⭐ {u.totalScore || 0}</div>
                      </div>
                    </li>
                  );
                });
              })()}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
