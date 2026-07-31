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
      
    if (error) {
      console.error('Failed to log activity:', error)
    }
  } catch (err) {
    console.error('Activity logging error:', err)
  }
}
