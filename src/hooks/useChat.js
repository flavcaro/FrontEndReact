import { useState, useEffect, useRef } from "react";
import { ref, push, onValue } from "firebase/database";
import { db } from "../firebase";

export function useChat(roomId) {
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const chatRef = ref(db, `rooms/${roomId}/chat`);
    const unsubscribe = onValue(chatRef, (snapshot) => {
      try {
        const data = snapshot.val() || {};
        const msgs = Object.entries(data)
          .map(([id, value]) => ({ id, ...value }))
          .sort((a, b) => a.timestamp - b.timestamp);
        // Remove simple consecutive duplicates (same user + same message within short time)
        const deduped = [];
        for (const m of msgs) {
          const prev = deduped[deduped.length - 1];
          if (
            prev &&
            prev.user === m.user &&
            prev.message === m.message &&
            typeof prev.timestamp === 'number' &&
            typeof m.timestamp === 'number' &&
            Math.abs(m.timestamp - prev.timestamp) < 2000
          ) {
            // skip duplicate
            continue;
          }
          deduped.push(m);
        }

        setMessages(deduped);
        // Scroll dopo un piccolo delay per dare tempo al DOM
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      } catch (error) {
        console.error('Error in chat listener:', error);
      }
    });
    return unsubscribe;
  }, [roomId]);

  const sendChatMessage = async (message) => {
    await push(ref(db, `rooms/${roomId}/chat`), message);
  };

  return { messages, messagesEndRef, sendChatMessage };
}
