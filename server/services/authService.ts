import * as client from 'openid-client';
import bcrypt from 'bcryptjs';
import { storage } from '../storage';
import type { User } from '@shared/schema';

let oidcConfig: client.Configuration | null = null;

// Valid roles in Polly system
type PollyRole = 'user' | 'manager' | 'admin';

// Normalize role name (supports both 'admin' and 'polly-admin' formats)
function normalizeRoleName(roleName: string): PollyRole | null {
  const validRoles: PollyRole[] = ['admin', 'manager', 'user'];
  
  // Direct match
  if (validRoles.includes(roleName as PollyRole)) {
    return roleName as PollyRole;
  }
  
  // Match with polly- prefix
  for (const role of validRoles) {
    if (roleName === `polly-${role}`) {
      return role;
    }
  }
  
  return null;
}

// Extract role from Keycloak token claims
// Supports: realm_access.roles, resource_access[client].roles, and custom 'role'/'roles' claim
function extractRoleFromClaims(claims: Record<string, unknown>): PollyRole | null {
  const validRoles: PollyRole[] = ['admin', 'manager', 'user'];
  
  // Priority 1: Check for direct 'role' claim (custom mapper)
  if (typeof claims.role === 'string') {
    const normalizedRole = normalizeRoleName(claims.role);
    if (normalizedRole) return normalizedRole;
  }
  
  // Priority 2: Check realm_access.roles (Keycloak realm roles)
  const realmAccess = claims.realm_access as { roles?: string[] } | undefined;
  if (realmAccess?.roles) {
    // Check in order of privilege (admin > manager > user)
    for (const role of validRoles) {
      if (realmAccess.roles.includes(role) || realmAccess.roles.includes(`polly-${role}`)) {
        return role;
      }
    }
  }
  
  // Priority 3: Check resource_access[client].roles (Keycloak client roles)
  const resourceAccess = claims.resource_access as Record<string, { roles?: string[] }> | undefined;
  if (resourceAccess) {
    // Check all clients for matching roles
    for (const clientRoles of Object.values(resourceAccess)) {
      if (clientRoles?.roles) {
        for (const role of validRoles) {
          if (clientRoles.roles.includes(role) || clientRoles.roles.includes(`polly-${role}`)) {
            return role;
          }
        }
      }
    }
  }
  
  // Priority 4: Check 'roles' array claim (custom mapper with array)
  if (Array.isArray(claims.roles)) {
    for (const role of validRoles) {
      if (claims.roles.includes(role) || claims.roles.includes(`polly-${role}`)) {
        return role;
      }
    }
  }
  
  return null; // No matching role found, will default to 'user'
}

interface KeycloakConfig {
  realm: string;
  serverUrl: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
}

const getKeycloakConfig = (): KeycloakConfig | null => {
  const realm = process.env.KEYCLOAK_REALM;
  const serverUrl = process.env.KEYCLOAK_URL;
  const clientId = process.env.KEYCLOAK_CLIENT_ID;
  const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET;

  if (!realm || !serverUrl || !clientId) {
    return null;
  }

  const baseUrl = process.env.BASE_URL 
    || (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : null)
    || 'http://localhost:5000';

  return {
    realm,
    serverUrl,
    clientId,
    clientSecret,
    redirectUri: `${baseUrl}/api/v1/auth/keycloak/callback`
  };
};

export const authService = {
  async initializeKeycloak(): Promise<boolean> {
    const config = getKeycloakConfig();
    if (!config) {
      console.log('Keycloak not configured - OIDC login disabled');
      return false;
    }

    try {
      const issuerUrl = new URL(`${config.serverUrl}/realms/${config.realm}`);
      oidcConfig = await client.discovery(issuerUrl, config.clientId, config.clientSecret);
      console.log('Keycloak OIDC client initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Keycloak client:', error);
      return false;
    }
  },

  isKeycloakEnabled(): boolean {
    return oidcConfig !== null;
  },

  getKeycloakAuthUrl(state: string): { url: string; codeVerifier: string } | null {
    if (!oidcConfig) return null;

    const config = getKeycloakConfig();
    if (!config) return null;

    const codeVerifier = client.randomPKCECodeVerifier();
    const codeChallenge = client.calculatePKCECodeChallenge(codeVerifier);
    
    const parameters: Record<string, string> = {
      redirect_uri: config.redirectUri,
      scope: 'openid email profile',
      state,
      code_challenge: codeChallenge as unknown as string,
      code_challenge_method: 'S256',
    };

    const redirectTo = client.buildAuthorizationUrl(oidcConfig, parameters);
    
    return { url: redirectTo.href, codeVerifier };
  },

  async initiateKeycloakLogin(req: any): Promise<{ authUrl: string; codeVerifier: string; state: string }> {
    const state = Math.random().toString(36).substring(7);
    const result = this.getKeycloakAuthUrl(state);
    if (!result) {
      throw new Error('Keycloak not configured');
    }
    return {
      authUrl: result.url,
      codeVerifier: result.codeVerifier,
      state,
    };
  },

  async handleKeycloakCallback(code: string, codeVerifier: string, req?: any): Promise<User | null> {
    if (!oidcConfig) return null;

    const config = getKeycloakConfig();
    if (!config) return null;

    try {
      const currentUrl = new URL(`${config.redirectUri}?code=${code}`);
      
      const tokens = await client.authorizationCodeGrant(oidcConfig, currentUrl, {
        pkceCodeVerifier: codeVerifier,
        expectedState: undefined,
      });

      const claims = tokens.claims();
      if (!claims) {
        console.error('No claims in token');
        return null;
      }

      const keycloakId = claims.sub;
      const email = claims.email as string;
      const name = claims.name as string || claims.preferred_username as string || email;
      const username = claims.preferred_username as string || email?.split('@')[0];
      
      // Extract role from Keycloak token claims
      // Supports realm_access.roles and resource_access[client].roles
      const keycloakRole = extractRoleFromClaims(claims);

      if (!keycloakId || !email) {
        console.error('Missing required claims:', { keycloakId, email });
        return null;
      }

      let user = await storage.getUserByKeycloakId(keycloakId);
      
      if (!user) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser) {
          // Update existing user with Keycloak ID and sync role from token
          const updateData: Record<string, any> = {
            keycloakId,
            provider: 'keycloak',
          };
          // Only update role if Keycloak provides one
          if (keycloakRole) {
            updateData.role = keycloakRole;
          }
          user = await storage.updateUser(existingUser.id, updateData);
          await storage.updateUserLastLogin(user.id);
        } else {
          user = await storage.createUser({
            username,
            email,
            name,
            role: keycloakRole || 'user',
            keycloakId,
            provider: 'keycloak',
          });
          await storage.updateUserLastLogin(user.id);
        }
      } else {
        // Sync role from Keycloak on every login (if role is provided in token)
        if (keycloakRole && user.role !== keycloakRole) {
          user = await storage.updateUser(user.id, { role: keycloakRole });
        }
        await storage.updateUserLastLogin(user.id);
      }

      return user;
    } catch (error) {
      console.error('Keycloak callback error:', error);
      return null;
    }
  },

  async localLogin(usernameOrEmail: string, password: string, isTestMode: boolean = false): Promise<User | null> {
    let user = await storage.getUserByUsername(usernameOrEmail);
    if (!user) {
      user = await storage.getUserByEmail(usernameOrEmail);
    }

    if (!user || !user.passwordHash) {
      return null;
    }

    // Block login for test accounts (unless in test mode)
    if (user.isTestData && !isTestMode) {
      console.log(`[Auth] Blocked login attempt for test account: ${user.email}`);
      return null;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return null;
    }

    await storage.updateUserLastLogin(user.id);
    return user;
  },

  async localRegister(username: string, email: string, name: string, password: string, isTestMode: boolean = false): Promise<User | null> {
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      return null;
    }

    const existingUsername = await storage.getUserByUsername(username);
    if (existingUsername) {
      return null;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await storage.createUser({
      username,
      email,
      name,
      role: 'user',
      passwordHash,
      provider: 'local',
      isTestData: isTestMode,
    });

    return user;
  },

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  },

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  },

  sanitizeUser(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash, ...safeUser } = user as User & { passwordHash?: string };
    return safeUser;
  }
};
