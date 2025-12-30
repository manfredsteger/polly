import { useState, useEffect, useCallback, useRef } from 'react';
import { nanoid } from 'nanoid';

interface LiveVoter {
  id: string;
  name: string;
  isVoting: boolean;
}

interface LiveVoteData {
  voterName: string;
  votes: Record<string, 'yes' | 'no' | 'maybe' | null>;
}

interface LiveVotingState {
  isConnected: boolean;
  activeVoters: LiveVoter[];
  liveVotes: Record<string, LiveVoteData>;
  viewerCount: number;
}

interface SlotUpdate {
  currentCount: number;
  maxCapacity: number | null;
}

interface UseLiveVotingOptions {
  pollToken: string;
  voterName?: string;
  isPresenter?: boolean;
  onResultsRefresh?: () => void;
  onVoteFinalized?: (voterName: string) => void;
  onSlotUpdate?: (slotUpdates: Record<number, SlotUpdate>) => void;
}

export function useLiveVoting({
  pollToken,
  voterName,
  isPresenter = false,
  onResultsRefresh,
  onVoteFinalized,
  onSlotUpdate,
}: UseLiveVotingOptions) {
  const [state, setState] = useState<LiveVotingState>({
    isConnected: false,
    activeVoters: [],
    liveVotes: {},
    viewerCount: 0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string>(nanoid());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const voterNameRef = useRef<string | undefined>(voterName);
  const pollTokenRef = useRef<string>(pollToken);
  const isPresenterRef = useRef<boolean>(isPresenter);
  const onResultsRefreshRef = useRef(onResultsRefresh);
  const onVoteFinalizedRef = useRef(onVoteFinalized);

  useEffect(() => {
    voterNameRef.current = voterName;
  }, [voterName]);

  const onSlotUpdateRef = useRef(onSlotUpdate);

  useEffect(() => {
    onResultsRefreshRef.current = onResultsRefresh;
    onVoteFinalizedRef.current = onVoteFinalized;
    onSlotUpdateRef.current = onSlotUpdate;
  }, [onResultsRefresh, onVoteFinalized, onSlotUpdate]);

  const handleMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'joined':
      case 'presence_update':
        setState(prev => ({
          ...prev,
          activeVoters: message.activeVoters || prev.activeVoters,
          liveVotes: message.liveVotes || prev.liveVotes,
          viewerCount: message.viewerCount || prev.viewerCount,
        }));
        break;

      case 'live_vote_update':
        setState(prev => ({
          ...prev,
          liveVotes: message.liveVotes || prev.liveVotes,
        }));
        break;

      case 'vote_finalized':
        setState(prev => ({
          ...prev,
          activeVoters: message.activeVoters || prev.activeVoters,
          liveVotes: message.liveVotes || prev.liveVotes,
        }));
        if (onVoteFinalizedRef.current) {
          onVoteFinalizedRef.current(message.voterName);
        }
        if (onResultsRefreshRef.current) {
          onResultsRefreshRef.current();
        }
        break;

      case 'results_refresh':
        if (onResultsRefreshRef.current) {
          onResultsRefreshRef.current();
        }
        break;

      case 'slot_update':
        if (onSlotUpdateRef.current && message.slotUpdates) {
          onSlotUpdateRef.current(message.slotUpdates);
        }
        break;

      case 'pong':
        break;

      default:
        console.log('[LiveVoting] Unknown message type:', message.type);
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/live-voting`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[LiveVoting] Connected to WebSocket');
        setState(prev => ({ ...prev, isConnected: true }));

        ws.send(JSON.stringify({
          type: 'join_poll',
          pollToken: pollTokenRef.current,
          voterName: voterNameRef.current,
          sessionId: sessionIdRef.current,
          isPresenter: isPresenterRef.current,
        }));

        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error('[LiveVoting] Error parsing message:', error);
        }
      };

      ws.onclose = () => {
        console.log('[LiveVoting] WebSocket closed');
        setState(prev => ({ ...prev, isConnected: false }));
        
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('[LiveVoting] WebSocket error:', error);
      };
    } catch (error) {
      console.error('[LiveVoting] Failed to connect:', error);
    }
  }, [handleMessage]);

  const sendVoteInProgress = useCallback((optionId: string, response: 'yes' | 'no' | 'maybe' | null) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'vote_in_progress',
        optionId,
        response,
      }));
    }
  }, []);

  const sendVoteSubmitted = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'vote_submitted',
        voterName: voterNameRef.current,
      }));
    }
  }, []);

  const updateVoterName = useCallback((newName: string) => {
    voterNameRef.current = newName;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'update_name',
        voterName: newName,
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'leave_poll' }));
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    pollTokenRef.current = pollToken;
    isPresenterRef.current = isPresenter;
    
    if (pollToken) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [pollToken, isPresenter, connect, disconnect]);

  return {
    ...state,
    sessionId: sessionIdRef.current,
    sendVoteInProgress,
    sendVoteSubmitted,
    updateVoterName,
    reconnect: connect,
  };
}
