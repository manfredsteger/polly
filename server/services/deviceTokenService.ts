import crypto from 'crypto';

const SECRET_KEY = process.env.SESSION_SECRET || 'device-token-secret-key-change-in-production';
const TOKEN_VERSION = 'v1';
const TOKEN_TTL_DAYS = 90;

interface DeviceTokenPayload {
  version: string;
  deviceId: string;
  userAgent: string;
  createdAt: number;
  expiresAt: number;
}

function generateHmac(data: string): string {
  return crypto.createHmac('sha256', SECRET_KEY).update(data).digest('hex');
}

function generateDeviceId(): string {
  return crypto.randomBytes(16).toString('hex');
}

export const deviceTokenService = {
  generateToken(userAgent: string): string {
    const now = Date.now();
    const payload: DeviceTokenPayload = {
      version: TOKEN_VERSION,
      deviceId: generateDeviceId(),
      userAgent: userAgent.substring(0, 200),
      createdAt: now,
      expiresAt: now + (TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    };
    
    const payloadStr = JSON.stringify(payload);
    const payloadBase64 = Buffer.from(payloadStr).toString('base64url');
    const signature = generateHmac(payloadBase64);
    
    return `${payloadBase64}.${signature}`;
  },

  verifyToken(token: string, userAgent?: string): { valid: boolean; deviceId?: string; payload?: DeviceTokenPayload } {
    try {
      const [payloadBase64, signature] = token.split('.');
      
      if (!payloadBase64 || !signature) {
        return { valid: false };
      }
      
      const expectedSignature = generateHmac(payloadBase64);
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return { valid: false };
      }
      
      const payloadStr = Buffer.from(payloadBase64, 'base64url').toString('utf8');
      const payload: DeviceTokenPayload = JSON.parse(payloadStr);
      
      if (payload.version !== TOKEN_VERSION) {
        return { valid: false };
      }
      
      if (Date.now() > payload.expiresAt) {
        return { valid: false };
      }
      
      return { 
        valid: true, 
        deviceId: payload.deviceId,
        payload,
      };
    } catch {
      return { valid: false };
    }
  },

  hashDeviceId(deviceId: string): string {
    return crypto.createHash('sha256').update(deviceId + SECRET_KEY).digest('hex').substring(0, 32);
  },

  getVoterKey(userId: number | null | undefined, deviceToken: string | undefined, userAgent?: string): { 
    voterKey: string; 
    voterSource: 'user' | 'device';
    newDeviceToken?: string;
  } {
    if (userId) {
      return {
        voterKey: `user:${userId}`,
        voterSource: 'user',
      };
    }
    
    if (deviceToken) {
      const verification = this.verifyToken(deviceToken, userAgent);
      if (verification.valid && verification.deviceId) {
        return {
          voterKey: `device:${this.hashDeviceId(verification.deviceId)}`,
          voterSource: 'device',
        };
      }
    }
    
    const newToken = this.generateToken(userAgent || 'unknown');
    const newVerification = this.verifyToken(newToken);
    
    return {
      voterKey: `device:${this.hashDeviceId(newVerification.deviceId!)}`,
      voterSource: 'device',
      newDeviceToken: newToken,
    };
  },

  getCookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.FORCE_HTTPS === 'true' || (process.env.NODE_ENV === 'production' && process.env.BASE_URL?.startsWith('https://')),
      sameSite: 'lax' as const,
      maxAge: TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
      path: '/',
    };
  },

  registerToken(userId: number, deviceToken: string): void {
    // Token registration is handled by cookie setting - this is a no-op placeholder
    console.log(`[DeviceToken] Token registered for user ${userId}`);
  },

  removeToken(userId: number, deviceToken: string): void {
    // Token removal is handled by cookie deletion - this is a no-op placeholder
    console.log(`[DeviceToken] Token removed for user ${userId}`);
  },
};
