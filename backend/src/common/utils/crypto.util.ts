import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class CryptoUtil {
  async hashPassword(password: string): Promise<string> {
    const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 10);
    return bcrypt.hash(password, saltRounds);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
