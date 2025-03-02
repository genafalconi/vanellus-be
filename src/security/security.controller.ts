import { Controller, Get, Post, Body, Req, Inject } from '@nestjs/common';
import { LoginDto, SecurityDto } from 'src/data/login.dto';
import { CustomRequest } from 'src/firebase/customRequest';
import { SecurityService } from './security.service';

@Controller('security')
export class SecurityController {
  constructor(
    @Inject(SecurityService)
    private readonly securityService: SecurityService
  ) {}

  @Get('/verify-token')
  async verifyTokenFirebase(@Req() req: CustomRequest): Promise<boolean> {
    return await this.securityService.verifyToken(req.headers.authorization);
  }

  @Post('/token')
  async getTokenFirebase(@Body() login: LoginDto): Promise<SecurityDto> {
    return await this.securityService.getToken(login);
  }
}
