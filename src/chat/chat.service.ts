import { Injectable, OnModuleInit } from '@nestjs/common';
import { Client, Transport } from '@nestjs/microservices';
import type { ClientGrpc } from '@nestjs/microservices';
import { join } from 'path';
import { Observable, Subject, mergeMap } from 'rxjs';

interface ChatMessage {
  room_id: string;
  sender: string;
  content: string;
  timestamp?: number;
}

interface SendMessageResponse {
  success: boolean;
  message: string;
}

interface ChatServiceGrpc {
  SendMessage(data: ChatMessage): Observable<SendMessageResponse>;
  StreamChat(data: Observable<ChatMessage>): Observable<ChatMessage>;
}

@Injectable()
export class ChatService implements OnModuleInit {
  @Client({
    transport: Transport.GRPC,
    options: {
      package: 'chat',
      protoPath: join(__dirname, '../../src/chat/chat.proto'),
      url: 'localhost:50051',
    },
  })
  private client: ClientGrpc;

  private chatService: ChatServiceGrpc;

  onModuleInit() {
    this.chatService = this.client.getService<ChatServiceGrpc>('ChatService');
  }

  sendMessage(data: ChatMessage) {
    return this.chatService.SendMessage(data);
  }

  /**
   * Create a duplex stream with backend
   * input$ → stream ke backend
   * stream$ → response Observable dari backend
   */
  createStream(): { input$: Subject<ChatMessage>; stream$: Observable<ChatMessage> } {
    const input$ = new Subject<ChatMessage>();

    // Kirim input$ sebagai Observable ke backend
    const stream$ = this.chatService.StreamChat(input$.asObservable());

    return { input$, stream$ };
  }
}
