import { Controller, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';
import { firstValueFrom } from 'rxjs';
import { ChatGateway } from './chat.gateway';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService, private readonly chatGateway: ChatGateway) {}

  @Post('send')
  async SendMessage(@Body() body: any): Promise<any>  {
     const msg = {
      room_id: body.room_id,
      sender: body.sender,
      content: body.content,
      timestamp: Date.now(),
    };

    // 1️⃣ Kirim ke backend gRPC
    await this.chatService.sendMessage(msg);

    // 2️⃣ Broadcast ke semua socket client
    this.chatGateway.server.emit('chat_message', msg);

    // 3️⃣ Response ke Postman
    return { success: true, message: 'Message sent', data: msg };
  }
}
