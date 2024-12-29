const express = require('express');
const http = require('http');
const cors = require('cors');
const socketIO = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: "*"
}));

const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('Yeni kullanıcı bağlandı:', socket.id);

  socket.on('join-room', ({ roomId, username }) => {
    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }
    
    const roomUsers = rooms.get(roomId);
    roomUsers.set(socket.id, username);

    // Yeni kullanıcıya mevcut kullanıcıları gönder
    const existingUsers = Array.from(roomUsers).map(([id, name]) => ({
      userId: id,
      username: name
    }));
    socket.emit('existing-users', existingUsers);

    // Diğer kullanıcılara yeni kullanıcıyı bildir
    socket.to(roomId).emit('user-connected', {
      userId: socket.id,
      username
    });

    // Sinyal verilerini ilet
    socket.on('signal', ({ userId, signal }) => {
      io.to(userId).emit('signal', {
        userId: socket.id,
        signal
      });
    });
  });

  socket.on('disconnect', () => {
    rooms.forEach((users, roomId) => {
      if (users.has(socket.id)) {
        users.delete(socket.id);
        io.to(roomId).emit('user-disconnected', socket.id);
        
        if (users.size === 0) {
          rooms.delete(roomId);
        }
      }
    });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server ${PORT} portunda çalışıyor`);
});