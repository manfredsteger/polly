import * as sdk from 'matrix-js-sdk';

export interface MatrixConfig {
  enabled: boolean;
  homeserverUrl: string;
  botUserId: string;
  botAccessToken: string;
  searchEnabled: boolean;
}

export interface MatrixUser {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface MatrixSearchResult {
  results: MatrixUser[];
  limited: boolean;
}

const defaultConfig: MatrixConfig = {
  enabled: false,
  homeserverUrl: '',
  botUserId: '',
  botAccessToken: '',
  searchEnabled: true,
};

let matrixClient: sdk.MatrixClient | null = null;
let currentConfig: MatrixConfig = { ...defaultConfig };

export function getMatrixConfig(): MatrixConfig {
  return { ...currentConfig };
}

export function updateMatrixConfig(config: Partial<MatrixConfig>): void {
  currentConfig = { ...currentConfig, ...config };
  
  if (currentConfig.enabled && currentConfig.homeserverUrl && currentConfig.botAccessToken && currentConfig.botUserId) {
    try {
      matrixClient = sdk.createClient({
        baseUrl: currentConfig.homeserverUrl,
        accessToken: currentConfig.botAccessToken,
        userId: currentConfig.botUserId,
      });
      console.log('[Matrix] Client configured for', currentConfig.homeserverUrl);
    } catch (error) {
      console.error('[Matrix] Failed to create client:', error);
      matrixClient = null;
    }
  } else {
    matrixClient = null;
    if (!currentConfig.enabled) {
      console.log('[Matrix] Integration disabled');
    }
  }
}

export function isMatrixEnabled(): boolean {
  return currentConfig.enabled && matrixClient !== null;
}

export async function searchMatrixUsers(searchTerm: string, limit: number = 10): Promise<MatrixSearchResult> {
  if (!matrixClient) {
    throw new Error('Matrix client not configured');
  }

  if (!currentConfig.searchEnabled) {
    throw new Error('Matrix user search is disabled');
  }

  try {
    const response = await matrixClient.searchUserDirectory({
      term: searchTerm,
      limit,
    });

    const results: MatrixUser[] = response.results.map((user: any) => ({
      userId: user.user_id,
      displayName: user.display_name || null,
      avatarUrl: user.avatar_url || null,
    }));

    return {
      results,
      limited: response.limited || false,
    };
  } catch (error: any) {
    console.error('[Matrix] User search failed:', error.message);
    throw new Error(`Matrix user search failed: ${error.message}`);
  }
}

export async function sendDirectMessage(
  recipientUserId: string,
  message: string,
  htmlMessage?: string
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  if (!matrixClient) {
    return { success: false, error: 'Matrix client not configured' };
  }

  try {
    let roomId = await findExistingDMRoom(recipientUserId);
    
    if (!roomId) {
      const room = await matrixClient.createRoom({
        preset: 'trusted_private_chat' as any,
        invite: [recipientUserId],
        is_direct: true,
        initial_state: [],
      });
      roomId = room.room_id;
      console.log('[Matrix] Created new DM room:', roomId, 'with', recipientUserId);
    }

    const content: any = {
      msgtype: 'm.text',
      body: message,
    };

    if (htmlMessage) {
      content.format = 'org.matrix.custom.html';
      content.formatted_body = htmlMessage;
    }

    const response = await matrixClient.sendMessage(roomId, content);
    
    console.log('[Matrix] Message sent to', recipientUserId, 'event:', response.event_id);
    return { success: true, eventId: response.event_id };
  } catch (error: any) {
    console.error('[Matrix] Failed to send message to', recipientUserId, ':', error.message);
    return { success: false, error: error.message };
  }
}

async function findExistingDMRoom(userId: string): Promise<string | null> {
  if (!matrixClient) return null;

  try {
    const accountData = await matrixClient.getAccountDataFromServer('m.direct' as any);
    if (accountData && (accountData as any)[userId]) {
      const rooms = (accountData as any)[userId];
      if (rooms && rooms.length > 0) {
        return rooms[0];
      }
    }
  } catch (error) {
    // No existing DM found, will create new one
  }
  
  return null;
}

export async function testMatrixConnection(): Promise<{ success: boolean; error?: string; userId?: string }> {
  if (!matrixClient) {
    return { success: false, error: 'Matrix client not configured' };
  }

  try {
    const whoami = await matrixClient.whoami();
    return { 
      success: true, 
      userId: whoami.user_id 
    };
  } catch (error: any) {
    return { 
      success: false, 
      error: error.message || 'Connection test failed' 
    };
  }
}

export async function sendPollInvitation(
  recipientUserIds: string[],
  pollTitle: string,
  pollUrl: string,
  customMessage?: string
): Promise<{ sent: string[]; failed: Array<{ userId: string; error: string }> }> {
  const sent: string[] = [];
  const failed: Array<{ userId: string; error: string }> = [];

  const baseMessage = customMessage 
    ? `${customMessage}\n\n`
    : '';
  
  const textMessage = `${baseMessage}📊 Einladung zur Abstimmung: ${pollTitle}\n\nLink: ${pollUrl}`;
  const htmlMessage = `${baseMessage.replace(/\n/g, '<br>')}<p>📊 <strong>Einladung zur Abstimmung:</strong> ${pollTitle}</p><p><a href="${pollUrl}">Hier abstimmen</a></p>`;

  for (const userId of recipientUserIds) {
    const result = await sendDirectMessage(userId, textMessage, htmlMessage);
    if (result.success) {
      sent.push(userId);
    } else {
      failed.push({ userId, error: result.error || 'Unknown error' });
    }
  }

  return { sent, failed };
}
