import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  OnGatewayInit,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { firstValueFrom } from 'rxjs';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class ChatGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private streams = new Map<string, any>(); // clientId -> { input$, stream$ }

  constructor(private readonly chatService: ChatService) {}

  afterInit() {
    console.log('✅ WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    console.log(`🟢 Client connected: ${client.id}`);

    const { input$, stream$ } = this.chatService.createStream();

    // listen messages dari backend stream
    stream$.subscribe({
      next: (msg) => {
        // broadcast ke room yg sesuai aja
        if (msg.room_id) {
          this.server.to(msg.room_id).emit('chat_message', msg);
        } else {
          this.server.emit('chat_message', msg);
        }
      },
      error: (err) => console.error('Stream error:', err),
      complete: () => console.log('Stream completed'),
    });

    this.streams.set(client.id, { input$, stream$ });
  }

  handleDisconnect(client: Socket) {
    console.log(`🔴 Client disconnected: ${client.id}`);
    const s = this.streams.get(client.id);
    s?.stream$?.end?.();
    this.streams.delete(client.id);
  }

  // 🏠 join room
  @SubscribeMessage('join_room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room_id: string },
  ) {
    client.join(data.room_id);
    console.log(`👥 Client ${client.id} joined room ${data.room_id}`);
    client.emit('joined_room', { room_id: data.room_id });
  }

  // 💬 kirim pesan
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { room_id: string; sender: string; content: string },
  ) {
    const msg = {
      room_id: data.room_id,
      sender: data.sender,
      content: data.content,
    };

    // kirim ke Go backend
    await firstValueFrom(this.chatService.sendMessage(msg));

    // broadcast ke room (bukan global)
    this.server.to(data.room_id).emit('chat_message', msg);

    console.log(`[${data.room_id}] ${data.sender}: ${data.content}`);
  }
}
