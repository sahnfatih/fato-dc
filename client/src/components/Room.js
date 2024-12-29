import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import io from 'socket.io-client';
import Peer from 'simple-peer';

// Animasyonlar
const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const slideUp = keyframes`
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

const RoomContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #1a1a1a;
  color: white;
  animation: ${fadeIn} 0.3s ease;
`;

const Header = styled.header`
  background-color: #2a2a2a;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
`;

const RoomInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;

  h1 {
    font-size: 1.5rem;
    margin: 0;
  }

  button {
    background: #3a3a3a;
    border: none;
    color: white;
    padding: 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover {
      background: #4a4a4a;
      transform: scale(1.05);
    }
  }
`;

const StatusMessage = styled.div`
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 10px 20px;
  border-radius: 4px;
  z-index: 1000;
  animation: ${slideUp} 0.3s ease;
`;

const Controls = styled.div`
  display: flex;
  justify-content: center;
  gap: 20px;
  padding: 20px;
  background-color: rgba(42, 42, 42, 0.95);
  position: fixed;
  bottom: 0;
  width: 100%;
  box-shadow: 0 -2px 4px rgba(0,0,0,0.2);
  backdrop-filter: blur(10px);
  z-index: 100;
`;

const Button = styled.button`
  padding: 12px 24px;
  border-radius: 8px;
  border: none;
  background-color: ${props => props.active ? '#5865F2' : '#4a4a4a'};
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1rem;

  &:hover {
    background-color: ${props => props.active ? '#4752c4' : '#3a3a3a'};
    transform: translateY(-2px);
  }

  &:active {
    transform: translateY(0);
  }

  svg {
    width: 20px;
    height: 20px;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const ParticipantsList = styled.div`
  padding: 20px;
  background-color: #2a2a2a;
  width: 250px;
  border-radius: 8px;
  margin: 20px;
  height: fit-content;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  animation: ${fadeIn} 0.3s ease;

  h3 {
    margin-bottom: 15px;
    border-bottom: 1px solid #3a3a3a;
    padding-bottom: 10px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  ul {
    list-style: none;
    padding: 0;
    
    li {
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 8px;
      background: #3a3a3a;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s ease;
      
      &:hover {
        background: #4a4a4a;
      }

      svg {
        width: 16px;
        height: 16px;
      }

      .user-status {
        margin-left: auto;
        font-size: 0.8rem;
        color: #aaa;
      }
    }
  }
`;

const MainContent = styled.div`
  display: flex;
  flex: 1;
  padding: 20px;
  gap: 20px;
  margin-bottom: 80px;
  position: relative;
`;

const ScreenShareContainer = styled.div`
  flex: 1;
  background-color: #2a2a2a;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  min-height: 400px;
  animation: ${fadeIn} 0.3s ease;

  video {
    max-width: 100%;
    max-height: 100%;
    border-radius: 8px;
  }

  p {
    color: #666;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;

    svg {
      width: 48px;
      height: 48px;
    }
  }
`;

const LoadingSpinner = styled.div`
  border: 3px solid #f3f3f3;
  border-top: 3px solid #3498db;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  animation: spin 1s linear infinite;
  margin: 0 auto;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const ConnectionStatus = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 0.8rem;
  background-color: ${props => props.connected ? '#4caf50' : '#f44336'};
  color: white;
  display: flex;
  align-items: center;
  gap: 5px;
`;

const Room = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [participants, setParticipants] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const socketRef = useRef();
  const peersRef = useRef([]);
  const streamRef = useRef();
  const screenStreamRef = useRef();
  const userAudioRef = useRef();
  const screenVideoRef = useRef();
  const statusTimeoutRef = useRef();

  // Durum mesajı gösterme fonksiyonu
  const showStatus = useCallback((message, duration = 3000) => {
    setStatusMessage(message);
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
    }
    statusTimeoutRef.current = setTimeout(() => {
      setStatusMessage('');
    }, duration);
  }, []);

  // Oda ID'sini kopyalama
  const copyRoomId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      showStatus('Oda ID kopyalandı!');
    } catch (err) {
      showStatus('Kopyalama başarısız oldu');
    }
  }, [roomId, showStatus]);

  // Medya izinlerini kontrol etme
  const checkMediaPermissions = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      if (userAudioRef.current) {
        userAudioRef.current.srcObject = stream;
      }
      return true;
    } catch (err) {
      setError('Mikrofon erişimi reddedildi. Lütfen tarayıcı izinlerini kontrol edin.');
      return false;
    }
  }, []);

  // Socket.io bağlantısı kurma
  useEffect(() => {
    const initializeConnection = async () => {
      if (!location.state?.username) {
        navigate('/');
        return;
      }

      setIsLoading(true);
      const hasPermissions = await checkMediaPermissions();
      if (!hasPermissions) {
        setIsLoading(false);
        return;
      }

      try {
        socketRef.current = io(process.env.REACT_APP_SERVER_URL || 'http://localhost:5000');
        
        socketRef.current.on('connect', () => {
          setIsConnected(true);
          socketRef.current.emit('join-room', {
            roomId,
            username: location.state.username
          });
        });

        socketRef.current.on('connect_error', (error) => {
          setError('Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol edin.');
          setIsConnected(false);
        });

        socketRef.current.on('existing-users', (users) => {
          setParticipants(users.filter(user => user.userId !== socketRef.current.id));
          users.forEach(user => {
            if (user.userId !== socketRef.current.id) {
              const peer = createPeer(user.userId, socketRef.current.id, streamRef.current);
              peersRef.current.push({ userId: user.userId, peer });
            }
          });
          setIsLoading(false);
        });

        socketRef.current.on('user-connected', ({ userId, username }) => {
          showStatus(`${username} odaya katıldı`);
          const peer = createPeer(userId, socketRef.current.id, streamRef.current);
          peersRef.current.push({ userId, peer });
          setParticipants(prev => [...prev, { userId, username }]);
        });

        socketRef.current.on('user-disconnected', (userId) => {
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

      } catch (err) {
        setError('Bir hata oluştu. Lütfen sayfayı yenileyin.');
        setIsLoading(false);
      }
    };

    initializeConnection();

    return () => {
      socketRef.current?.disconnect();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }
      peersRef.current.forEach(({ peer }) => peer.destroy());
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    };
  }, [roomId, location.state, navigate, showStatus, checkMediaPermissions]);

  const createPeer = useCallback((userId, myId, stream) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream
    });

    peer.on('signal', signal => {
      socketRef.current.emit('signal', { userId, signal });
    });

    peer.on('stream', remoteStream => {
      if (remoteStream.getVideoTracks().length > 0) {
        const video = document.createElement('video');
        video.srcObject = remoteStream;
        video.id = `video-${userId}`;
        video.autoplay = true;
        video.playsInline = true;
        video.style.width = '100%';
        video.style.borderRadius = '8px';
        
        const container = screenVideoRef.current;
        container.innerHTML = '';
        container.appendChild(video);
      } else {
        const audio = document.createElement('audio');
        audio.srcObject = remoteStream;
        audio.id = `audio-${userId}`;
        audio.autoplay = true;
        document.body.appendChild(audio);
      }
    });

    peer.on('error', err => {
      console.error('Peer bağlantı hatası:', err);
      showStatus('Bağlantı hatası oluştu');
    });

    return peer;
  }, [showStatus]);

  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
      showStatus(isMuted ? 'Ses açıldı' : 'Ses kapatıldı');
    }
  }, [isMuted, showStatus]);

  const toggleScreenShare = useCallback(async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
            displaySurface: 'monitor'
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          }
        });
        
        screenStreamRef.current = screenStream;
        
        peersRef.current.forEach(({ peer }) => {
          peer.addStream(screenStream);
        });

        const video = document.createElement('video');
        video.srcObject = screenStream;
        video.autoplay = true;
        video.playsInline = true;
        video.style.width = '100%';
        video.style.borderRadius = '8px';
        screenVideoRef.current.innerHTML = '';
        screenVideoRef.current.appendChild(video);

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
  }, [isScreenSharing, showStatus]);

  const stopScreenSharing = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      
      peersRef.current.forEach(({ peer }) => {
        peer.removeStream(screenStreamRef.current);
      });

      screenStreamRef.current = null;
      screenVideoRef.current.innerHTML = '';
      setIsScreenSharing(false);
      showStatus('Ekran paylaşımı durduruldu');
    }
  }, [showStatus]);

  const handleLeaveRoom = useCallback(() => {
    if (window.confirm('Odadan ayrılmak istediğinize emin misiniz?')) {
      navigate('/');
    }
  }, [navigate]);

  if (isLoading) {
    return (
      <RoomContainer>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <LoadingSpinner />
          <p style={{ marginLeft: '10px' }}>Odaya bağlanılıyor...</p>
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
          <div style={{ color: '#f44336' }}>{error}</div>
          <Button onClick={() => navigate('/')}>Ana Sayfaya Dön</Button>
        </div>
      </RoomContainer>
    );
  }

  return (
    <RoomContainer>
      <Header>
        <RoomInfo>
          <h1>Oda: {roomId}</h1>
          <button onClick={copyRoomId} title="Oda ID'sini Kopyala">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
              <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
            </svg>
          </button>
        </RoomInfo>
        <ConnectionStatus connected={isConnected}>
          {isConnected ? (
            <>
              <span>●</span> Bağlı
            </>
          ) : (
            <>
              <span>●</span> Bağlantı Kesik
            </>
          )}
        </ConnectionStatus>
      </Header>

      <MainContent>
        <ParticipantsList>
          <h3>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1H7zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
              <path fillRule="evenodd" d="M5.216 14A2.238 2.238 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.325 6.325 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1h4.216z"/>
              <path d="M4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/>
            </svg>
            Katılımcılar ({participants.length + 1})
          </h3>
          <ul>
            <li>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/>
              </svg>
              {location.state?.username} (Sen)
              <span className="user-status">
                {isMuted && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06zM6 4.04 4.312 5.5H2v5h2.312L6 11.96V4.04zm7.854.606a.5.5 0 0 1 0 .708L12.207 7l1.647 1.646a.5.5 0 0 1-.708.708L11.5 7.707l-1.646 1.647a.5.5 0 0 1-.708-.708L10.793 7 9.146 5.354a.5.5 0 1 1 .708-.708L11.5 6.293l1.646-1.647a.5.5 0 0 1 .708 0z"/>
                  </svg>
                )}
              </span>
            </li>
            {participants.map(p => (
              <li key={p.userId}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/>
                </svg>
                {p.username}
              </li>
            ))}
          </ul>
        </ParticipantsList>

        <ScreenShareContainer ref={screenVideoRef}>
          {!isScreenSharing && !screenVideoRef.current?.hasChildNodes() && (
            <p>
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 16 16">
                <path d="M0 3.5A1.5 1.5 0 0 1 1.5 2h13A1.5 1.5 0 0 1 16 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 12.5v-9zM1.5 3a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-13z"/>
                <path d="M2 4.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm8-6a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5z"/>
              </svg>
              Henüz ekran paylaşımı yok
            </p>
          )}
        </ScreenShareContainer>
      </MainContent>

      <Controls>
        <Button onClick={toggleMute} active={!isMuted}>
          {isMuted ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06zM6 4.04 4.312 5.5H2v5h2.312L6 11.96V4.04zm7.854.606a.5.5 0 0 1 0 .708L12.207 7l1.647 1.646a.5.5 0 0 1-.708.708L11.5 7.707l-1.646 1.647a.5.5 0 0 1-.708-.708L10.793 7 9.146 5.354a.5.5 0 1 1 .708-.708L11.5 6.293l1.646-1.647a.5.5 0 0 1 .708 0z"/>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M3.5 6.5A.5.5 0 0 1 4 7v1a4 4 0 0 0 8 0V7a.5.5 0 0 1 1 0v1a5 5 0 0 1-4.5 4.975V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 .5-.5z"/>
              <path d="M10 8a2 2 0 1 1-4 0V3a2 2 0 1 1 4 0v5zM8 0a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V3a3 3 0 0 0-3-3z"/>
            </svg>
          )}
          {isMuted ? 'Sesi Aç' : 'Sesi Kapat'}
        </Button>

        <Button 
          onClick={toggleScreenShare} 
          active={isScreenSharing}
          disabled={!isConnected}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M0 3.5A1.5 1.5 0 0 1 1.5 2h13A1.5 1.5 0 0 1 16 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 12.5v-9zM1.5 3a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-13z"/>
            <path d="M2 4.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm8-6a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm0 2a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5z"/>
          </svg>
          {isScreenSharing ? 'Paylaşımı Durdur' : 'Ekran Paylaş'}
        </Button>

        <Button onClick={handleLeaveRoom} style={{ backgroundColor: '#dc3545' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path fillRule="evenodd" d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0v2z"/>
            <path fillRule="evenodd" d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3z"/>
          </svg>
          Odadan Ayrıl
        </Button>
      </Controls>

      <audio ref={userAudioRef} autoPlay muted />
      {statusMessage && <StatusMessage>{statusMessage}</StatusMessage>}
    </RoomContainer>
  );
};

export default Room;