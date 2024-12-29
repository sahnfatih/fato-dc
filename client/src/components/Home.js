import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
  color: white;
  padding: 20px;
`;

const Card = styled.div`
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 2rem;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  animation: ${fadeIn} 0.5s ease;

  @media (max-width: 480px) {
    padding: 1.5rem;
  }
`;

const Title = styled.h1`
  font-size: 2rem;
  margin-bottom: 2rem;
  text-align: center;
  color: #fff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Label = styled.label`
  font-size: 0.9rem;
  color: #ccc;
`;

const Input = styled.input`
  padding: 12px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: white;
  font-size: 1rem;
  transition: all 0.3s ease;

  &:focus {
    outline: none;
    border-color: #5865F2;
    box-shadow: 0 0 0 2px rgba(88, 101, 242, 0.2);
  }

  &::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }
`;

const Button = styled.button`
  padding: 12px;
  border-radius: 6px;
  border: none;
  background: #5865F2;
  color: white;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  &:hover {
    background: #4752C4;
    transform: translateY(-1px);
  }

  &:disabled {
    background: #3c3f41;
    cursor: not-allowed;
    transform: none;
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

const ErrorMessage = styled.div`
  color: #ff4444;
  font-size: 0.9rem;
  margin-top: 0.5rem;
  text-align: center;
  animation: ${fadeIn} 0.3s ease;
`;

const Divider = styled.div`
  display: flex;
  align-items: center;
  text-align: center;
  color: #666;
  margin: 1rem 0;

  &::before,
  &::after {
    content: '';
    flex: 1;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  span {
    padding: 0 10px;
    font-size: 0.9rem;
  }
`;

const Home = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');

  const generateRoomId = useCallback(() => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }, []);

  const createRoom = useCallback((e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Lütfen bir kullanıcı adı girin');
      return;
    }
    const newRoomId = generateRoomId();
    navigate(`/room/${newRoomId}`, { state: { username: username.trim() } });
  }, [username, navigate, generateRoomId]);

  const joinRoom = useCallback((e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Lütfen bir kullanıcı adı girin');
      return;
    }
    if (!roomId.trim()) {
      setError('Lütfen bir oda ID girin');
      return;
    }
    navigate(`/room/${roomId.trim()}`, { state: { username: username.trim() } });
  }, [username, roomId, navigate]);

  const handleUsernameChange = useCallback((e) => {
    setUsername(e.target.value);
    setError('');
  }, []);

  const handleRoomIdChange = useCallback((e) => {
    setRoomId(e.target.value.toUpperCase());
    setError('');
  }, []);

  return (
    <Container>
      <Card>
        <Title>Sesli Sohbet</Title>
        <Form onSubmit={joinRoom}>
          <InputGroup>
            <Label htmlFor="username">Kullanıcı Adı</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={handleUsernameChange}
              placeholder="Kullanıcı adınızı girin"
              maxLength={20}
              required
            />
          </InputGroup>

          <InputGroup>
            <Label htmlFor="roomId">Oda ID</Label>
            <Input
              id="roomId"
              type="text"
              value={roomId}
              onChange={handleRoomIdChange}
              placeholder="Oda ID girin"
              maxLength={6}
            />
          </InputGroup>

          {error && <ErrorMessage>{error}</ErrorMessage>}

          <Button type="submit" disabled={!username || !roomId}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zM4.5 7.5a.5.5 0 0 0 0 1h5.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3a.5.5 0 0 0 0-.708l-3-3a.5.5 0 1 0-.708.708L10.293 7.5H4.5z"/>
            </svg>
            Odaya Katıl
          </Button>

          <Divider><span>veya</span></Divider>

          <Button type="button" onClick={createRoom} disabled={!username}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
              <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
            </svg>
            Yeni Oda Oluştur
          </Button>
        </Form>
      </Card>
    </Container>
  );
};

export default Home;