import { apiClient } from './client';

export interface LanLog {
  timestamp: string;
  message: string;
  level: 'info' | 'warn' | 'error';
}

export interface LanStatus {
  isRetrying: boolean;
  pendingOrders: number;
  pendingPrints: number;
  logs: LanLog[];
  deviceRole: 'HUB' | 'TERMINAL';
  hubIp: string;
  hubPort: number;
  deviceId?: string;
}

export const lanApi = {
  getStatus: async (): Promise<LanStatus> => {
    const res: any = await apiClient.get('/lan/status');
    return res?.data || res;
  },
  syncMasterData: async (): Promise<any> => {
    const res: any = await apiClient.post('/lan/sync-master-data');
    return res?.data || res;
  }
};
