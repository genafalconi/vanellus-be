import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EditEventData } from 'src/data/event.dto';
import { Event } from 'src/schema/event.schema';

@Injectable()
export class EventService {
  constructor(
    @InjectModel(Event.name)
    private readonly eventModel: Model<Event>,
  ) { }

  async getEvent(): Promise<Event> {
    return await this.eventModel.findOne({ active: true })
      .populate({ path: 'prevents', model: 'Prevent' });
    ;
  }

  async editEvent(eventId: string, eventData: EditEventData): Promise<Event> {
    const updatedEvent = await this.eventModel.findByIdAndUpdate(
      eventId,
      {
        $set: {
          name: eventData.name,
          number: eventData.number,
          date: eventData.date,
          hours: eventData.hours,
          bar: eventData.bar,
          venue: eventData.venue,
          active: eventData.active
        }
      },
      { new: true }
    ).populate({ path: 'prevents', model: 'Prevent' });

    return updatedEvent;
  }

}
