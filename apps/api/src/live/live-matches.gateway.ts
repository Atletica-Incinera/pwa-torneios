import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: 'live-matches',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class LiveMatchesGateway {
  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('join-match')
  handleJoinMatch(
    @MessageBody() payload: { matchId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.getMatchRoom(payload.matchId);
    void client.join(room);

    return {
      event: 'joined-match',
      matchId: payload.matchId,
      room,
    };
  }

  @SubscribeMessage('leave-match')
  handleLeaveMatch(
    @MessageBody() payload: { matchId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.getMatchRoom(payload.matchId);
    void client.leave(room);

    return {
      event: 'left-match',
      matchId: payload.matchId,
      room,
    };
  }

  emitMatchEvent(matchId: string, event: string, data: unknown) {
    this.server.to(this.getMatchRoom(matchId)).emit(event, data);
  }

  private getMatchRoom(matchId: string) {
    return `match:${matchId}`;
  }
}
