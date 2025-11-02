import { Controller, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';
import { firstValueFrom } from 'rxjs';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('send')
  async SendMessage(@Body() body: any): Promise<any>  {
    const res = await firstValueFrom(this.chatService.sendMessage(body));
    return res;
  }
}
