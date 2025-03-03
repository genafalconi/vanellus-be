import { Controller, Inject, Post, Req } from '@nestjs/common';
import { WebhookService } from './webhook.service';

@Controller('webhook')
export class WebhookController {
  constructor(
    @Inject(WebhookService)
    private readonly webhookService: WebhookService,
  ) { }

  @Post('success')
  async handleSuccessWebhook(@Req() request: Request) {
    const event = request.body;

    console.log(event, request)
  }

  @Post('failure')
  async handleFailureWebhook(@Req() request: Request) {
    const event = request.body;

    console.log(event, request)
  }

  @Post('pending')
  async handlePendingWebhook(@Req() request: Request) {
    const event = request.body;

    console.log(event, request)
  }
}
