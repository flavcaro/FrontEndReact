const fs = require('fs');
const path = 'c:\\Users\\flavi\\Downloads\\sketchandguess-959e6-default-rtdb-rooms-export.json';
const raw = fs.readFileSync(path, 'utf8');
const data = JSON.parse(raw);
const results = [];
for (const [roomId, node] of Object.entries(data)) {
  const keys = Object.keys(node || {});
  const hasOwner = keys.includes('owner');
  const hasChat = keys.includes('chat');
  const hasGame = keys.includes('game');
  const hasPlayers = keys.includes('players');
  if (hasOwner && hasChat && !hasGame && !hasPlayers) {
    results.push({ roomId, keys });
  }
}
console.log('Found', results.length, 'rooms with only chat+owner');
results.slice(0,50).forEach(r => console.log(r.roomId, r.keys.join(',')));
