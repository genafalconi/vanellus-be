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
    // 1. Get all prevents
    const prevents = await this.preventModel.find();
    const result: Array<PreventTotalsDto> = [];
  
    // 2. For each prevent, find its vouchers
    for (const prev of prevents) {
      const vouchers = await this.voucherModel.find({
        prevent: new Types.ObjectId(prev._id as string),
      });
  
      // 3. Calculate total clients
      const totalClients = vouchers.reduce(
        (sum, voucher) => sum + voucher.clients.length,
        0,
      );
  
      // 4. Calculate total price (summing the 'total' field of each voucher)
      const totalPrice = vouchers.reduce(
        (sum, voucher) => sum + voucher.total,
        0,
      );
  
      // 5. Push an object with prevent, totalClients, and totalPrice
      result.push({
        prevent: prev,
        totalClients,
        totalPrice,
      });
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
