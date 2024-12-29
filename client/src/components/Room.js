import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import io from 'socket.io-client';
import Peer from 'simple-peer';

const RoomContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #1a1a1a;
  color: white;
`;

const Header = styled.header`
  background: rgba(0, 0, 0, 0.2);
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const MainContent = styled.main`
  flex: 1;
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 1rem;
  padding: 1rem;
  overflow: hidden;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const ParticipantsList = styled.div`
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 1rem;

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  li {
    padding: 0.5rem 0;
  }
`;

const ScreenShareContainer = styled.div`
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  
  video {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  p {
    color: rgba(255, 255, 255, 0.5);
  }
`;

const Controls = styled.div`
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.2);
  justify-content: center;
`;

const Button = styled.button`
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  background: ${props => props.active ? '#5865F2' : 'rgba(255, 255, 255, 0.1)'};
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover:not(:disabled) {
    background: ${props => props.active ? '#4752C4' : 'rgba(255, 255, 255, 0.2)'};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ConnectionStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  background: ${props => props.connected ? 'rgba(80, 200, 120, 0.2)' : 'rgba(255, 100, 100, 0.2)'};
  font-size: 0.9rem;

  span {
    color: ${props => props.connected ? '#50c878' : '#ff6464'};
  }
`;

const StatusMessage = styled.div`
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
`;



const Room = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // State tanımlamaları
  const [participants, setParticipants] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Ref tanımlamaları
  const socketRef = useRef();
  const peersRef = useRef([]);
  const streamRef = useRef();
  const screenStreamRef = useRef();
  const userAudioRef = useRef();
  const screenVideoRef = useRef();
  const statusTimeoutRef = useRef();

  // 1. Durum mesajı gösterme fonksiyonu
  const showStatus = useCallback((message, duration = 3000) => {
    setStatusMessage(message);
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
    }
    statusTimeoutRef.current = setTimeout(() => {
      setStatusMessage('');
    }, duration);
  }, []);

  // 2. Uzak stream'i işleme fonksiyonu
  const handleRemoteStream = useCallback((remoteStream) => {
    if (remoteStream.getVideoTracks().length > 0) {
      const videoElement = document.createElement('video');
      videoElement.srcObject = remoteStream;
      videoElement.autoplay = true;
      videoElement.playsInline = true;
      videoElement.style.width = '100%';
      videoElement.style.height = '100%';
      videoElement.style.objectFit = 'contain';

      if (screenVideoRef.current) {
        screenVideoRef.current.innerHTML = '';
        screenVideoRef.current.appendChild(videoElement);
      }
    }
  }, []);

  // 3. Peer oluşturma fonksiyonu
  const createPeer = useCallback((targetUserId, callerId, stream) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream
    });

    peer.on('signal', signal => {
      socketRef.current?.emit('signal', {
        userId: targetUserId,
        callerId,
        signal
      });
    });

    peer.on('stream', remoteStream => {
      handleRemoteStream(remoteStream);
    });

    return peer;
  }, [handleRemoteStream]);

  // 4. Ekran paylaşımını durdurma
  const stopScreenSharing = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      screenStreamRef.current = null;

      socketRef.current?.emit('screen-share-ended', { roomId });

      if (screenVideoRef.current) {
        screenVideoRef.current.innerHTML = '';
      }
      setIsScreenSharing(false);
      showStatus('Ekran paylaşımı durduruldu');
    }
  }, [roomId, showStatus]);

  // 5. Ekran paylaşımını başlatma/durdurma
  const toggleScreenShare = useCallback(async () => {
    if (!isScreenSharing) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: "always",
            displaySurface: "monitor"
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          }
        });

        screenStreamRef.current = stream;

        const videoElement = document.createElement('video');
        videoElement.srcObject = stream;
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
        videoElement.style.objectFit = 'contain';

        if (screenVideoRef.current) {
          screenVideoRef.current.innerHTML = '';
          screenVideoRef.current.appendChild(videoElement);
        }

        stream.getVideoTracks()[0].onended = () => {
          stopScreenSharing();
        };

        setIsScreenSharing(true);
        showStatus('Ekran paylaşımı başladı');

        socketRef.current?.emit('screen-share-started', { roomId, stream });
        
        peersRef.current.forEach(({ peer }) => {
          stream.getTracks().forEach(track => {
            peer.addTrack(track, stream);
          });
        });

      } catch (err) {
        console.error('Ekran paylaşımı hatası:', err);
        showStatus('Ekran paylaşımı başlatılamadı');
      }
    } else {
      stopScreenSharing();
    }
  }, [isScreenSharing, roomId, showStatus, stopScreenSharing]);

  // 6. Ses açma/kapama
  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
      showStatus(isMuted ? 'Mikrofon açıldı' : 'Mikrofon kapatıldı');
    }
  }, [isMuted, showStatus]);

  // 7. Odadan ayrılma
  const handleLeaveRoom = useCallback(() => {
    if (window.confirm('Odadan ayrılmak istediğinize emin misiniz?')) {
      stopScreenSharing();
      navigate('/');
    }
  }, [navigate, stopScreenSharing]);

  // 8. useEffect - Oda bağlantısı ve socket olayları
  useEffect(() => {
    if (!location.state?.username) {
      navigate('/');
      return;
    }

    socketRef.current = io(process.env.REACT_APP_SOCKET_URL);

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        streamRef.current = stream;
        userAudioRef.current.srcObject = stream;

        socketRef.current.emit('join-room', {
          roomId,
          username: location.state.username
        });

        socketRef.current.on('connect', () => {
          setIsConnected(true);
          showStatus('Bağlantı kuruldu');
        });

        socketRef.current.on('disconnect', () => {
          setIsConnected(false);
          showStatus('Bağlantı kesildi');
        });

        socketRef.current.on('user-connected', ({ userId, username }) => {
          showStatus(`${username} odaya katıldı`);
          const peer = createPeer(userId, socketRef.current.id, stream);
          peersRef.current.push({ userId, peer });
          setParticipants(prev => [...prev, { userId, username }]);
        });

        socketRef.current.on('user-disconnected', userId => {
          const participant = participants.find(p => p.userId === userId);
          if (participant) {
            showStatus(`${participant.username} odadan ayrıldı`);
          }
          
          peersRef.current = peersRef.current.filter(p => {
            if (p.userId === userId) {
              p.peer.destroy();
              return false;
            }
            return true;
          });
          
          setParticipants(prev => prev.filter(p => p.userId !== userId));
        });

        socketRef.current.on('signal', ({ userId, signal }) => {
          const item = peersRef.current.find(p => p.userId === userId);
          if (item) {
            item.peer.signal(signal);
          }
        });

        socketRef.current.on('user-screen-share', handleRemoteStream);
        socketRef.current.on('user-screen-share-ended', () => {
          if (screenVideoRef.current) {
            screenVideoRef.current.innerHTML = '';
          }
        });

        setIsLoading(false);
      })
      .catch(err => {
        console.error('Mikrofon hatası:', err);
        setError('Mikrofona erişilemedi. Lütfen mikrofon izinlerini kontrol edin.');
        setIsLoading(false);
      });

    return () => {
      socketRef.current?.disconnect();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      stopScreenSharing();
      peersRef.current.forEach(({ peer }) => peer.destroy());
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    };
  }, [roomId, location.state, navigate, showStatus, participants, createPeer, stopScreenSharing, handleRemoteStream]);

  // Render kısmı...
  if (isLoading) {
    return (
      <RoomContainer>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <p>Odaya bağlanılıyor...</p>
        </div>
      </RoomContainer>
    );
  }

  if (error) {
    return (
      <RoomContainer>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          gap: '20px'
        }}>
          <div style={{ color: '#ff4444' }}>{error}</div>
          <Button onClick={() => navigate('/')}>Ana Sayfaya Dön</Button>
        </div>
      </RoomContainer>
    );
  }

  return (
    <RoomContainer>
      <Header>
        <div>
          <h1>Oda: {roomId}</h1>
        </div>
        <ConnectionStatus connected={isConnected}>
          <span>●</span>
          {isConnected ? 'Bağlı' : 'Bağlantı Kesik'}
        </ConnectionStatus>
      </Header>

      <MainContent>
        <ParticipantsList>
          <h3>Katılımcılar ({participants.length + 1})</h3>
          <ul>
            <li>
              {location.state?.username} (Sen)
              {isMuted && <span> (Sessiz)</span>}
            </li>
            {participants.map(p => (
              <li key={p.userId}>{p.username}</li>
            ))}
          </ul>
        </ParticipantsList>

        <ScreenShareContainer ref={screenVideoRef}>
          {!isScreenSharing && !screenVideoRef.current?.hasChildNodes() && (
            <p>Henüz ekran paylaşımı yok</p>
          )}
        </ScreenShareContainer>
      </MainContent>

      <Controls>
        <Button onClick={toggleMute} active={!isMuted}>
          {isMuted ? 'Sesi Aç' : 'Sesi Kapat'}
        </Button>
        <Button 
          onClick={toggleScreenShare} 
          active={isScreenSharing}
          disabled={!isConnected}
        >
          {isScreenSharing ? 'Paylaşımı Durdur' : 'Ekran Paylaş'}
        </Button>
        <Button onClick={handleLeaveRoom} style={{ backgroundColor: '#dc3545' }}>
          Odadan Ayrıl
        </Button>
      </Controls>

      <audio ref={userAudioRef} autoPlay muted />
      {statusMessage && <StatusMessage>{statusMessage}</StatusMessage>}
    </RoomContainer>
  );
};

export default Room;