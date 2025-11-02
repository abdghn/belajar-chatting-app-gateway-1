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
import { Subject } from 'rxjs';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class ChatGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private input$: Subject<any>; // stream input yang dikaitkan ke gRPC
  private stream$: any;

  constructor(private readonly chatService: ChatService) {}

  async afterInit() {
    console.log('🟡 Initializing WebSocket Gateway...');
    await this.chatService.ensureReady();

    console.log('🟢 gRPC service ready, opening stream...');
    const { input$, stream$ } = this.chatService.createStream();

    // Simpan supaya bisa dipakai di handleSendMessage()
    this.input$ = input$;
    this.stream$ = stream$;

    // Listen dari backend (gRPC streaming)
    stream$.subscribe({
      next: (msg) => {
        console.log('📥 From backend:', msg);
        if (msg.room_id) {
          this.server.to(msg.room_id).emit('chat_message', msg);
        } else {
          this.server.emit('chat_message', msg);
        }
      },
      error: (err) => console.error('Stream error:', err),
      complete: () => console.log('Stream completed'),
    });

    console.log('✅ Chat stream aktif');
  }

  handleConnection(client: Socket) {
    console.log(`🟢 Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`🔴 Client disconnected: ${client.id}`);
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
  try {
    // broadcast juga ke semua socket client lain
    this.server.emit('chat_message', data);

  } catch (err) {
    console.error('gRPC error:', err);
  }
  }
}
