"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Clock, User, Video, Phone, MessageSquare, Loader2, Search, CheckCircle2 } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { format, addDays } from "date-fns"
import { UUID_REGEX } from "@/lib/constants"
import { useToast } from "@/hooks/use-toast"

interface ScheduleAppointmentModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess?: () => void
    doctorId: string
    doctorName?: string
}

interface Patient {
    id: string
    name: string
    user_id: string
}

export default function ScheduleAppointmentModal({
    isOpen,
    onClose,
    onSuccess,
    doctorId,
    doctorName
}: ScheduleAppointmentModalProps) {
    const [loading, setLoading] = useState(false)
    const [patients, setPatients] = useState<Patient[]>([])
    const [loadingPatients, setLoadingPatients] = useState(false)
    const { toast } = useToast()

    // Form state
    const [patientId, setPatientId] = useState("")
    const [patientProfile, setPatientProfile] = useState<any>(null)
    const [loadingProfile, setLoadingProfile] = useState(false)
    const [patientName, setPatientName] = useState("")
    const [appointmentDate, setAppointmentDate] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [startTime, setStartTime] = useState("09:00")
    const [endTime, setEndTime] = useState("09:30")
    const [consultationType, setConsultationType] = useState<"video" | "audio" | "chat">("video")
    const [symptoms, setSymptoms] = useState("")
    const [notes, setNotes] = useState("")
    const [error, setError] = useState("")

    const resolvedPatientId =
        patientProfile?.user_id || patientProfile?.auth_id || patientProfile?.id || null

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            resetForm()
        }
    }, [isOpen])

    const fetchPatientProfile = async (id: string) => {
        if (!id.trim()) {
            setPatientProfile(null)
            setPatientName("")
            return
        }

        setLoadingProfile(true)
        setError("")
        try {
            const supabase = createClient()
            const trimmedId = id.trim()
            
            // 1. Try fetching from profiles
            let profile: any = null

            if (UUID_REGEX.test(trimmedId)) {
                const { data } = await supabase
                    .from('profile_directory')
                    .select('*')
                    .eq('id', trimmedId)
                    .eq('role', 'patient')
                    .maybeSingle()
                profile = data
            } else {
                const normalizedShortId = trimmedId.toLowerCase()
                const { data } = await supabase
                    .from('profile_directory')
                    .select('*')
                    .eq('short_id', normalizedShortId)
                    .eq('role', 'patient')
                    .maybeSingle()
                profile = data
            }
            if (profile) {
                setPatientProfile(profile)
                setPatientName(profile.full_name || profile.name || "")
            } else {
                setPatientProfile(null)
            }
        } catch (err) {
            console.error('Error fetching patient:', err)
        } finally {
            setLoadingProfile(false)
        }
    }

    const resetForm = () => {
        setPatientId("")
        setPatientProfile(null)
        setPatientName("")
        setAppointmentDate(format(new Date(), 'yyyy-MM-dd'))
        setStartTime("09:00")
        setEndTime("09:30")
        setConsultationType("video")
        setSymptoms("")
        setNotes("")
        setError("")
    }

    // Handle patient ID change
    const handlePatientIdChange = (id: string) => {
        setPatientId(id)
        if (id.trim()) {
            fetchPatientProfile(id)
        } else {
            setPatientProfile(null)
            setPatientName("")
        }
    }

    // Auto-calculate end time based on start time (30 min slots)
    const handleStartTimeChange = (time: string) => {
        setStartTime(time)
        const [hours, minutes] = time.split(':').map(Number)
        const endHours = minutes >= 30 ? hours + 1 : hours
        const endMinutes = minutes >= 30 ? '00' : '30'
        setEndTime(`${String(endHours).padStart(2, '0')}:${endMinutes}`)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        // Validation
        if (!resolvedPatientId) {
            setError("Please enter a valid Patient Short ID or UUID and ensure the profile loads")
            return
        }

        if (!appointmentDate) {
            setError("Please select an appointment date")
            return
        }

        if (!startTime || !endTime) {
            setError("Please select start and end times")
            return
        }

        // Time validation: end time must be after start time
        if (endTime <= startTime) {
            setError("End time must be after start time")
            return
        }

        setLoading(true)

        try {
            const supabase = createClient()

            const appointmentData = {
                doctor_id: doctorId,
                // Always prefer auth user UUID so patient dashboards can resolve consistently.
                patient_id: resolvedPatientId,
                patient_name: patientName.trim() || 'Unknown Patient',
                doctor_name: doctorName || 'Doctor',
                appointment_date: appointmentDate,
                start_time: `${startTime}:00`,
                end_time: `${endTime}:00`,
                consultation_type: consultationType,
                status: 'scheduled',
                symptoms: symptoms.trim() || null,
                notes: notes.trim() || null,
            }


            const { data, error: insertError } = await supabase
                .from('appointments')
                .insert(appointmentData)
                .select()
                .single()

            if (insertError) {
                console.error('Error creating appointment:', insertError)
                // RLS rejects inserts from doctors whose registration isn't verified yet; the
                // insert guard also refuses closed accounts, with its own message.
                setError(insertError.code === '42501' && !/closed/i.test(insertError.message)
                    ? "Your account is awaiting verification, so you can't schedule appointments yet."
                    : `Failed to create appointment: ${insertError.message}`)
                return
            }

            // The patient is assigned to this doctor only when they confirm the request
            // (respond_to_appointment), which is what lets labs upload their reports.

            toast({
                title: "Appointment requested",
                description: "The patient will be asked to confirm it.",
            })

            if (onSuccess) {
                onSuccess()
            }

            onClose()
        } catch (error) {
            console.error('Error creating appointment:', error)
            setError('An unexpected error occurred. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const getConsultationTypeIcon = (type: string) => {
        switch (type) {
            case 'video': return <Video className="h-4 w-4" />
            case 'audio': return <Phone className="h-4 w-4" />
            case 'chat': return <MessageSquare className="h-4 w-4" />
            default: return <Video className="h-4 w-4" />
        }
    }

    // Generate time slots (24 hours)
    const timeSlots = []
    for (let hour = 0; hour <= 23; hour++) {
        for (let min of ['00', '30']) {
            const time = `${String(hour).padStart(2, '0')}:${min}`
            timeSlots.push(time)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Schedule New Appointment
                    </DialogTitle>
                    <DialogDescription>
                        Create a new appointment for a patient consultation.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    {/* Patient Identification */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="patientId" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-black/55">
                                <Search className="h-3 w-3" />
                                Patient ID / Short ID
                            </Label>
                            <div className="relative">
                                <Input
                                    id="patientId"
                                    placeholder="Enter ID"
                                    value={patientId}
                                    onChange={(e) => handlePatientIdChange(e.target.value)}
                                    className="rounded-none border-black h-10 font-mono text-sm uppercase focus-visible:ring-0"
                                />
                                {loadingProfile && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                        <Loader2 className="h-3 w-3 animate-spin text-black/55" />
                                    </div>
                                )}
                                {patientProfile && !loadingProfile && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                        <CheckCircle2 className="h-3 w-3 text-green-600" />
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="patientName" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-black/55">
                                <User className="h-3 w-3" />
                                Patient Name
                            </Label>
                            <Input
                                id="patientName"
                                placeholder="Patient Name"
                                value={patientName}
                                onChange={(e) => setPatientName(e.target.value)}
                                className="rounded-none border-black h-10 font-mono text-sm uppercase focus-visible:ring-0"
                            />
                        </div>
                    </div>

                    {/* Date and Time */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="date" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-black/55">
                                <Calendar className="h-3 w-3" />
                                Date
                            </Label>
                            <Input
                                id="date"
                                type="date"
                                value={appointmentDate}
                                onChange={(e) => setAppointmentDate(e.target.value)}
                                min={format(new Date(), 'yyyy-MM-dd')}
                                max={format(addDays(new Date(), 60), 'yyyy-MM-dd')}
                                required
                                className="rounded-none border-black h-10 font-mono text-xs focus-visible:ring-0"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="startTime" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-black/55">
                                <Clock className="h-3 w-3" />
                                Start
                            </Label>
                            <Select value={startTime} onValueChange={handleStartTimeChange}>
                                <SelectTrigger className="rounded-none border-black h-10 font-mono text-xs focus:ring-0">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-none border-black">
                                    {timeSlots.map(time => (
                                        <SelectItem key={time} value={time} className="font-mono text-xs">
                                            {time}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="endTime" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-black/55">
                                <Clock className="h-3 w-3" />
                                End
                            </Label>
                            <Select value={endTime} onValueChange={setEndTime}>
                                <SelectTrigger className="rounded-none border-black h-10 font-mono text-xs focus:ring-0">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-none border-black">
                                    {timeSlots.map(time => (
                                        <SelectItem key={time} value={time} className="font-mono text-xs">
                                            {time}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Consultation Type */}
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-black/55">Consultation Type</Label>
                        <div className="flex gap-2">
                            {(['video', 'audio', 'chat'] as const).map(type => (
                                <Button
                                    key={type}
                                    type="button"
                                    variant={consultationType === type ? "default" : "outline"}
                                    className={`flex-1 rounded-none border-black h-10 font-mono text-[10px] uppercase tracking-wider transition-all ${
                                        consultationType === type ? 'bg-black text-white' : 'bg-transparent text-black hover:bg-black/5'
                                    }`}
                                    onClick={() => setConsultationType(type)}
                                >
                                    {getConsultationTypeIcon(type)}
                                    <span className="ml-2">{type}</span>
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Symptoms */}
                    <div className="space-y-2">
                        <Label htmlFor="symptoms" className="text-[10px] font-black uppercase tracking-widest text-black/55">Symptoms / Reason</Label>
                        <Textarea
                            id="symptoms"
                            placeholder="Describe symptoms..."
                            value={symptoms}
                            onChange={(e) => setSymptoms(e.target.value)}
                            rows={2}
                            className="rounded-none border-black font-mono text-xs uppercase focus-visible:ring-0 min-h-[60px]"
                        />
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label htmlFor="notes" className="text-[10px] font-black uppercase tracking-widest text-black/55">Notes (Optional)</Label>
                        <Textarea
                            id="notes"
                            placeholder="Additional notes..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            className="rounded-none border-black font-mono text-xs uppercase focus-visible:ring-0 min-h-[60px]"
                        />
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                            {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-4 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            className="flex-1 rounded-none border-black font-mono uppercase text-xs h-12"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 bg-black text-white rounded-none hover:bg-black/90 font-mono uppercase text-xs h-12"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Calendar className="h-4 w-4 mr-2" />
                                    Confirm Appt
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
