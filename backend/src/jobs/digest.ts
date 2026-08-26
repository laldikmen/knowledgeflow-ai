import { runDailyDigest } from '../handlers/notifications';

// EventBridge-scheduled Lambda entry point. Runs the daily task digest:
// writes in-app notifications and emails each user their overdue/upcoming tasks.
export const handler = async () => {
  const result = await runDailyDigest();
  console.log('Daily digest complete:', JSON.stringify(result));
  return result;
};
