// import { Injectable, OnModuleInit } from '@nestjs/common';
// import { Client, Transport } from '@nestjs/microservices';
// import type { ClientGrpc } from '@nestjs/microservices';
// import { join } from 'path';
// import { Observable, Subject, mergeMap } from 'rxjs';

// interface ChatMessage {
//   room_id: string;
//   sender: string;
//   content: string;
//   timestamp?: number;
// }

// interface SendMessageResponse {
//   success: boolean;
//   message: string;
// }

// interface ChatServiceGrpc {
//   SendMessage(data: ChatMessage): Observable<SendMessageResponse>;
//   StreamChat(data: Observable<ChatMessage>): Observable<ChatMessage>;
// }

// @Injectable()
// export class ChatService implements OnModuleInit {
//   @Client({
//     transport: Transport.GRPC,
//     options: {
//       package: 'chat',
//       protoPath: join(__dirname, '../../src/chat/chat.proto'),
//       url: 'localhost:50051',
//     },
//   })
//   private client: ClientGrpc;

//   private chatService: ChatServiceGrpc;

//   onModuleInit() {
//     this.chatService = this.client.getService<ChatServiceGrpc>('ChatService');
//   }

//   sendMessage(data: ChatMessage) {
//     return this.chatService.SendMessage(data);
//   }

//   /**
//    * Create a duplex stream with backend
//    * input$ → stream ke backend
//    * stream$ → response Observable dari backend
//    */
//   createStream(): { input$: Subject<ChatMessage>; stream$: Observable<ChatMessage> } {
//     const input$ = new Subject<ChatMessage>();

//     // Kirim input$ sebagai Observable ke backend
//     const stream$ = this.chatService.StreamChat(input$.asObservable());

//     return { input$, stream$ };
//   }
// }

import { Injectable, OnModuleInit } from '@nestjs/common';
import { Client, Transport } from '@nestjs/microservices';
import type { ClientGrpc } from '@nestjs/microservices';
import { join } from 'path';
import { Observable, Subject } from 'rxjs';

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
  StreamChat(): any;
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

  private chatService: ChatServiceGrpc | null = null;

  async onModuleInit() {
    await this.waitForGrpcReady();
  }

  private async waitForGrpcReady(maxRetries = 10): Promise<void> {
    let attempts = 0;
    while (attempts < maxRetries) {
      try {
        this.chatService = this.client.getService<ChatServiceGrpc>('ChatService');
        if (this.chatService && typeof this.chatService.StreamChat === 'function') {
          console.log('✅ gRPC ChatService connected');
          return;
        }
      } catch (err) {
        console.log(`⚠️ Waiting for gRPC service... (attempt ${attempts + 1})`);
      }

      await new Promise((res) => setTimeout(res, 1000)); // tunggu 1 detik
      attempts++;
    }

    throw new Error('❌ gRPC service not available after retries');
  }

  async ensureReady() {
    if (!this.chatService) {
      await this.waitForGrpcReady();
    }
  }

  sendMessage(data: ChatMessage) {
    if (!this.chatService) throw new Error('gRPC service not initialized yet');
    return this.chatService.SendMessage(data);
  }

  createStream(): { input$: Subject<ChatMessage>; stream$: any } {
    if (!this.chatService) throw new Error('gRPC service not initialized yet');

    const input$ = new Subject<ChatMessage>();
    const stream$ = this.chatService.StreamChat();

    input$.subscribe((msg) => {
      stream$.write?.(msg);
    });

    return { input$, stream$ };
  }
}
