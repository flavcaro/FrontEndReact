/**
 * ============================================================================
 * useChat.js - Hook per Gestione Chat Realtime
 * ============================================================================
 * 
 * SCOPO:
 * Questo custom hook gestisce la chat in tempo reale durante le partite:
 * - Sincronizzazione messaggi con Firebase
 * - Rimozione duplicati consecutivi
 * - Auto-scroll ai nuovi messaggi
 * - Invio messaggi
 * 
 * FUNZIONAMENTO:
 * 1. Ascolta i messaggi da Firebase in tempo reale
 * 2. Ordina i messaggi per timestamp
 * 3. Rimuove messaggi duplicati (stesso utente, stesso testo, entro 2 secondi)
 * 4. Scrolla automaticamente alla fine quando arrivano nuovi messaggi
 * 
 * USO:
 * const { messages, messagesEndRef, sendChatMessage } = useChat(roomId);
 */

import { useState, useEffect, useRef } from "react";
import { ref, push, onValue } from "firebase/database";
import { db } from "../firebase";

export function useChat(roomId) {
  // ============================================================================
  // STATO LOCALE
  // ============================================================================

  // Array di messaggi della chat
  // Ogni messaggio ha: { id, user, message, timestamp, isSystem? }
  const [messages, setMessages] = useState([]);

  // Riferimento all'elemento DOM alla fine della lista messaggi
  // Usato per lo scroll automatico quando arrivano nuovi messaggi
  const messagesEndRef = useRef(null);

  // ============================================================================
  // EFFECT: SINCRONIZZAZIONE MESSAGGI DA FIREBASE
  // ============================================================================
  // Questo useEffect crea un listener in tempo reale sui messaggi della chat.
  // Ogni volta che un giocatore invia un messaggio, tutti i client ricevono
  // l'aggiornamento automaticamente.

  useEffect(() => {
    // Crea riferimento al percorso Firebase: rooms/{roomId}/chat
    const chatRef = ref(db, `rooms/${roomId}/chat`);

    // onValue si attiva ogni volta che i dati cambiano
    const unsubscribe = onValue(chatRef, (snapshot) => {
      try {
        // Ottieni i dati dal database (oggetto con chiavi casuali)
        const data = snapshot.val() || {};

        // --- CONVERSIONE IN ARRAY ---
        // Firebase salva i messaggi come oggetto: { "-N1a2b3c4": { user: "Mario", ... }, ... }
        // Convertiamo in array per facilitare l'ordinamento e il rendering
        const msgs = Object.entries(data)
          .map(([id, value]) => ({ id, ...value }))  // Aggiungi l'id come proprietà
          .sort((a, b) => a.timestamp - b.timestamp);  // Ordina per timestamp (più vecchio → più recente)

        // --- RIMOZIONE DUPLICATI CONSECUTIVI ---
        // A volte Firebase può salvare lo stesso messaggio due volte per problemi di rete.
        // Rimuoviamo i duplicati consecutivi (stesso utente, stesso messaggio, entro 2 secondi)
        const deduped = [];
        for (const m of msgs) {
          const prev = deduped[deduped.length - 1];  // Ultimo messaggio aggiunto

          // Controlla se il messaggio corrente è un duplicato del precedente
          if (
            prev &&                                    // C'è un messaggio precedente
            prev.user === m.user &&                    // Stesso utente
            prev.message === m.message &&              // Stesso testo
            typeof prev.timestamp === 'number' &&      // Timestamp valido
            typeof m.timestamp === 'number' &&
            Math.abs(m.timestamp - prev.timestamp) < 2000  // Entro 2 secondi
          ) {
            // È un duplicato → salta questo messaggio
            continue;
          }

          // Non è un duplicato → aggiungilo
          deduped.push(m);
        }

        // Aggiorna lo stato con i messaggi deduplica
        ti
        setMessages(deduped);

        // --- AUTO-SCROLL ---
        // Scrolla automaticamente alla fine della chat dopo un piccolo delay
        // Il delay (100ms) dà tempo al DOM di aggiornarsi prima di scrollare
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);

      } catch (error) {
        // Logga errori ma non bloccare l'applicazione
        console.error('Error in chat listener:', error);
      }
    });

    // CLEANUP: rimuovi il listener quando il componente viene smontato
    // o quando cambia roomId
    return unsubscribe;
  }, [roomId]);  // Dipendenza: ri-esegui quando cambia la stanza

  // ============================================================================
  // FUNZIONE: INVIO MESSAGGIO
  // ============================================================================
  /**
   * Invia un messaggio alla chat.
   * Il messaggio viene salvato in Firebase e tutti i client lo riceveranno
   * automaticamente tramite il listener sopra.
   * 
   * @param {Object} message - Oggetto messaggio con { user, message, timestamp, isSystem? }
   */
  const sendChatMessage = async (message) => {
    // push() aggiunge un nuovo elemento con chiave auto-generata
    // Esempio: rooms/ABC123/chat/-N1a2b3c4 = { user: "Mario", message: "Ciao!", ... }
    await push(ref(db, `rooms/${roomId}/chat`), message);
  };

  // ============================================================================
  // RETURN - ESPOSIZIONE DATI E FUNZIONI
  // ============================================================================

  return {
    messages,           // Array di messaggi ordinati e deduplicati
    messagesEndRef,     // Ref per auto-scroll (da assegnare a un <div> alla fine della lista)
    sendChatMessage     // Funzione per inviare un nuovo messaggio
  };
}
