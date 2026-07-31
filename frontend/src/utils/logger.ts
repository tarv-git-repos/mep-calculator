import { supabase } from '@/lib/supabase'

export type ActivityAction = 'LOGIN' | 'VIEW_CALCULATOR' | 'EXPORT' | 'LOGOUT' | 'UPDATE_SETTINGS'

export const logActivity = async (userId: string | undefined, action: ActivityAction, details: Record<string, any> = {}) => {
  if (!userId) return

  try {
    const { error } = await supabase
      .from('activity_logs')
      .insert([
        { 
          user_id: userId, 
          action_type: action, 
          details 
        }
      ])
      
    if (error && error.code !== '42501' && !error.message?.includes('401')) {
      console.warn('Failed to log activity (non-auth error):', error.message)
    }
  } catch (err) {
    // Silently ignore network/auth errors for activity logs to prevent console spam
  }
}
