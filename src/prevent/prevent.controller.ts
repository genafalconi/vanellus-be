import { Body, Controller, Get, Inject, Param, Post, Put } from '@nestjs/common';
import { PreventService } from './prevent.service';
import { PreventDataDto, PreventTotalsDto } from 'src/data/client.dto';
import { Prevent } from 'src/schema/prevent.schema';
import { EditPreventDto } from 'src/data/prevent.dto';

@Controller('prevent')
export class PreventController {
  constructor(
    @Inject(PreventService)
    private readonly preventService: PreventService,
  ) { }

  @Post('/createPrevent')
  async createPrevent(@Body() prevent: PreventDataDto): Promise<Prevent> {
    return await this.preventService.createPrevent(prevent);
  }

  @Get('/getPrevents')
  async getPrevents(): Promise<Array<PreventTotalsDto>> {
    return await this.preventService.getPrevents();
  }

  @Get('/get-active-prevent')
  async getActivePrevent(): Promise<Prevent> {
    return await this.preventService.getActivePrevent();
  }

  @Put('/edit/:id')
  async editEventData(
    @Param('id') preventId: string,
    @Body() preventData: EditPreventDto
  ): Promise<Prevent> {
    return await this.preventService.editEvent(preventId, preventData);
  }
}
