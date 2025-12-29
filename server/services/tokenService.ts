import * as client from 'openid-client';
import { storage } from '../storage';
import type { User } from '@shared/schema';

interface TokenValidationResult {
  valid: boolean;
  userId?: number;
  user?: User;
  error?: string;
  errorCode?: string;
}

interface KeycloakTokenClaims {
  sub: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  exp?: number;
  iat?: number;
  aud?: string | string[];
  iss?: string;
  active?: boolean;
  role?: string;
  roles?: string[];
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
}

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

// Extract role from Keycloak token claims (same logic as authService)
function extractRoleFromClaims(claims: KeycloakTokenClaims): PollyRole | null {
  const validRoles: PollyRole[] = ['admin', 'manager', 'user'];
  
  // Priority 1: Check for direct 'role' claim (custom mapper)
  if (typeof claims.role === 'string') {
    const normalizedRole = normalizeRoleName(claims.role);
    if (normalizedRole) return normalizedRole;
  }
  
  // Priority 2: Check realm_access.roles (Keycloak realm roles)
  if (claims.realm_access?.roles) {
    for (const role of validRoles) {
      if (claims.realm_access.roles.includes(role) || claims.realm_access.roles.includes(`polly-${role}`)) {
        return role;
      }
    }
  }
  
  // Priority 3: Check resource_access[client].roles (Keycloak client roles)
  if (claims.resource_access) {
    for (const clientRoles of Object.values(claims.resource_access)) {
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
  
  return null;
}

let oidcConfig: client.Configuration | null = null;
let initializationAttempted = false;

function getKeycloakConfig() {
  const realm = process.env.KEYCLOAK_REALM;
  const clientId = process.env.KEYCLOAK_CLIENT_ID;
  const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET;
  const serverUrl = process.env.KEYCLOAK_URL || process.env.KEYCLOAK_AUTH_SERVER_URL;

  if (!realm || !clientId || !serverUrl) {
    return null;
  }

  return { realm, clientId, clientSecret, serverUrl };
}

export const tokenService = {
  async initializeOIDC(): Promise<boolean> {
    if (initializationAttempted) {
      return oidcConfig !== null;
    }
    initializationAttempted = true;

    const config = getKeycloakConfig();
    if (!config) {
      console.log('Keycloak not configured - Bearer token validation disabled');
      return false;
    }

    try {
      const issuerUrl = new URL(`${config.serverUrl}/realms/${config.realm}`);
      oidcConfig = await client.discovery(issuerUrl, config.clientId, config.clientSecret);
      console.log('OIDC token validation initialized for Bearer auth');
      return true;
    } catch (error) {
      console.error('Failed to initialize OIDC for token validation:', error);
      return false;
    }
  },

  isOIDCEnabled(): boolean {
    return oidcConfig !== null;
  },

  extractBearerToken(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  },

  async validateAccessToken(accessToken: string): Promise<TokenValidationResult> {
    if (!oidcConfig) {
      if (!initializationAttempted) {
        await this.initializeOIDC();
      }
      if (!oidcConfig) {
        return { 
          valid: false, 
          error: 'OIDC not configured', 
          errorCode: 'OIDC_NOT_CONFIGURED' 
        };
      }
    }

    try {
      const config = getKeycloakConfig();
      if (!config) {
        return { 
          valid: false, 
          error: 'Keycloak config missing', 
          errorCode: 'CONFIG_MISSING' 
        };
      }

      const introspectionResponse = await client.tokenIntrospection(
        oidcConfig,
        accessToken
      );

      const claims = introspectionResponse as unknown as KeycloakTokenClaims;

      if (!claims.active) {
        return { 
          valid: false, 
          error: 'Token is not active', 
          errorCode: 'TOKEN_INACTIVE' 
        };
      }

      if (!claims.sub || !claims.email) {
        return { 
          valid: false, 
          error: 'Missing required claims (sub, email)', 
          errorCode: 'MISSING_CLAIMS' 
        };
      }

      if (claims.exp && Date.now() / 1000 > claims.exp) {
        return { 
          valid: false, 
          error: 'Token expired', 
          errorCode: 'TOKEN_EXPIRED' 
        };
      }

      // Extract role from token claims
      const keycloakRole = extractRoleFromClaims(claims);
      
      let user = await storage.getUserByKeycloakId(claims.sub);
      
      if (!user) {
        user = await storage.getUserByEmail(claims.email);
        
        if (user && !user.keycloakId) {
          // Update existing user with Keycloak ID and sync role
          const updateData: Record<string, any> = { 
            keycloakId: claims.sub,
            provider: 'keycloak',
          };
          if (keycloakRole) {
            updateData.role = keycloakRole;
          }
          user = await storage.updateUser(user.id, updateData);
        }
      }
      
      if (!user) {
        const username = claims.preferred_username || claims.email?.split('@')[0] || claims.sub;
        const name = claims.name || claims.preferred_username || claims.email;
        
        user = await storage.createUser({
          username,
          email: claims.email,
          name: name || username,
          role: keycloakRole || 'user',
          keycloakId: claims.sub,
          provider: 'keycloak',
        });
      } else {
        // Sync role from Keycloak on every API call (if role is provided in token)
        if (keycloakRole && user.role !== keycloakRole) {
          user = await storage.updateUser(user.id, { role: keycloakRole });
        }
      }

      if (!user) {
        return { 
          valid: false, 
          error: 'Failed to find or create user', 
          errorCode: 'USER_NOT_FOUND' 
        };
      }

      await storage.updateUserLastLogin(user.id);

      return {
        valid: true,
        userId: user.id,
        user,
      };
    } catch (error) {
      console.error('Token validation error:', error);
      return { 
        valid: false, 
        error: 'Token validation failed', 
        errorCode: 'VALIDATION_FAILED' 
      };
    }
  },

  async validateToken(accessToken: string): Promise<TokenValidationResult> {
    return this.validateAccessToken(accessToken);
  },
};
