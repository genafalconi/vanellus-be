import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PreventDataDto, PreventTotalsDto } from 'src/data/client.dto';
import { EditPreventDto } from 'src/data/prevent.dto';
import { Prevent } from 'src/schema/prevent.schema';
import { Voucher } from 'src/schema/voucher.schema';

@Injectable()
export class PreventService {
  constructor(
    @InjectModel(Prevent.name)
    private readonly preventModel: Model<Prevent>,
    @InjectModel(Voucher.name)
    private readonly voucherModel: Model<Voucher>,
  ) { }

  async createPrevent(prevent: PreventDataDto): Promise<Prevent> {
    const preventCreated = new this.preventModel({
      name: prevent.name,
      price: prevent.price,
      active: prevent.active,
    });
    return await this.preventModel.create(preventCreated);
  }

  async getPrevents(): Promise<Array<PreventTotalsDto>> {
    const prevents = await this.preventModel.find();
    const result: Array<PreventTotalsDto> = [];

    for (const prev of prevents) {
      const vouchers = await this.voucherModel.find({
        prevent: new Types.ObjectId(prev._id as string),
      });
      const totalClients = vouchers.reduce(
        (total, voucher) => total + voucher.clients.length,
        0,
      );
      result.push({ prevent: prev, totalClients });
    }
    return result;
  }

  async getActivePrevent(): Promise<Prevent> {
    return await this.preventModel.findOne({ active: true });
  }

  async editEvent(preventId: string, eventData: EditPreventDto): Promise<Prevent> {
    const updatedEvent = await this.preventModel.findByIdAndUpdate(
      preventId,
      {
        $set: {
          name: eventData.name,
          price: eventData.price,
          active: eventData.active
        }
      },
      { new: true }
    );

    return updatedEvent;
  }
}
