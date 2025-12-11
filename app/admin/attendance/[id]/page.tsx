'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft } from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/attendance'

interface Attendance {
  id: string
  shiftDate: string
  checkInAt: string | null
  checkOutAt: string | null
  checkInLatitude: number | null
  checkInLongitude: number | null
  checkOutLatitude: number | null
  checkOutLongitude: number | null
  status: string
  user: {
    id: string
    name: string
    email: string
  }
}

export default function EditAttendancePage() {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams()
  const attendanceId = params.id as string

  const [attendance, setAttendance] = useState<Attendance | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    checkInAt: '',
    checkOutAt: '',
    checkInLatitude: '',
    checkInLongitude: '',
    checkOutLatitude: '',
    checkOutLongitude: '',
  })

  useEffect(() => {
    if (session?.user?.role !== 'ADMIN') {
      router.push('/admin')
      return
    }
    loadAttendance()
  }, [session, attendanceId])

  const loadAttendance = async () => {
    try {
      // We need to get the attendance from the list or create a new endpoint
      // For now, let's fetch all and find the one we need
      const response = await fetch('/api/admin/attendance')
      const data = await response.json()
      const found = data.attendances?.find((a: Attendance) => a.id === attendanceId)

      if (found) {
        setAttendance(found)
        setFormData({
          checkInAt: found.checkInAt
            ? new Date(found.checkInAt).toISOString().slice(0, 16)
            : '',
          checkOutAt: found.checkOutAt
            ? new Date(found.checkOutAt).toISOString().slice(0, 16)
            : '',
          checkInLatitude: found.checkInLatitude?.toString() || '',
          checkInLongitude: found.checkInLongitude?.toString() || '',
          checkOutLatitude: found.checkOutLatitude?.toString() || '',
          checkOutLongitude: found.checkOutLongitude?.toString() || '',
        })
      }
    } catch (error) {
      console.error('Failed to load attendance:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/attendance/${attendanceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkInAt: formData.checkInAt || null,
          checkOutAt: formData.checkOutAt || null,
          checkInLatitude: formData.checkInLatitude ? parseFloat(formData.checkInLatitude) : null,
          checkInLongitude: formData.checkInLongitude ? parseFloat(formData.checkInLongitude) : null,
          checkOutLatitude: formData.checkOutLatitude ? parseFloat(formData.checkOutLatitude) : null,
          checkOutLongitude: formData.checkOutLongitude ? parseFloat(formData.checkOutLongitude) : null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update attendance')
      }

      router.push('/admin')
    } catch (error: any) {
      alert(error.message || 'Failed to update attendance')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  if (!attendance) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg mb-4">Attendance record not found</p>
          <Button onClick={() => router.push('/admin')}>Back to Admin</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <Button variant="outline" onClick={() => router.push('/admin')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Edit Attendance Record</CardTitle>
            <CardDescription>
              Employee: {attendance.user.name} ({attendance.user.email})
            </CardDescription>
            <CardDescription>
              Shift Date: {formatDate(new Date(attendance.shiftDate))}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="checkInAt">Check In Time</Label>
              <Input
                id="checkInAt"
                type="datetime-local"
                value={formData.checkInAt}
                onChange={(e) => setFormData({ ...formData, checkInAt: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="checkOutAt">Check Out Time</Label>
              <Input
                id="checkOutAt"
                type="datetime-local"
                value={formData.checkOutAt}
                onChange={(e) => setFormData({ ...formData, checkOutAt: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="checkInLatitude">Check In Latitude</Label>
                <Input
                  id="checkInLatitude"
                  type="number"
                  step="any"
                  value={formData.checkInLatitude}
                  onChange={(e) => setFormData({ ...formData, checkInLatitude: e.target.value })}
                  placeholder="e.g., 24.8607"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkInLongitude">Check In Longitude</Label>
                <Input
                  id="checkInLongitude"
                  type="number"
                  step="any"
                  value={formData.checkInLongitude}
                  onChange={(e) => setFormData({ ...formData, checkInLongitude: e.target.value })}
                  placeholder="e.g., 67.0011"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="checkOutLatitude">Check Out Latitude</Label>
                <Input
                  id="checkOutLatitude"
                  type="number"
                  step="any"
                  value={formData.checkOutLatitude}
                  onChange={(e) => setFormData({ ...formData, checkOutLatitude: e.target.value })}
                  placeholder="e.g., 24.8607"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkOutLongitude">Check Out Longitude</Label>
                <Input
                  id="checkOutLongitude"
                  type="number"
                  step="any"
                  value={formData.checkOutLongitude}
                  onChange={(e) => setFormData({ ...formData, checkOutLongitude: e.target.value })}
                  placeholder="e.g., 67.0011"
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button variant="outline" onClick={() => router.push('/admin')}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


