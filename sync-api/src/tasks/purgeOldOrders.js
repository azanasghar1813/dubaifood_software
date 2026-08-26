import cron from 'node-cron';
import { supabase } from '../config/supabaseClient.js';

export const startCronJobs = () => {
  // Run every night at 3:00 AM
  cron.schedule('0 3 * * *', async () => {
    console.log('[Cron] Starting 30-day order purge...');
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const isoDate = thirtyDaysAgo.toISOString();
      
      const { data, error } = await supabase
        .from('orders')
        .delete()
        .eq('status', 'COMPLETED')
        .lt('created_at', isoDate);
        
      if (error) {
        throw error;
      }
      
      console.log(`[Cron] Successfully purged old completed orders before ${isoDate}`);
    } catch (err) {
      console.error('[Cron] Error purging old orders:', err.message);
    }
  });
};
