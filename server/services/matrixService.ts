import {
  getMatrixConfig,
  updateMatrixConfig,
  isMatrixEnabled,
  searchMatrixUsers,
  sendDirectMessage,
  testMatrixConnection,
  sendPollInvitation,
  type MatrixConfig,
  type MatrixUser,
  type MatrixSearchResult,
} from '../matrix';

export const matrixService = {
  getMatrixConfig,
  updateMatrixConfig,
  isMatrixEnabled,
  searchMatrixUsers,
  sendDirectMessage,
  testMatrixConnection,
  sendPollInvitation,
};

export type { MatrixConfig, MatrixUser, MatrixSearchResult };
