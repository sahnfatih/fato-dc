const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('Kullanıcı bağlandı:', socket.id);

  socket.on('join-room', ({ roomId, username }) => {
    socket.join(roomId);
    
    // Odadaki mevcut kullanıcıları al
    const room = rooms.get(roomId) || new Map();
    room.set(socket.id, { username });
    rooms.set(roomId, room);

    // Yeni kullanıcıyı diğerlerine bildir
    socket.to(roomId).emit('user-connected', {
      userId: socket.id,
      username
    });

    // Mevcut kullanıcıları yeni kullanıcıya gönder
    const users = Array.from(room.entries()).map(([userId, data]) => ({
      userId,
      username: data.username
    }));
    socket.emit('existing-users', users);
  });

  // Sinyal iletimi
  socket.on('signal', ({ userId, signal }) => {
    io.to(userId).emit('signal', {
      userId: socket.id,
      signal
    });
  });

  // Ekran paylaşımı başlatma
  socket.on('screen-share-started', ({ roomId }) => {
    socket.to(roomId).emit('user-screen-share-started', {
      userId: socket.id
    });
  });

  // Ekran paylaşımı durdurma
  socket.on('screen-share-ended', ({ roomId }) => {
    socket.to(roomId).emit('user-screen-share-ended', {
      userId: socket.id
    });
  });
// Ekran paylaşımı başladığında
socket.on('screen-share-started', ({ roomId, stream }) => {
  socket.to(roomId).emit('user-screen-share', stream);
});

// Ekran paylaşımı bittiğinde
socket.on('screen-share-ended', ({ roomId }) => {
  socket.to(roomId).emit('user-screen-share-ended');
});
  // Bağlantı koptuğunda
  socket.on('disconnect', () => {
    console.log('Kullanıcı ayrıldı:', socket.id);
    
    // Kullanıcıyı tüm odalardan çıkar
    rooms.forEach((room, roomId) => {
      if (room.has(socket.id)) {
        room.delete(socket.id);
        if (room.size === 0) {
          rooms.delete(roomId);
        }
        socket.to(roomId).emit('user-disconnected', socket.id);
      }
    });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server ${PORT} portunda çalışıyor`);
});