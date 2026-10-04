// Enhanced Chat API for MedSync
// Features: Real-time messaging, file sharing, typing indicators, notifications

import { createClient } from '@/lib/supabase'

export interface ChatMessage {
  id: string
  content: string
  sender_id: string
  sender_name: string
  sender_role: string
  receiver_id: string
  receiver_name: string
  receiver_role: string
  created_at: string
  is_read?: boolean
  message_type?: 'text' | 'file' | 'image' | 'report'
  file_url?: string
  file_name?: string
  file_size?: number
}

export interface TypingStatus {  
  user_id: string
  user_name: string
  is_typing: boolean
  timestamp: string
}

export interface ChatNotification {
  id: string
  title: string
  message: string
  type: 'message' | 'file' | 'report' | 'urgent'
  sender_id: string
  receiver_id: string
  created_at: string
  is_read: boolean
}

class ChatAPI {
  private supabase = createClient()
  private typingTimeouts = new Map<string, NodeJS.Timeout>()

  // Send a text message
  async sendMessage(message: Omit<ChatMessage, 'id' | 'created_at'>): Promise<ChatMessage | null> {
    try {
      const { data, error } = await this.supabase
        .from('messages')
        .insert({
          content: message.content,
          sender_id: message.sender_id,
          sender_name: message.sender_name,
          sender_role: message.sender_role,
          receiver_id: message.receiver_id,
          receiver_name: message.receiver_name,
          receiver_role: message.receiver_role,
          message_type: message.message_type || 'text',
          file_url: message.file_url,
          file_name: message.file_name,
          file_size: message.file_size,
          is_read: false
        })
        .select()
        .single()

      if (error) {
        console.error('Error sending message:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error sending message:', error)
      return null
    }
  }

  // Send a file message
  async sendFile(
    file: File,
    sender_id: string,
    sender_name: string,
    sender_role: string,
    receiver_id: string,
    receiver_name: string,
    receiver_role: string
  ): Promise<ChatMessage | null> {
    try {
      // Upload file to Supabase Storage
      const fileName = `chat-files/${Date.now()}-${file.name}`
      const { data: uploadData, error: uploadError } = await this.supabase.storage
        .from('chat-files')
        .upload(fileName, file)

      if (uploadError) {
        console.error('Error uploading file:', uploadError)
        return null
      }

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from('chat-files')
        .getPublicUrl(fileName)

      // Send message with file info
      const messageData = {
        content: `Sent: ${file.name}`,
        sender_id,
        sender_name,
        sender_role,
        receiver_id,
        receiver_name,
        receiver_role,
        message_type: 'file' as const,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size
      }

      return await this.sendMessage(messageData)
    } catch (error) {
      console.error('Error sending file:', error)
      return null
    }
  }

  // Get messages between two users
  async getMessages(user1_id: string, user2_id: string): Promise<ChatMessage[]> {
    try {
      const { data, error } = await this.supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user1_id},receiver_id.eq.${user2_id}),and(sender_id.eq.${user2_id},receiver_id.eq.${user1_id})`)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error loading messages:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error loading messages:', error)
      return []
    }
  }

  // Mark messages as read
  async markMessagesAsRead(sender_id: string, receiver_id: string): Promise<void> {
    try {
      await this.supabase
        .from('messages')
        .update({ is_read: true })
        .eq('sender_id', sender_id)
        .eq('receiver_id', receiver_id)
        .eq('is_read', false)
    } catch (error) {
      console.error('Error marking messages as read:', error)
    }
  }

  // Get unread message count
  async getUnreadCount(user_id: string): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user_id)
        .eq('is_read', false)

      if (error) {
        console.error('Error getting unread count:', error)
        return 0
      }

      return count || 0
    } catch (error) {
      console.error('Error getting unread count:', error)
      return 0
    }
  }

  // Set typing status
  async setTypingStatus(user_id: string, user_name: string, is_typing: boolean): Promise<void> {
    try {
      // Clear existing timeout
      const existingTimeout = this.typingTimeouts.get(user_id)
      if (existingTimeout) {
        clearTimeout(existingTimeout)
      }

      // Set new timeout to stop typing after 3 seconds
      if (is_typing) {
        const timeout = setTimeout(() => {
          this.setTypingStatus(user_id, user_name, false)
        }, 3000)
        this.typingTimeouts.set(user_id, timeout)
      }

      // Update typing status in database
      await this.supabase
        .from('typing_status')
        .upsert({
          user_id,
          user_name,
          is_typing,
          timestamp: new Date().toISOString()
        })
    } catch (error) {
      console.error('Error setting typing status:', error)
    }
  }

  // Get typing status for a user
  async getTypingStatus(user_id: string): Promise<TypingStatus | null> {
    try {
      const { data, error } = await this.supabase
        .from('typing_status')
        .select('*')
        .eq('user_id', user_id)
        .single()

      if (error) {
        return null
      }

      return data
    } catch (error) {
      console.error('Error getting typing status:', error)
      return null
    }
  }

  // Send notification
  async sendNotification(notification: Omit<ChatNotification, 'id' | 'created_at'>): Promise<void> {
    try {
      await this.supabase
        .from('chat_notifications')
        .insert({
          title: notification.title,
          message: notification.message,
          type: notification.type,
          sender_id: notification.sender_id,
          receiver_id: notification.receiver_id,
          is_read: false
        })
    } catch (error) {
      console.error('Error sending notification:', error)
    }
  }

  // Get notifications for a user
  async getNotifications(user_id: string): Promise<ChatNotification[]> {
    try {
      const { data, error } = await this.supabase
        .from('chat_notifications')
        .select('*')
        .eq('receiver_id', user_id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading notifications:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error loading notifications:', error)
      return []
    }
  }

  // Mark notification as read
  async markNotificationAsRead(notification_id: string): Promise<void> {
    try {
      await this.supabase
        .from('chat_notifications')
        .update({ is_read: true })
        .eq('id', notification_id)
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  // Subscribe to real-time updates
  subscribeToMessages(user_id: string, callback: (message: ChatMessage) => void) {
    return this.supabase
      .channel('messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, (payload: any) => {
        const message = payload.new as ChatMessage
        if (message.receiver_id === user_id || message.sender_id === user_id) {
          callback(message)
        }
      })
      .subscribe()
  }

  // Subscribe to typing status
  subscribeToTypingStatus(callback: (status: TypingStatus) => void) {
    return this.supabase
      .channel('typing_status')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'typing_status'
      }, (payload: any) => {
        const status = payload.new as TypingStatus
        callback(status)
      })
      .subscribe()
  }

  // Subscribe to notifications
  subscribeToNotifications(user_id: string, callback: (notification: ChatNotification) => void) {
    return this.supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_notifications',
        filter: `receiver_id=eq.${user_id}`
      }, (payload: any) => {
        const notification = payload.new as ChatNotification
        callback(notification)
      })
      .subscribe()
  }

  // Cleanup typing timeouts
  cleanup() {
    this.typingTimeouts.forEach(timeout => clearTimeout(timeout))
    this.typingTimeouts.clear()
  }
}

// Export singleton instance
export const chatAPI = new ChatAPI()

// Helper functions
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export const isImageFile = (fileName: string): boolean => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
  const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
  return imageExtensions.includes(extension)
}

export const getFileIcon = (fileName: string): string => {
  const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
  
  if (isImageFile(fileName)) return '🖼️'
  if (extension === '.pdf') return '📄'
  if (extension === '.doc' || extension === '.docx') return '📝'
  if (extension === '.xls' || extension === '.xlsx') return '📊'
  if (extension === '.ppt' || extension === '.pptx') return '��'
  return '📎'
} 