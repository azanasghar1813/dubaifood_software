import { apiClient } from './client';

export interface SyncStatus {
  pending: number;
  failed: number;
  synced: number;
  isRunning: boolean;
  nextRunDelay: number;
  deviceId?: string;
}

export interface ActiveDevice {
  id: string;
  name: string;
  ip: string;
  role: string;
  lastSeen: number;
  status: string;
}

export const syncApi = {
  getStatus: () => apiClient.get('/sync/status') as Promise<SyncStatus>,
  
  triggerSync: () => apiClient.post('/sync/trigger') as Promise<{ message: string, pushed?: number, pulled?: number }>,
  
  getActiveDevices: () => apiClient.get('/sync/devices') as Promise<ActiveDevice[]>
};
