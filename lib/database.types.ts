
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "appointments": {
                  Row: {
                    "appointment_date": string,"appointment_type": string | null,"completed_at": string | null,"consultation_type": string | null,"created_at": string | null,"diagnosis": string | null,"doctor_id": string,"doctor_name": string | null,"duration_minutes": number | null,"end_time": string,"id": string,"is_demo": boolean | null,"notes": string | null,"patient_id": string,"patient_name": string | null,"prescription": string | null,"scheduled_at": string | null,"start_time": string,"status": string | null,"symptoms": string | null,"type": string | null,"updated_at": string | null
                  }
                  Insert: {
                    "appointment_date": string,"appointment_type"?: string | null,"completed_at"?: string | null,"consultation_type"?: string | null,"created_at"?: string | null,"diagnosis"?: string | null,"doctor_id": string,"doctor_name"?: string | null,"duration_minutes"?: number | null,"end_time": string,"id"?: string,"is_demo"?: boolean | null,"notes"?: string | null,"patient_id": string,"patient_name"?: string | null,"prescription"?: string | null,"scheduled_at"?: string | null,"start_time": string,"status"?: string | null,"symptoms"?: string | null,"type"?: string | null,"updated_at"?: string | null
                  }
                  Update: {
                    "appointment_date"?: string,"appointment_type"?: string | null,"completed_at"?: string | null,"consultation_type"?: string | null,"created_at"?: string | null,"diagnosis"?: string | null,"doctor_id"?: string,"doctor_name"?: string | null,"duration_minutes"?: number | null,"end_time"?: string,"id"?: string,"is_demo"?: boolean | null,"notes"?: string | null,"patient_id"?: string,"patient_name"?: string | null,"prescription"?: string | null,"scheduled_at"?: string | null,"start_time"?: string,"status"?: string | null,"symptoms"?: string | null,"type"?: string | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"chat_channels": {
                  Row: {
                    "channel_type": string | null,"created_at": string | null,"created_by": string | null,"id": string,"is_active": boolean | null,"name": string,"participants": (string)[],"updated_at": string | null
                  }
                  Insert: {
                    "channel_type"?: string | null,"created_at"?: string | null,"created_by"?: string | null,"id"?: string,"is_active"?: boolean | null,"name": string,"participants": (string)[],"updated_at"?: string | null
                  }
                  Update: {
                    "channel_type"?: string | null,"created_at"?: string | null,"created_by"?: string | null,"id"?: string,"is_active"?: boolean | null,"name"?: string,"participants"?: (string)[],"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"chat_messages": {
                  Row: {
                    "attachment_name": string | null,"attachment_url": string | null,"channel_id": string | null,"content": string,"created_at": string | null,"id": string,"is_read": boolean | null,"message_type": string | null,"sender_id": string | null,"sender_name": string,"sender_role": string
                  }
                  Insert: {
                    "attachment_name"?: string | null,"attachment_url"?: string | null,"channel_id"?: string | null,"content": string,"created_at"?: string | null,"id"?: string,"is_read"?: boolean | null,"message_type"?: string | null,"sender_id"?: string | null,"sender_name": string,"sender_role": string
                  }
                  Update: {
                    "attachment_name"?: string | null,"attachment_url"?: string | null,"channel_id"?: string | null,"content"?: string,"created_at"?: string | null,"id"?: string,"is_read"?: boolean | null,"message_type"?: string | null,"sender_id"?: string | null,"sender_name"?: string,"sender_role"?: string
                  }
                  Relationships: [
                    
                  ]
                },"chat_notifications": {
                  Row: {
                    "created_at": string | null,"id": string,"last_message_at": string | null,"message_preview": string | null,"sender_id": string,"unread_count": number | null,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string | null,"id"?: string,"last_message_at"?: string | null,"message_preview"?: string | null,"sender_id": string,"unread_count"?: number | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string | null,"id"?: string,"last_message_at"?: string | null,"message_preview"?: string | null,"sender_id"?: string,"unread_count"?: number | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"consultation_meetings": {
                  Row: {
                    "appointment_id": string,"created_at": string | null,"host_id": string,"id": string,"is_active": boolean | null,"meeting_id": string,"password": string,"updated_at": string | null
                  }
                  Insert: {
                    "appointment_id": string,"created_at"?: string | null,"host_id": string,"id"?: string,"is_active"?: boolean | null,"meeting_id": string,"password": string,"updated_at"?: string | null
                  }
                  Update: {
                    "appointment_id"?: string,"created_at"?: string | null,"host_id"?: string,"id"?: string,"is_active"?: boolean | null,"meeting_id"?: string,"password"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "consultation_meetings_appointment_id_fkey"
      columns: ["appointment_id"]
isOneToOne: true
      referencedRelation: "appointments"
      referencedColumns: ["id"]
    }
                  ]
                },"doctor_availability": {
                  Row: {
                    "created_at": string | null,"day_of_week": number,"doctor_id": string,"end_time": string,"id": string,"is_available": boolean | null,"start_time": string,"updated_at": string | null
                  }
                  Insert: {
                    "created_at"?: string | null,"day_of_week": number,"doctor_id": string,"end_time": string,"id"?: string,"is_available"?: boolean | null,"start_time": string,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string | null,"day_of_week"?: number,"doctor_id"?: string,"end_time"?: string,"id"?: string,"is_available"?: boolean | null,"start_time"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"doctor_patient_assignments": {
                  Row: {
                    "assigned_at": string | null,"assigned_by": string | null,"created_at": string | null,"doctor_id": string,"id": string,"is_active": boolean | null,"notes": string | null,"patient_id": string,"updated_at": string | null
                  }
                  Insert: {
                    "assigned_at"?: string | null,"assigned_by"?: string | null,"created_at"?: string | null,"doctor_id": string,"id"?: string,"is_active"?: boolean | null,"notes"?: string | null,"patient_id": string,"updated_at"?: string | null
                  }
                  Update: {
                    "assigned_at"?: string | null,"assigned_by"?: string | null,"created_at"?: string | null,"doctor_id"?: string,"id"?: string,"is_active"?: boolean | null,"notes"?: string | null,"patient_id"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"doctors": {
                  Row: {
                    "address": string | null,"created_at": string | null,"email": string | null,"id": string,"license_number": string | null,"name": string,"phone": string | null,"specialty": string | null,"updated_at": string | null,"user_id": string
                  }
                  Insert: {
                    "address"?: string | null,"created_at"?: string | null,"email"?: string | null,"id"?: string,"license_number"?: string | null,"name": string,"phone"?: string | null,"specialty"?: string | null,"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "address"?: string | null,"created_at"?: string | null,"email"?: string | null,"id"?: string,"license_number"?: string | null,"name"?: string,"phone"?: string | null,"specialty"?: string | null,"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"labs": {
                  Row: {
                    "address": string | null,"certification": string | null,"created_at": string | null,"equipment_list": (string)[] | null,"id": string,"lab_name": string | null,"lab_type": string | null,"name": string,"operating_hours": Json | null,"updated_at": string | null,"user_id": string | null
                  }
                  Insert: {
                    "address"?: string | null,"certification"?: string | null,"created_at"?: string | null,"equipment_list"?: (string)[] | null,"id"?: string,"lab_name"?: string | null,"lab_type"?: string | null,"name": string,"operating_hours"?: Json | null,"updated_at"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"certification"?: string | null,"created_at"?: string | null,"equipment_list"?: (string)[] | null,"id"?: string,"lab_name"?: string | null,"lab_type"?: string | null,"name"?: string,"operating_hours"?: Json | null,"updated_at"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"medical_records": {
                  Row: {
                    "attachments": (string)[] | null,"created_at": string | null,"description": string | null,"diagnosis": string | null,"doctor_id": string | null,"file_url": string | null,"id": string,"metadata": Json | null,"notes": string | null,"patient_id": string | null,"prescription": string | null,"priority": string | null,"record_date": string | null,"record_type": string,"status": string | null,"title": string,"treatment": string | null,"updated_at": string | null
                  }
                  Insert: {
                    "attachments"?: (string)[] | null,"created_at"?: string | null,"description"?: string | null,"diagnosis"?: string | null,"doctor_id"?: string | null,"file_url"?: string | null,"id"?: string,"metadata"?: Json | null,"notes"?: string | null,"patient_id"?: string | null,"prescription"?: string | null,"priority"?: string | null,"record_date"?: string | null,"record_type": string,"status"?: string | null,"title": string,"treatment"?: string | null,"updated_at"?: string | null
                  }
                  Update: {
                    "attachments"?: (string)[] | null,"created_at"?: string | null,"description"?: string | null,"diagnosis"?: string | null,"doctor_id"?: string | null,"file_url"?: string | null,"id"?: string,"metadata"?: Json | null,"notes"?: string | null,"patient_id"?: string | null,"prescription"?: string | null,"priority"?: string | null,"record_date"?: string | null,"record_type"?: string,"status"?: string | null,"title"?: string,"treatment"?: string | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"medical_reports": {
                  Row: {
                    "ai_confidence": number | null,"ai_summary": string | null,"created_at": string | null,"description": string | null,"doctor_id": string | null,"file_size": number | null,"file_type": string | null,"file_url": string | null,"findings": string | null,"id": string,"lab_id": string | null,"patient_id": string | null,"priority": string | null,"recommendations": string | null,"report_type": string,"status": string | null,"title": string,"updated_at": string | null
                  }
                  Insert: {
                    "ai_confidence"?: number | null,"ai_summary"?: string | null,"created_at"?: string | null,"description"?: string | null,"doctor_id"?: string | null,"file_size"?: number | null,"file_type"?: string | null,"file_url"?: string | null,"findings"?: string | null,"id"?: string,"lab_id"?: string | null,"patient_id"?: string | null,"priority"?: string | null,"recommendations"?: string | null,"report_type": string,"status"?: string | null,"title": string,"updated_at"?: string | null
                  }
                  Update: {
                    "ai_confidence"?: number | null,"ai_summary"?: string | null,"created_at"?: string | null,"description"?: string | null,"doctor_id"?: string | null,"file_size"?: number | null,"file_type"?: string | null,"file_url"?: string | null,"findings"?: string | null,"id"?: string,"lab_id"?: string | null,"patient_id"?: string | null,"priority"?: string | null,"recommendations"?: string | null,"report_type"?: string,"status"?: string | null,"title"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"message_threads": {
                  Row: {
                    "created_at": string | null,"id": string,"is_active": boolean | null,"last_activity": string | null,"last_message_id": string | null,"participants": (string)[],"thread_type": string | null,"title": string | null,"updated_at": string | null
                  }
                  Insert: {
                    "created_at"?: string | null,"id"?: string,"is_active"?: boolean | null,"last_activity"?: string | null,"last_message_id"?: string | null,"participants": (string)[],"thread_type"?: string | null,"title"?: string | null,"updated_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string | null,"id"?: string,"is_active"?: boolean | null,"last_activity"?: string | null,"last_message_id"?: string | null,"participants"?: (string)[],"thread_type"?: string | null,"title"?: string | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"messages": {
                  Row: {
                    "attachment_name": string | null,"attachment_type": string | null,"attachment_url": string | null,"content": string,"created_at": string | null,"id": string,"is_read": boolean | null,"is_urgent": boolean | null,"message_type": string | null,"receiver_id": string,"receiver_name": string,"receiver_role": string,"related_appointment_id": string | null,"related_report_id": string | null,"sender_id": string,"sender_name": string,"sender_role": string,"subject": string | null,"updated_at": string | null
                  }
                  Insert: {
                    "attachment_name"?: string | null,"attachment_type"?: string | null,"attachment_url"?: string | null,"content": string,"created_at"?: string | null,"id"?: string,"is_read"?: boolean | null,"is_urgent"?: boolean | null,"message_type"?: string | null,"receiver_id": string,"receiver_name": string,"receiver_role": string,"related_appointment_id"?: string | null,"related_report_id"?: string | null,"sender_id": string,"sender_name": string,"sender_role": string,"subject"?: string | null,"updated_at"?: string | null
                  }
                  Update: {
                    "attachment_name"?: string | null,"attachment_type"?: string | null,"attachment_url"?: string | null,"content"?: string,"created_at"?: string | null,"id"?: string,"is_read"?: boolean | null,"is_urgent"?: boolean | null,"message_type"?: string | null,"receiver_id"?: string,"receiver_name"?: string,"receiver_role"?: string,"related_appointment_id"?: string | null,"related_report_id"?: string | null,"sender_id"?: string,"sender_name"?: string,"sender_role"?: string,"subject"?: string | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"ml_suggestions": {
                  Row: {
                    "confidence": number,"created_at": string | null,"doctor_notes": string | null,"findings": string,"id": string,"patient_id": string,"processed_at": string | null,"recommendations": string | null,"report_id": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"severity": string | null,"status": string | null,"test_type": string,"updated_at": string | null
                  }
                  Insert: {
                    "confidence": number,"created_at"?: string | null,"doctor_notes"?: string | null,"findings": string,"id"?: string,"patient_id": string,"processed_at"?: string | null,"recommendations"?: string | null,"report_id"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"severity"?: string | null,"status"?: string | null,"test_type": string,"updated_at"?: string | null
                  }
                  Update: {
                    "confidence"?: number,"created_at"?: string | null,"doctor_notes"?: string | null,"findings"?: string,"id"?: string,"patient_id"?: string,"processed_at"?: string | null,"recommendations"?: string | null,"report_id"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"severity"?: string | null,"status"?: string | null,"test_type"?: string,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "fk_ml_suggestions_report_id"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "reports"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "action_url": string | null,"created_at": string | null,"data": Json | null,"id": string,"is_read": boolean | null,"is_urgent": boolean | null,"message": string,"notification_type": string,"related_id": string | null,"related_type": string | null,"target_role": string | null,"title": string,"type": string | null,"user_id": string
                  }
                  Insert: {
                    "action_url"?: string | null,"created_at"?: string | null,"data"?: Json | null,"id"?: string,"is_read"?: boolean | null,"is_urgent"?: boolean | null,"message": string,"notification_type": string,"related_id"?: string | null,"related_type"?: string | null,"target_role"?: string | null,"title": string,"type"?: string | null,"user_id": string
                  }
                  Update: {
                    "action_url"?: string | null,"created_at"?: string | null,"data"?: Json | null,"id"?: string,"is_read"?: boolean | null,"is_urgent"?: boolean | null,"message"?: string,"notification_type"?: string,"related_id"?: string | null,"related_type"?: string | null,"target_role"?: string | null,"title"?: string,"type"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"patient_profiles": {
                  Row: {
                    "address": string | null,"age": number | null,"allergies": string | null,"blood_type": string | null,"created_at": string | null,"date_of_birth": string | null,"email": string | null,"emergency_contact": string | null,"family_history": string | null,"full_name": string | null,"gender": string | null,"height": string | null,"id": string,"medical_history": string | null,"medications": (string)[] | null,"name": string | null,"ongoing_treatments": string | null,"phone": string | null,"phone_number": string | null,"short_id": string | null,"updated_at": string | null,"user_id": string | null,"weight": string | null
                  }
                  Insert: {
                    "address"?: string | null,"age"?: number | null,"allergies"?: string | null,"blood_type"?: string | null,"created_at"?: string | null,"date_of_birth"?: string | null,"email"?: string | null,"emergency_contact"?: string | null,"family_history"?: string | null,"full_name"?: string | null,"gender"?: string | null,"height"?: string | null,"id"?: string,"medical_history"?: string | null,"medications"?: (string)[] | null,"name"?: string | null,"ongoing_treatments"?: string | null,"phone"?: string | null,"phone_number"?: string | null,"short_id"?: string | null,"updated_at"?: string | null,"user_id"?: string | null,"weight"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"age"?: number | null,"allergies"?: string | null,"blood_type"?: string | null,"created_at"?: string | null,"date_of_birth"?: string | null,"email"?: string | null,"emergency_contact"?: string | null,"family_history"?: string | null,"full_name"?: string | null,"gender"?: string | null,"height"?: string | null,"id"?: string,"medical_history"?: string | null,"medications"?: (string)[] | null,"name"?: string | null,"ongoing_treatments"?: string | null,"phone"?: string | null,"phone_number"?: string | null,"short_id"?: string | null,"updated_at"?: string | null,"user_id"?: string | null,"weight"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"patients": {
                  Row: {
                    "address": string | null,"allergies": string | null,"blood_type": string | null,"chronic_conditions": string | null,"created_at": string | null,"current_medications": string | null,"date_of_birth": string | null,"email": string | null,"emergency_contact": string | null,"gender": string | null,"height_cm": number | null,"id": string,"insurance_number": string | null,"insurance_provider": string | null,"name": string,"phone": string | null,"updated_at": string | null,"user_id": string | null,"weight_kg": number | null
                  }
                  Insert: {
                    "address"?: string | null,"allergies"?: string | null,"blood_type"?: string | null,"chronic_conditions"?: string | null,"created_at"?: string | null,"current_medications"?: string | null,"date_of_birth"?: string | null,"email"?: string | null,"emergency_contact"?: string | null,"gender"?: string | null,"height_cm"?: number | null,"id"?: string,"insurance_number"?: string | null,"insurance_provider"?: string | null,"name": string,"phone"?: string | null,"updated_at"?: string | null,"user_id"?: string | null,"weight_kg"?: number | null
                  }
                  Update: {
                    "address"?: string | null,"allergies"?: string | null,"blood_type"?: string | null,"chronic_conditions"?: string | null,"created_at"?: string | null,"current_medications"?: string | null,"date_of_birth"?: string | null,"email"?: string | null,"emergency_contact"?: string | null,"gender"?: string | null,"height_cm"?: number | null,"id"?: string,"insurance_number"?: string | null,"insurance_provider"?: string | null,"name"?: string,"phone"?: string | null,"updated_at"?: string | null,"user_id"?: string | null,"weight_kg"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"reports": {
                  Row: {
                    "created_at": string | null,"doctor_id": string | null,"file_name": string,"id": string,"masked_image_url": string | null,"notes": string | null,"original_image_url": string | null,"original_name": string,"overlayed_image_url": string | null,"patient_id": string,"patient_info": Json | null,"priority": string | null,"result": Json | null,"test_type": string,"updated_at": string | null,"uploaded_at": string | null,"uploaded_by": string | null
                  }
                  Insert: {
                    "created_at"?: string | null,"doctor_id"?: string | null,"file_name": string,"id"?: string,"masked_image_url"?: string | null,"notes"?: string | null,"original_image_url"?: string | null,"original_name": string,"overlayed_image_url"?: string | null,"patient_id": string,"patient_info"?: Json | null,"priority"?: string | null,"result"?: Json | null,"test_type": string,"updated_at"?: string | null,"uploaded_at"?: string | null,"uploaded_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string | null,"doctor_id"?: string | null,"file_name"?: string,"id"?: string,"masked_image_url"?: string | null,"notes"?: string | null,"original_image_url"?: string | null,"original_name"?: string,"overlayed_image_url"?: string | null,"patient_id"?: string,"patient_info"?: Json | null,"priority"?: string | null,"result"?: Json | null,"test_type"?: string,"updated_at"?: string | null,"uploaded_at"?: string | null,"uploaded_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"typing_status": {
                  Row: {
                    "id": string,"is_typing": boolean | null,"last_typing_at": string | null,"receiver_id": string,"user_id": string
                  }
                  Insert: {
                    "id"?: string,"is_typing"?: boolean | null,"last_typing_at"?: string | null,"receiver_id": string,"user_id": string
                  }
                  Update: {
                    "id"?: string,"is_typing"?: boolean | null,"last_typing_at"?: string | null,"receiver_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"user_short_ids": {
                  Row: {
                    "created_at": string | null,"role": string | null,"short_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string | null,"role"?: string | null,"short_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string | null,"role"?: string | null,"short_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"users": {
                  Row: {
                    "auth_id": string,"created_at": string | null,"email": string,"id": string,"last_seen": string | null,"name": string,"online": boolean | null,"role": string,"short_id": string | null,"specialty": string | null,"updated_at": string | null
                  }
                  Insert: {
                    "auth_id": string,"created_at"?: string | null,"email": string,"id"?: string,"last_seen"?: string | null,"name": string,"online"?: boolean | null,"role": string,"short_id"?: string | null,"specialty"?: string | null,"updated_at"?: string | null
                  }
                  Update: {
                    "auth_id"?: string,"created_at"?: string | null,"email"?: string,"id"?: string,"last_seen"?: string | null,"name"?: string,"online"?: boolean | null,"role"?: string,"short_id"?: string | null,"specialty"?: string | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"video_call_logs": {
                  Row: {
                    "action": string | null,"id": string,"metadata": Json | null,"session_id": string | null,"timestamp": string | null,"user_id": string | null
                  }
                  Insert: {
                    "action"?: string | null,"id"?: string,"metadata"?: Json | null,"session_id"?: string | null,"timestamp"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "action"?: string | null,"id"?: string,"metadata"?: Json | null,"session_id"?: string | null,"timestamp"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "video_call_logs_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "video_call_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "video_call_logs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                },"video_call_messages": {
                  Row: {
                    "id": string,"message": string | null,"message_type": string | null,"sender_id": string | null,"sender_role": string | null,"session_id": string | null,"timestamp": string | null
                  }
                  Insert: {
                    "id"?: string,"message"?: string | null,"message_type"?: string | null,"sender_id"?: string | null,"sender_role"?: string | null,"session_id"?: string | null,"timestamp"?: string | null
                  }
                  Update: {
                    "id"?: string,"message"?: string | null,"message_type"?: string | null,"sender_id"?: string | null,"sender_role"?: string | null,"session_id"?: string | null,"timestamp"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "video_call_messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "video_call_messages_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "video_call_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"video_call_sessions": {
                  Row: {
                    "appointment_id": string | null,"created_at": string | null,"doctor_id": string | null,"id": string,"meeting_id": string | null,"notes": string | null,"patient_id": string | null,"recording_url": string | null,"session_end": string | null,"session_start": string | null,"status": string | null
                  }
                  Insert: {
                    "appointment_id"?: string | null,"created_at"?: string | null,"doctor_id"?: string | null,"id"?: string,"meeting_id"?: string | null,"notes"?: string | null,"patient_id"?: string | null,"recording_url"?: string | null,"session_end"?: string | null,"session_start"?: string | null,"status"?: string | null
                  }
                  Update: {
                    "appointment_id"?: string | null,"created_at"?: string | null,"doctor_id"?: string | null,"id"?: string,"meeting_id"?: string | null,"notes"?: string | null,"patient_id"?: string | null,"recording_url"?: string | null,"session_end"?: string | null,"session_start"?: string | null,"status"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "video_call_sessions_appointment_id_fkey"
      columns: ["appointment_id"]
isOneToOne: false
      referencedRelation: "appointments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "video_call_sessions_doctor_id_fkey"
      columns: ["doctor_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "video_call_sessions_patient_id_fkey"
      columns: ["patient_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "patient_profiles_unified": {
                  Row: {
                    "address": string | null,"allergies": string | null,"created_at": string | null,"date_of_birth": string | null,"email": string | null,"emergency_contact": string | null,"full_name": string | null,"gender": string | null,"id": string | null,"medical_history": string | null,"medications": (string)[] | null,"name": string | null,"phone": string | null,"short_id": string | null,"updated_at": string | null,"user_id": string | null
                  }
                  Relationships: [
                    
                  ]
                }
            "profile_directory": {
                  Row: {
                    "id": string,"lab_name": string | null,"last_seen": string | null,"name": string | null,"online": boolean | null,"role": string | null,"short_id": string | null,"specialty": string | null
                  }
                  Relationships: []
                }
          }
          Functions: {
            "doctor_can_access_patient":
{ Args: { "doctor_uuid": string,"patient_uuid": string }; Returns: boolean
                           },
"gen_short_id":
{ Args: { "len"?: number }; Returns: string
                           },
"get_doctor_patients":
{ Args: { "doctor_uuid": string }; Returns: {
              "assigned_at": string,"patient_email": string,"patient_id": string,"patient_name": string,"patient_short_id": string,"total_reports": number
            }[]
                           },
"get_doctor_patients_bulletproof":
{ Args: { "doctor_uuid": string }; Returns: {
              "assigned_at": string,"patient_email": string,"patient_id": string,"patient_name": string,"patient_short_id": string,"total_reports": number
            }[]
                           },
"get_doctor_patients_simple":
{ Args: { "doctor_uuid": string }; Returns: {
              "assigned_at": string,"patient_email": string,"patient_id": string,"patient_name": string,"patient_short_id": string,"total_reports": number
            }[]
                           },
"get_doctor_reports_with_ml":
{ Args: { "doctor_uuid": string }; Returns: {
              "confidence": number,"file_name": string,"findings": string,"ml_id": string,"ml_status": string,"original_name": string,"patient_id": string,"priority": string,"processed_at": string,"recommendations": string,"report_id": string,"severity": string,"test_type": string,"uploaded_at": string
            }[]
                           },
"get_lab_upload_patient_profile":
{ Args: { "p_doctor_id": string,"p_patient_id": string }; Returns: {
              "address": string | null,"allergies": string | null,"chronic_conditions": string | null,"current_medications": string | null,"date_of_birth": string | null,"gender": string | null,"id": string,"name": string | null,"phone": string | null
            }[]
                           },
"resolve_doctor_id":
{ Args: { "input_id": string }; Returns: string
                           },
"resolve_patient_id":
{ Args: { "input_id": string }; Returns: string
                           },
"safe_appointment_update":
{ Args: { "appointment_id": string,"update_data": Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const

