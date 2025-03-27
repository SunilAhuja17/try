import { WebSocketGateway, SubscribeMessage, MessageBody, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface SignalMessage {
  type: string;
  from: string;
  to: string;
  offer?: any;
  answer?: any;
  candidate?: any;
}

@WebSocketGateway({ cors: { origin: '*' } })
export class SignalingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private users = new Map<string, Socket>();

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);

    // Safely iterate and remove disconnected user
    for (const [userId, socket] of this.users.entries()) {
      if (socket?.id === client.id) {
        console.log(`Removing user: ${userId}`);
        this.users.delete(userId);
        this.server.emit('user-disconnected', { userId });
      }
    }
  }

  @SubscribeMessage('join')
  handleJoin(@MessageBody() data: { userId: string }, client: Socket) {
    if (!data?.userId) {
      console.warn('Invalid join request: Missing userId');
      return;
    }

    // Remove old connection if the user reconnects
    if (this.users.has(data.userId)) {
      console.log(`User ${data.userId} already exists. Replacing old connection.`);
    }

    this.users.set(data.userId, client);
    console.log(`User ${data.userId} joined with Socket ID: ${client}`);

    // Notify all users about the new participant
    this.server.emit('new-user', { userId: data.userId });
  }

  @SubscribeMessage('signal')
  handleSignal(@MessageBody() message: SignalMessage) {
    const recipient = this.users.get(message.to);
    if (recipient) {
      recipient.emit('signal', message);
    } else {
      console.warn(`User ${message.to} not found.`);
    }
  }
}
