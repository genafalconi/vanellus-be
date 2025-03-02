import { Body, Controller, Get, Inject, Param, Put } from '@nestjs/common';
import { Event } from 'src/schema/event.schema';
import { EventService } from './event.service';
import { EditEventData } from 'src/data/event.dto';

@Controller('event')
export class EventController {
  constructor(
    @Inject(EventService)
    private readonly eventService: EventService
  ) {}

  @Get()
  async getEventData(): Promise<Event> {
    return await this.eventService.getEvent();
  }

  @Put(':id')
  async editEventData(
    @Param('id') eventId: string,
    @Body() eventData: EditEventData
  ): Promise<Event> {
    return await this.eventService.editEvent(eventId, eventData);
  }
}
