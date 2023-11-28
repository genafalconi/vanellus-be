import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { auth } from 'firebase-admin';
import { firebaseApp } from './firebase.app';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException();
    }
    const idToken = authHeader.split(' ')[1];
    try {
      const decodedToken = await auth(firebaseApp).verifyIdToken(idToken);
      req.user = decodedToken.uid;
      return true;
    } catch (error) {
      throw new UnauthorizedException();
    }
  }
}
