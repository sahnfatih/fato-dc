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
    
    &:hover {
      background: #4a4a4a;
    }
  }
`;

const Controls = styled.div`
  display: flex;
  justify-content: center;
  gap: 20px;
  padding: 20px;
  background-color: #2a2a2a;
  position: fixed;
  bottom: 0;
  width: 100%;
  box-shadow: 0 -2px 4px rgba(0,0,0,0.2);
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
`;

const ParticipantsList = styled.div`
  padding: 20px;
  background-color: #2a2a2a;
  width: 250px;
  border-radius: 8px;
  margin: 20px;
  height: fit-content;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);

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
      
      svg {
        width: 16px;
        height: 16px;
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
`;

const ScreenShareContainer = styled.div`
  flex: 1;
  background-color: #2a2a2a;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  position: relative;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);

  video {
    width: 100%;
    height: 100%;
    border-radius: 8px;
  }

  p {
    position: absolute;
    color: #fff;
    text-align: center;
  }
`;

const StatusMessage = styled.div`
  position: fixed;
  top: 20px;
  right: 20px;
  background-color: #2a2a2a;
  padding: 12px 24px;
  border-radius: 8px;
  animation: fadeOut 3s forwards;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  z-index: 1000;

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
  const screenVideoRef = useRef();
  const peersRef = useRef([]);
  const streamRef = useRef();
  const screenStreamRef = useRef();

  const showStatus = (message) => {
    setStatusMessage(message);
    setTimeout(() => setStatusMessage(''), 3000);
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    showStatus('Oda ID kopyalandı!');
  };

  useEffect(() => {
    if (!location.state?.username) {
      navigate('/');
      return;
    }

    socketRef.current = io('https://fato-dc.onrender.com');

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        streamRef.current = stream;
        userAudioRef.current.srcObject = stream;
        
        socketRef.current.emit('join-room', {
          roomId,
          username: location.state.username
        });

        socketRef.current.on('existing-users', users => {
          const filteredUsers = users.filter(user => user.userId !== socketRef.current.id);
          setParticipants(filteredUsers);
          
          filteredUsers.forEach(user => {
            const peer = createPeer(user.userId, socketRef.current.id, stream);
            peersRef.current.push({
              peerId: user.userId,
              peer,
              username: user.username
            });
          });
        });

        socketRef.current.on('user-connected', ({ userId, username }) => {
          showStatus(`${username} odaya katıldı`);
          const peer = createPeer(userId, socketRef.current.id, stream);
          peersRef.current.push({ peerId: userId, peer, username });
          setParticipants(prev => [...prev, { userId, username }]);
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
          setParticipants(prev => prev.filter(p => p.userId !== userId));
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

    peer.on('stream', remoteStream => {
      // Ekran paylaşımı veya ses akışını işle
      if (remoteStream.getVideoTracks().length > 0) {
        const video = document.createElement('video');
        video.srcObject = remoteStream;
        video.id = `video-${userId}`;
        video.autoplay = true;
        video.playsInline = true;
        screenVideoRef.current.appendChild(video);
      } else {
        const audio = document.createElement('audio');
        audio.srcObject = remoteStream;
        audio.id = `audio-${userId}`;
        audio.autoplay = true;
        document.body.appendChild(audio);
      }
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
          video: true,
          audio: true
        });
        
        screenStreamRef.current = screenStream;
        
        // Ekran paylaşımını diğer kullanıcılara gönder
        peersRef.current.forEach(({ peer }) => {
          peer.addStream(screenStream);
        });

        // Yerel görüntüyü göster
        const video = document.createElement('video');
        video.srcObject = screenStream;
        video.autoplay = true;
        video.playsInline = true;
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
  };

  const stopScreenSharing = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      
      // Diğer kullanıcılara ekran paylaşımının durduğunu bildir
      peersRef.current.forEach(({ peer }) => {
        peer.removeStream(screenStreamRef.current);
      });

      screenStreamRef.current = null;
      screenVideoRef.current.innerHTML = '';
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
      <Header>
        <RoomInfo>
          <h1>Oda: {roomId}</h1>
          <button onClick={copyRoomId}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
              <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
            </svg>
          </button>
        </RoomInfo>
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
              {isMuted && (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06zM6 4.04 4.312 5.5H2v5h2.312L6 11.96V4.04zm7.854.606a.5.5 0 0 1 0 .708L12.207 7l1.647 1.646a.5.5 0 0 1-.708.708L11.5 7.707l-1.646 1.647a.5.5 0 0 1-.708-.708L10.793 7 9.146 5.354a.5.5 0 1 1 .708-.708L11.5 6.293l1.646-1.647a.5.5 0 0 1 .708 0z"/>
                </svg>
              )}
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
          {!isScreenSharing && (
            <p>Henüz ekran paylaşımı yok</p>
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

        <Button onClick={toggleScreenShare} active={isScreenSharing}>
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