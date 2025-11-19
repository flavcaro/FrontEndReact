import { useState, useEffect, useRef } from "react";
import { ref, push, onValue } from "firebase/database";
import { db } from "../firebase";

export function useChat(roomId) {
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const chatRef = ref(db, `rooms/${roomId}/chat`);
    const unsubscribe = onValue(chatRef, (snapshot) => {
      const data = snapshot.val() || {};
      const msgs = Object.entries(data)
        .map(([id, value]) => ({ id, ...value }))
        .sort((a, b) => a.timestamp - b.timestamp);
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    return unsubscribe;
  }, [roomId]);

  const sendChatMessage = async (message) => {
    await push(ref(db, `rooms/${roomId}/chat`), message);
  };

  return { messages, messagesEndRef, sendChatMessage };
}
