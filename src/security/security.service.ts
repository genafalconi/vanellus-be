import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { LoginDto, SecurityDto } from 'src/data/login.dto';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { firebaseAuth, firebaseClientAuth } from 'src/firebase/firebase.app';

@Injectable()
export class SecurityService {
  async verifyToken(token: string): Promise<boolean> {
    try {
      token = token.split(' ')[1];
      if (token !== 'null') {
        const tokenValidation = await firebaseAuth.verifyIdToken(token);
        return !!tokenValidation;
      } else {
        return false;
      }
    } catch (error: any) {
      throw new HttpException(
        `Failed to verify token: ${error.message}`,
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  async getToken(loginDto: LoginDto): Promise<SecurityDto> {
    const { email, password } = loginDto;
    try {
      const userCredential = await signInWithEmailAndPassword(
        firebaseClientAuth,
        email,
        password,
      );
      const idToken = await userCredential.user.getIdToken();
      const refreshToken = userCredential.user.refreshToken;
      return { access_token: idToken, refresh_token: refreshToken };
    } catch (error: any) {
      throw new Error(`Failed to get token: ${error.message}`);
    }
  }
}