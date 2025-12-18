import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

interface LiveVoter {
  odId: string;
  name: string;
  sessionId: string;
  joinedAt: Date;
  inProgressVotes: Record<string, 'yes' | 'no' | 'maybe' | null>;
}

interface PollRoom {
  pollToken: string;
  viewers: Map<string, { ws: WebSocket; name?: string; isPresenter: boolean }>;
  liveVoters: Map<string, LiveVoter>;
}

class LiveVotingService {
  private wss: WebSocketServer | null = null;
  private pollRooms: Map<string, PollRoom> = new Map();
  private wsToSession: Map<WebSocket, { pollToken: string; sessionId: string; isPresenter: boolean }> = new Map();

  // Use noServer mode to avoid interfering with Vite's HMR WebSocket
  initializeWithUpgrade(server: Server) {
    // Guard against double initialization during dev hot reloads
    if (this.wss) return;
    
    this.wss = new WebSocketServer({ noServer: true });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('[LiveVoting] New WebSocket connection');

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('[LiveVoting] Error parsing message:', error);
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        console.error('[LiveVoting] WebSocket error:', error);
        this.handleDisconnect(ws);
      });
    });

    // Capture existing upgrade listeners (including Vite's HMR)
    const existingListeners = server.listeners('upgrade').slice() as Function[];
    
    // Remove all existing upgrade listeners
    server.removeAllListeners('upgrade');
    
    // Add our wrapper that handles live voting and forwards others to Vite
    server.on('upgrade', (request, socket, head) => {
      const pathname = request.url;
      
      if (pathname === '/ws/live-voting') {
        // Handle live voting WebSocket
        this.wss!.handleUpgrade(request, socket, head, (ws) => {
          this.wss!.emit('connection', ws, request);
        });
      } else {
        // Forward to existing listeners (Vite HMR, etc.)
        for (const listener of existingListeners) {
          listener.call(server, request, socket, head);
        }
      }
    });

    console.log('[LiveVoting] WebSocket server initialized on /ws/live-voting');
  }

  private handleMessage(ws: WebSocket, message: any) {
    switch (message.type) {
      case 'join_poll':
        this.handleJoinPoll(ws, message);
        break;
      case 'leave_poll':
        this.handleLeavePoll(ws);
        break;
      case 'vote_in_progress':
        this.handleVoteInProgress(ws, message);
        break;
      case 'vote_submitted':
        this.handleVoteSubmitted(ws, message);
        break;
      case 'start_presenting':
        this.handleStartPresenting(ws, message);
        break;
      case 'stop_presenting':
        this.handleStopPresenting(ws);
        break;
      case 'update_name':
        this.handleUpdateName(ws, message);
        break;
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
      default:
        console.warn('[LiveVoting] Unknown message type:', message.type);
    }
  }

  private handleJoinPoll(ws: WebSocket, message: { pollToken: string; voterName?: string; sessionId: string; isPresenter?: boolean }) {
    const { pollToken, voterName, sessionId, isPresenter = false } = message;

    let room = this.pollRooms.get(pollToken);
    if (!room) {
      room = {
        pollToken,
        viewers: new Map(),
        liveVoters: new Map(),
      };
      this.pollRooms.set(pollToken, room);
    }

    room.viewers.set(sessionId, { ws, name: voterName, isPresenter });
    this.wsToSession.set(ws, { pollToken, sessionId, isPresenter });

    if (voterName && !isPresenter) {
      room.liveVoters.set(sessionId, {
        odId: sessionId,
        name: voterName,
        sessionId,
        joinedAt: new Date(),
        inProgressVotes: {},
      });
    }

    this.broadcastToRoom(pollToken, {
      type: 'presence_update',
      activeVoters: this.getActiveVoters(pollToken),
      liveVotes: this.getLiveVotes(pollToken),
      viewerCount: room.viewers.size,
    });

    ws.send(JSON.stringify({
      type: 'joined',
      activeVoters: this.getActiveVoters(pollToken),
      liveVotes: this.getLiveVotes(pollToken),
      viewerCount: room.viewers.size,
    }));

    console.log(`[LiveVoting] ${voterName || 'Anonymous'} joined poll ${pollToken} (presenter: ${isPresenter})`);
  }

  private handleLeavePoll(ws: WebSocket) {
    const session = this.wsToSession.get(ws);
    if (!session) return;

    const { pollToken, sessionId } = session;
    const room = this.pollRooms.get(pollToken);
    if (room) {
      room.viewers.delete(sessionId);
      room.liveVoters.delete(sessionId);

      this.broadcastToRoom(pollToken, {
        type: 'presence_update',
        activeVoters: this.getActiveVoters(pollToken),
        liveVotes: this.getLiveVotes(pollToken),
        viewerCount: room.viewers.size,
      });

      if (room.viewers.size === 0) {
        this.pollRooms.delete(pollToken);
      }
    }

    this.wsToSession.delete(ws);
  }

  private handleDisconnect(ws: WebSocket) {
    this.handleLeavePoll(ws);
  }

  private handleVoteInProgress(ws: WebSocket, message: { optionId: string; response: 'yes' | 'no' | 'maybe' | null }) {
    const session = this.wsToSession.get(ws);
    if (!session) return;

    const { pollToken, sessionId } = session;
    const room = this.pollRooms.get(pollToken);
    if (!room) return;

    const voter = room.liveVoters.get(sessionId);
    if (voter) {
      if (message.response === null) {
        delete voter.inProgressVotes[message.optionId];
      } else {
        voter.inProgressVotes[message.optionId] = message.response;
      }

      this.broadcastToRoom(pollToken, {
        type: 'live_vote_update',
        voterId: sessionId,
        voterName: voter.name,
        optionId: message.optionId,
        response: message.response,
        liveVotes: this.getLiveVotes(pollToken),
      });
    }
  }

  private handleVoteSubmitted(ws: WebSocket, message: { voterName: string }) {
    const session = this.wsToSession.get(ws);
    if (!session) return;

    const { pollToken, sessionId } = session;
    const room = this.pollRooms.get(pollToken);
    if (!room) return;

    room.liveVoters.delete(sessionId);

    this.broadcastToRoom(pollToken, {
      type: 'vote_finalized',
      voterId: sessionId,
      voterName: message.voterName,
      activeVoters: this.getActiveVoters(pollToken),
      liveVotes: this.getLiveVotes(pollToken),
    });

    console.log(`[LiveVoting] Vote submitted by ${message.voterName} in poll ${pollToken}`);
  }

  private handleStartPresenting(ws: WebSocket, message: { pollToken: string }) {
    const session = this.wsToSession.get(ws);
    if (session) {
      session.isPresenter = true;
      const room = this.pollRooms.get(session.pollToken);
      if (room) {
        const viewer = room.viewers.get(session.sessionId);
        if (viewer) {
          viewer.isPresenter = true;
        }
      }
    }
  }

  private handleStopPresenting(ws: WebSocket) {
    const session = this.wsToSession.get(ws);
    if (session) {
      session.isPresenter = false;
      const room = this.pollRooms.get(session.pollToken);
      if (room) {
        const viewer = room.viewers.get(session.sessionId);
        if (viewer) {
          viewer.isPresenter = false;
        }
      }
    }
  }

  private handleUpdateName(ws: WebSocket, message: { voterName: string }) {
    const session = this.wsToSession.get(ws);
    if (!session) return;

    const { pollToken, sessionId } = session;
    const room = this.pollRooms.get(pollToken);
    if (!room) return;

    const viewer = room.viewers.get(sessionId);
    if (viewer) {
      viewer.name = message.voterName;
    }

    const voter = room.liveVoters.get(sessionId);
    if (voter) {
      voter.name = message.voterName;
    } else if (message.voterName) {
      room.liveVoters.set(sessionId, {
        odId: sessionId,
        name: message.voterName,
        sessionId,
        joinedAt: new Date(),
        inProgressVotes: {},
      });
    }

    this.broadcastToRoom(pollToken, {
      type: 'presence_update',
      activeVoters: this.getActiveVoters(pollToken),
      liveVotes: this.getLiveVotes(pollToken),
      viewerCount: room.viewers.size,
    });
  }

  private getActiveVoters(pollToken: string): Array<{ id: string; name: string; isVoting: boolean }> {
    const room = this.pollRooms.get(pollToken);
    if (!room) return [];

    return Array.from(room.liveVoters.values()).map(voter => ({
      id: voter.sessionId,
      name: voter.name,
      isVoting: Object.keys(voter.inProgressVotes).length > 0,
    }));
  }

  private getLiveVotes(pollToken: string): Record<string, { voterName: string; votes: Record<string, 'yes' | 'no' | 'maybe' | null> }> {
    const room = this.pollRooms.get(pollToken);
    if (!room) return {};

    const liveVotes: Record<string, { voterName: string; votes: Record<string, 'yes' | 'no' | 'maybe' | null> }> = {};
    
    room.liveVoters.forEach((voter, id) => {
      if (Object.keys(voter.inProgressVotes).length > 0) {
        liveVotes[id] = {
          voterName: voter.name,
          votes: voter.inProgressVotes,
        };
      }
    });

    return liveVotes;
  }

  private broadcastToRoom(pollToken: string, message: any) {
    const room = this.pollRooms.get(pollToken);
    if (!room) return;

    const messageStr = JSON.stringify(message);
    room.viewers.forEach(({ ws }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });
  }

  notifyResultsRefresh(pollToken: string) {
    this.broadcastToRoom(pollToken, {
      type: 'results_refresh',
    });
  }

  getStats() {
    return {
      activeRooms: this.pollRooms.size,
      totalConnections: this.wsToSession.size,
      rooms: Array.from(this.pollRooms.entries()).map(([token, room]) => ({
        pollToken: token,
        viewerCount: room.viewers.size,
        activeVotersCount: room.liveVoters.size,
      })),
    };
  }
}

export const liveVotingService = new LiveVotingService();
