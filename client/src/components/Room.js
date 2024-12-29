import React, { useEffect, useRef, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import io from 'socket.io-client';
import Peer from 'simple-peer';

const RoomContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #1a1a1a;
  color: white;
`;

const Controls = styled.div`
  display: flex;
  justify-content: center;
  gap: 20px;
  padding: 20px;
  background-color: #2a2a2a;
`;

const Button = styled.button`
  padding: 10px 20px;
  border-radius: 4px;
  border: none;
  background-color: ${props => props.active ? '#5865F2' : '#4a4a4a'};
  color: white;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background-color: ${props => props.active ? '#4752c4' : '#3a3a3a'};
  }
`;

const ParticipantsList = styled.div`
  padding: 20px;
  background-color: #2a2a2a;
  width: 200px;
  border-radius: 8px;
  margin: 20px;

  h3 {
    margin-bottom: 15px;
    border-bottom: 1px solid #3a3a3a;
    padding-bottom: 10px;
  }

  ul {
    list-style: none;
    
    li {
      padding: 8px 0;
      border-bottom: 1px solid #3a3a3a;
      
      &:last-child {
        border-bottom: none;
      }
    }
  }
`;

const MainContent = styled.div`
  display: flex;
  flex: 1;
`;

const StatusMessage = styled.div`
  position: fixed;
  top: 20px;
  right: 20px;
  background-color: #2a2a2a;
  padding: 10px 20px;
  border-radius: 4px;
  animation: fadeOut 3s forwards;

  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }
`;

const Room = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [participants, setParticipants] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  
  const socketRef = useRef();
  const userAudioRef = useRef();
  const peersRef = useRef([]);
  const streamRef = useRef();
  const screenStreamRef = useRef();

  const showStatus = (message) => {
    setStatusMessage(message);
    setTimeout(() => setStatusMessage(''), 3000);
  };

  useEffect(() => {
    if (!location.state?.username) {
      navigate('/');
      return;
    }

    // Render.com'dan alınan URL buraya eklenecek
    socketRef.current = io('https://your-render-app.onrender.com');

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        streamRef.current = stream;
        userAudioRef.current.srcObject = stream;
        
        socketRef.current.emit('join-room', {
          roomId,
          username: location.state.username
        });

        socketRef.current.on('existing-users', users => {
          users.forEach(user => {
            if (user.userId !== socketRef.current.id) {
              const peer = createPeer(user.userId, socketRef.current.id, stream);
              peersRef.current.push({
                peerId: user.userId,
                peer,
                username: user.username
              });
            }
          });
          setParticipants(users.filter(user => user.userId !== socketRef.current.id));
        });

        socketRef.current.on('user-connected', ({ userId, username }) => {
          showStatus(`${username} odaya katıldı`);
          const peer = createPeer(userId, socketRef.current.id, stream);
          peersRef.current.push({ peerId: userId, peer, username });
          setParticipants(prev => [...prev, { id: userId, username }]);
        });

        socketRef.current.on('signal', ({ userId, signal }) => {
          const item = peersRef.current.find(p => p.peerId === userId);
          if (item) {
            item.peer.signal(signal);
          }
        });

        socketRef.current.on('user-disconnected', userId => {
          const peerObj = peersRef.current.find(p => p.peerId === userId);
          if (peerObj) {
            showStatus(`${peerObj.username} odadan ayrıldı`);
            peerObj.peer.destroy();
          }
          peersRef.current = peersRef.current.filter(p => p.peerId !== userId);
          setParticipants(prev => prev.filter(p => p.id !== userId));
        });
      })
      .catch(error => {
        console.error('Mikrofon erişim hatası:', error);
        showStatus('Mikrofon erişimi reddedildi');
      });

    return () => {
      socketRef.current?.disconnect();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }
      peersRef.current.forEach(({ peer }) => peer.destroy());
    };
  }, [roomId, location.state, navigate]);

  const createPeer = (userId, myId, stream) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream
    });

    peer.on('signal', signal => {
      socketRef.current.emit('signal', { userId, signal });
    });

    peer.on('stream', stream => {
      // Yeni ses akışını ekle
      const audio = document.createElement('audio');
      audio.srcObject = stream;
      audio.id = `audio-${userId}`;
      audio.autoplay = true;
      document.body.appendChild(audio);
    });

    return peer;
  };

  const toggleMute = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
      showStatus(isMuted ? 'Ses açıldı' : 'Ses kapatıldı');
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          cursor: true
        });
        
        screenStreamRef.current = screenStream;
        
        // Ekran paylaşımını diğer kullanıcılara gönder
        peersRef.current.forEach(({ peer }) => {
          peer.replaceTrack(
            streamRef.current.getVideoTracks()[0],
            screenStream.getVideoTracks()[0],
            streamRef.current
          );
        });

        screenStream.getVideoTracks()[0].onended = () => {
          stopScreenSharing();
        };

        setIsScreenSharing(true);
        showStatus('Ekran paylaşımı başladı');
      } catch (err) {
        console.error('Ekran paylaşımı hatası:', err);
        showStatus('Ekran paylaşımı başlatılamadı');
      }
    } else {
      stopScreenSharing();
    }
  };

  const stopScreenSharing = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);
    showStatus('Ekran paylaşımı durduruldu');
  };

  const handleLeaveRoom = () => {
    if (window.confirm('Odadan ayrılmak istediğinize emin misiniz?')) {
      navigate('/');
    }
  };

  return (
    <RoomContainer>
      <Controls>
        <Button onClick={toggleMute} active={!isMuted}>
          {isMuted ? 'Sesi Aç' : 'Sesi Kapat'}
        </Button>
        <Button onClick={toggleScreenShare} active={isScreenSharing}>
          {isScreenSharing ? 'Paylaşımı Durdur' : 'Ekran Paylaş'}
        </Button>
        <Button onClick={handleLeaveRoom}>
          Odadan Ayrıl
        </Button>
      </Controls>
      <MainContent>
        <ParticipantsList>
          <h3>Katılımcılar ({participants.length + 1})</h3>
          <ul>
            <li>{location.state?.username} (Sen){isMuted && ' 🔇'}</li>
            {participants.map(p => (
              <li key={p.id}>{p.username}</li>
            ))}
          </ul>
        </ParticipantsList>
        <audio ref={userAudioRef} autoPlay muted />
      </MainContent>
      {statusMessage && <StatusMessage>{statusMessage}</StatusMessage>}
    </RoomContainer>
  );
};

export default Room;