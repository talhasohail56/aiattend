'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatTime, formatDateTime } from '@/lib/attendance'
import { MapPin, LogOut, TrendingUp, Clock, XCircle, AlertCircle, CheckCircle, Timer, CalendarClock } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select' // Added
import { Users } from 'lucide-react' // Added
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

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
}

interface AttendanceStatus {
  attendance: Attendance | null
}

interface Task {
  id: string
  title: string
  completed: boolean
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [currentAttendance, setCurrentAttendance] = useState<Attendance | null>(null)
  const [history, setHistory] = useState<Attendance[]>([])
  const [tasks, setTasks] = useState<Task[]>([]) // Daily Tasks
  const [loading, setLoading] = useState(true)
  const [checkingIn, setCheckingIn] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<string | null>(null)
  const [stats, setStats] = useState({
    totalDays: 0,
    present: 0,
    late: 0,
    absent: 0,
    noCheckout: 0,
  })
  const [userTimes, setUserTimes] = useState({ checkInTime: '21:00', checkOutTime: '05:00' })

  // Late Request
  const [requestOpen, setRequestOpen] = useState(false)
  const [requestDate, setRequestDate] = useState('')
  const [requestTime, setRequestTime] = useState('')
  const [requestReason, setRequestReason] = useState('')

  // Manager State
  const [managerEmployees, setManagerEmployees] = useState<any[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [managerTaskTitle, setManagerTaskTitle] = useState('')
  const [managerTaskDate, setManagerTaskDate] = useState(new Date().toISOString().split('T')[0])
  const [loadingManagerData, setLoadingManagerData] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated' && session?.user?.role === 'ADMIN') {
      router.push('/admin')
      return
    }
    if (status === 'authenticated') {
      loadData()
    }
  }, [status, session, router])

  useEffect(() => {
    const updateTimer = () => {
      if (!userTimes.checkInTime || currentAttendance?.checkInAt) {
        setTimeLeft(null)
        return
      }

      const now = new Date()
      const [inHours, inMinutes] = userTimes.checkInTime.split(':').map(Number)
      const [outHours, outMinutes] = userTimes.checkOutTime.split(':').map(Number)

      const checkInDate = new Date()
      checkInDate.setHours(inHours, inMinutes, 0, 0)

      const checkOutDate = new Date()
      checkOutDate.setHours(outHours, outMinutes, 0, 0)

      // Handle overnight shift logic for "Am I in the shift?"
      // Shift: 21:00 to 05:00. Now: 02:00.

      const isOvernight = inHours > outHours || (inHours === outHours && inMinutes > outMinutes)
      let isActiveShift = false

      const currentH = now.getHours()
      const currentM = now.getMinutes()

      if (isOvernight) {
        // Active if: (Now >= CheckIn) OR (Now < CheckOut)
        // e.g. Start 21:00, End 05:00.
        // Now 23:00 -> Active. Now 04:00 -> Active. Now 06:00 -> Not active. Now 12:00 -> Not active.
        if ((currentH > inHours || (currentH === inHours && currentM >= inMinutes)) ||
          (currentH < outHours || (currentH === outHours && currentM < outMinutes))) {
          isActiveShift = true
        }
      } else {
        // Standard day shift: 09:00 to 17:00
        // Active if: Now >= CheckIn AND Now < CheckOut
        if ((currentH > inHours || (currentH === inHours && currentM >= inMinutes)) &&
          (currentH < outHours || (currentH === outHours && currentM < outMinutes))) {
          isActiveShift = true
        }
      }

      if (isActiveShift) {
        setTimeLeft('SHIFT_ACTIVE')
        return
      }

      // If not active, count down to NEXT check-in
      // If now is 02:00 and checkin is 21:00 -> Diff is positive.
      // If now is 22:00 and checkin is 21:00 -> Diff is negative (but handled by active check above? No, 22:00 is active)
      // What if shift ends at 17:00 and now is 18:00. Next checkin is tomorrow 09:00.

      let targetTime = new Date(checkInDate)
      if (targetTime.getTime() < now.getTime()) {
        // Scheduled time passed today (and we are not in active shift), so look to tomorrow
        targetTime.setDate(targetTime.getDate() + 1)
      }

      const diff = targetTime.getTime() - now.getTime()

      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const s = Math.floor((diff % (1000 * 60)) / 1000)
      setTimeLeft(`${h}h ${m}m ${s}s`)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [userTimes, currentAttendance])

  const loadData = async () => {
    try {
      const [statusRes, historyRes, timesRes, tasksRes] = await Promise.all([
        fetch('/api/attendance/status', { cache: 'no-store' }),
        fetch('/api/attendance/history?limit=14', { cache: 'no-store' }),
        fetch('/api/user/times', { cache: 'no-store' }),
        fetch(`/api/tasks?date=${new Date().toISOString()}`, { cache: 'no-store' }),
      ])

      const statusData: AttendanceStatus = await statusRes.json()
      const historyData = await historyRes.json()
      const timesData = await timesRes.json()
      const tasksData = await tasksRes.json()

      setCurrentAttendance(statusData.attendance)
      setHistory(historyData.attendances || [])
      setUserTimes(timesData)
      setTasks(tasksData.tasks || [])

      // Calculate stats
      const statsData = {
        totalDays: historyData.attendances?.length || 0,
        present: historyData.attendances?.filter((a: Attendance) =>
          a.status === 'ON_TIME'
        ).length || 0,
        late: historyData.attendances?.filter((a: Attendance) =>
          a.status === 'LATE'
        ).length || 0,
        absent: historyData.attendances?.filter((a: Attendance) =>
          a.status === 'ABSENT'
        ).length || 0,
        noCheckout: historyData.attendances?.filter((a: Attendance) =>
          a.status === 'NO_CHECKOUT'
        ).length || 0,
      }
      setStats(statsData)

      // Load Manager Data if needed
      if ((session?.user?.role as string) === 'MANAGER') {
        const empRes = await fetch('/api/admin/employees') // Reuse existing endpoint? It returns employees + stats.
        const empData = await empRes.json()
        setManagerEmployees(empData.employees || [])
      }

    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleManagerAssignTask = async () => {
    if (!selectedEmployeeId || !managerTaskTitle || !managerTaskDate) return
    try {
      setLoadingManagerData(true)
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedEmployeeId,
          date: managerTaskDate,
          title: managerTaskTitle
        })
      })
      if (res.ok) {
        setManagerTaskTitle('')
        alert('Task assigned successfully!')
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to assign task')
      }
    } catch (e) {
      alert('Error assigning task')
    } finally {
      setLoadingManagerData(false)
    }
  }

  const getLocation = (): Promise<{ latitude: number; longitude: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'))
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          })
        },
        (error) => {
          reject(error)
        },
        { timeout: 10000 }
      )
    })
  }

  const handleCheckIn = async () => {
    setCheckingIn(true)
    setLocationError(null)

    try {
      let location: { latitude: number | null; longitude: number | null } = { latitude: null, longitude: null }
      try {
        const loc = await getLocation()
        location = loc
      } catch (error) {
        setLocationError('Location access is mandatory. Please enable it in your browser settings.')
        setCheckingIn(false)
        return
      }

      const response = await fetch('/api/attendance/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(location),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to check in')
      }

      await loadData()
    } catch (error: any) {
      alert(error.message || 'Failed to check in')
    } finally {
      setCheckingIn(false)
    }
  }

  const handleCheckOut = async () => {
    setCheckingOut(true)
    setLocationError(null)

    try {
      let location: { latitude: number | null; longitude: number | null } = { latitude: null, longitude: null }
      try {
        const loc = await getLocation()
        location = loc
      } catch (error) {
        setLocationError('Location access is mandatory. Please enable it in your browser settings.')
        setCheckingOut(false)
        return
      }

      const response = await fetch('/api/attendance/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(location),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to check out')
      }

      await loadData()
    } catch (error: any) {
      alert(error.message || 'Failed to check out')
    } finally {
      setCheckingOut(false)
    }
  }

  const handleLateRequest = async () => {
    if (!requestDate || !requestTime || !requestReason) return

    try {
      const response = await fetch('/api/attendance/request-late', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftDate: requestDate,
          requestedTime: requestTime,
          reason: requestReason
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to submit request')
      }

      setRequestOpen(false)
      setRequestDate('')
      setRequestTime('')
      setRequestReason('')
      alert('Request submitted! Talha will be notified.')
    } catch (error) {
      alert('Failed to submit request')
    }
  }

  const handleToggleTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}/toggle`, { method: 'POST' })
      if (response.ok) {
        // Optimistic update or reload
        setTasks(prev => prev.map(t =>
          t.id === taskId ? { ...t, completed: !t.completed } : t
        ))
      }
    } catch (error) {
      console.error('Toggle error', error)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'EARLY':
        return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">Early</Badge>
      case 'ON_TIME':
        return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">On Time</Badge>
      case 'LATE':
        return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Late</Badge>
      case 'ABSENT':
        return <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Absent</Badge>
      case 'NO_CHECKOUT':
        return <Badge className="bg-gray-500/10 text-gray-400 border-gray-500/20">No Checkout</Badge>
      default:
        return <Badge variant="outline" className="border-white/20 text-white">{status}</Badge>
    }
  }

  // Chart Data Preparation
  const chartData = [
    { name: 'On Time', value: stats.present, fill: '#22c55e' },
    { name: 'Late', value: stats.late, fill: '#f59e0b' },
    { name: 'Absent', value: stats.absent, fill: '#ef4444' },
    { name: 'No Checkout', value: stats.noCheckout, fill: '#94a3b8' },
  ]

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
        <div className="animate-spin h-8 w-8 border-2 border-neutral-800 border-t-neutral-400 rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 font-sans text-neutral-200">
      {/* Header */}
      {/* Header */}
      <div className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10">
              <Image
                src="/icon.png"
                alt="Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <span className="font-bold text-xl tracking-tight text-white hidden md:inline-block">My Attendance</span>
            <div>
              <h1 className="text-xl font-bold text-neutral-100">My Attendance</h1>
              <p className="text-xs text-neutral-500">Employee Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRequestDate(new Date().toISOString().split('T')[0])
                setRequestOpen(true)
              }}
              className="border-neutral-700 bg-transparent text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
            >
              <CalendarClock className="h-4 w-4 mr-2" />
              Request Late
            </Button>
            <div className="flex flex-col items-end">
              <span className="text-sm font-medium text-neutral-200">
                {session?.user?.name}
              </span>
              <span className="text-xs text-neutral-500">{session?.user?.email}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut()}
              className="border-neutral-700 bg-transparent text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">

        {/* Top Section: Timer & Action Area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Welcome & Timer Card */}
          <Card className="bg-neutral-900/50 border-neutral-800 backdrop-blur-sm overflow-hidden relative group shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-8 relative z-10 flex flex-col justify-center h-full min-h-[250px]">
              {!currentAttendance?.checkInAt && timeLeft ? (
                <div className="text-center space-y-4">
                  {timeLeft === 'SHIFT_ACTIVE' ? (
                    <>
                      <Badge variant="outline" className="border-amber-700 text-amber-500 bg-amber-950/50 py-1 px-3 animate-pulse">
                        Shift In Progress
                      </Badge>
                      <div className="space-y-1">
                        <h2 className="text-4xl font-bold text-white tracking-tight">
                          You are Late
                        </h2>
                        <p className="text-neutral-500">Your shift started at {userTimes.checkInTime}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Badge variant="outline" className="border-neutral-700 text-neutral-400 bg-neutral-800/50 py-1 px-3">
                        Upcoming Shift
                      </Badge>
                      <div className="space-y-1">
                        <h2 className="text-5xl font-bold text-white tracking-tight tabular-nums">
                          {timeLeft}
                        </h2>
                        <p className="text-neutral-500">left until check-in at {userTimes.checkInTime}</p>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <h2 className="text-3xl font-bold text-white">
                    {currentAttendance?.checkInAt && !currentAttendance?.checkOutAt
                      ? "You are currently checked in."
                      : currentAttendance?.checkOutAt
                        ? "Shift Complete."
                        : `Welcome, ${session?.user?.name?.split(' ')[0]}!`}
                  </h2>
                  <p className="text-neutral-400 text-lg">
                    {currentAttendance?.checkInAt && !currentAttendance?.checkOutAt
                      ? "Don't forget to check out when you're done."
                      : currentAttendance?.checkOutAt
                        ? "Have a good rest!"
                        : `Ready to start your shift? Scheduled start: ${userTimes.checkInTime}`}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Card */}
          <Card className="bg-neutral-900/50 border-neutral-800 backdrop-blur-sm flex flex-col justify-center shadow-xl">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-neutral-200">Current Status</CardTitle>
              <CardDescription className="text-neutral-500">
                {formatDate(new Date())}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-2">
              {locationError && (
                <div className="mb-4 p-3 bg-amber-950/30 border border-amber-900/50 rounded-lg text-sm text-amber-500 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {locationError}
                </div>
              )}

              {!currentAttendance?.checkInAt ? (
                <div className="text-center space-y-6">
                  <div className="w-24 h-24 rounded-full bg-neutral-800/50 mx-auto flex items-center justify-center border border-neutral-700/50">
                    <div className="w-20 h-20 rounded-full bg-neutral-800 flex items-center justify-center shadow-inner">
                      <span className="text-neutral-500 text-xs font-semibold">OFF DUTY</span>
                    </div>
                  </div>
                  <Button
                    size="lg"
                    onClick={handleCheckIn}
                    disabled={checkingIn}
                    className="w-full max-w-xs h-12 text-lg bg-white text-black hover:bg-neutral-200 border-0 transition-all font-medium"
                  >
                    {checkingIn ? 'Checking In...' : 'Check In Now'}
                  </Button>
                </div>
              ) : !currentAttendance.checkOutAt ? (
                <div className="text-center space-y-6">
                  <div className="w-24 h-24 rounded-full bg-emerald-950/30 mx-auto flex items-center justify-center border border-emerald-900/50 animate-pulse">
                    <div className="w-20 h-20 rounded-full bg-emerald-900/20 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                      <span className="text-emerald-500 font-bold text-xs">ON DUTY</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-neutral-500">Checked in at</p>
                    <p className="text-2xl font-semibold text-white">
                      {formatDateTime(new Date(currentAttendance.checkInAt))}
                    </p>
                    <div className="pt-2">{getStatusBadge(currentAttendance.status)}</div>
                  </div>
                  <Button
                    size="lg"
                    variant="destructive"
                    onClick={handleCheckOut}
                    disabled={checkingOut}
                    className="w-full max-w-xs h-12 text-lg bg-red-900/80 hover:bg-red-900 text-red-100 border border-red-800/50 shadow-lg shadow-red-900/10"
                  >
                    {checkingOut ? 'Checking Out...' : 'End Shift'}
                  </Button>
                </div>
              ) : (
                <div className="text-center space-y-6">
                  <div className="w-24 h-24 rounded-full bg-neutral-800/50 mx-auto flex items-center justify-center border border-neutral-700/50">
                    <CheckCircle className="w-10 h-10 text-neutral-400" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-neutral-500 text-sm">Shift Complete</p>
                    <p className="text-xl font-medium text-white">
                      {formatTime(new Date(currentAttendance.checkInAt))} - {formatTime(new Date(currentAttendance.checkOutAt))}
                    </p>
                    <div className="pt-2">{getStatusBadge(currentAttendance.status)}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Animated Stat Cards */}
          {[
            { label: 'Total Shifts', value: stats.totalDays, icon: Timer, color: 'text-neutral-200', bg: 'bg-neutral-800', border: 'border-neutral-800' },
            { label: 'On Time', value: stats.present, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-950/30', border: 'border-emerald-900/30' },
            { label: 'Late', value: stats.late, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-950/30', border: 'border-amber-900/30' },
            { label: 'Absent', value: stats.absent, icon: XCircle, color: 'text-red-400', bg: 'bg-red-950/30', border: 'border-red-900/30' },
          ].map((stat, i) => (
            <Card key={i} className={`bg-neutral-900/50 backdrop-blur-sm border ${stat.border} hover:bg-neutral-800/80 transition-all duration-300 group`}>
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-neutral-500 text-sm">{stat.label}</p>
                  <p className="text-3xl font-bold text-neutral-200 mt-1 group-hover:scale-110 origin-left transition-transform">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-xl ${stat.bg}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Manager Section: Team Tasks */}
        {/* Manager Section: Team Tasks */}
        {(session?.user?.role as string) === 'MANAGER' && (
          <Card className="bg-neutral-900/50 border-neutral-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-neutral-200 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                Team Task Assignment
              </CardTitle>
              <CardDescription className="text-neutral-500">
                Assign daily tasks to your team members.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label className="text-neutral-200">Select Employee</Label>
                  <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                    <SelectTrigger className="bg-neutral-950 border-neutral-800 text-neutral-200">
                      <SelectValue placeholder="Select employee..." />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-200">
                      {managerEmployees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-neutral-200">Date</Label>
                  <Input
                    type="date"
                    value={managerTaskDate}
                    onChange={(e) => setManagerTaskDate(e.target.value)}
                    className="bg-neutral-950 border-neutral-800 text-neutral-200"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-neutral-200">Task Title</Label>
                <div className="flex gap-2">
                  <Input
                    value={managerTaskTitle}
                    onChange={(e) => setManagerTaskTitle(e.target.value)}
                    placeholder="e.g. Organize files..."
                    className="bg-neutral-950 border-neutral-800 text-neutral-200"
                  />
                  <Button
                    onClick={handleManagerAssignTask}
                    disabled={loadingManagerData || !selectedEmployeeId || !managerTaskTitle}
                    className="bg-blue-600 hover:bg-blue-500 text-white"
                  >
                    {loadingManagerData ? 'Assigning...' : 'Assign'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Daily Tasks Section */}
        <Card className="bg-neutral-900/50 border-neutral-800 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-neutral-200 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-purple-400" />
              Today&apos;s Tasks
            </CardTitle>
            <CardDescription className="text-neutral-500">
              Complete all tasks to check out.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tasks.length === 0 ? (
              <p className="text-neutral-600 text-sm">No tasks assigned for today.</p>
            ) : (
              <div className="space-y-3">
                {tasks.map(task => (
                  <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg bg-neutral-800/30 border border-neutral-800 hover:border-neutral-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => handleToggleTask(task.id)}
                      className="w-5 h-5 rounded border-neutral-600 bg-neutral-800 text-purple-600 focus:ring-purple-500/50 cursor-pointer"
                    />
                    <span className={task.completed ? "text-neutral-500 line-through" : "text-neutral-200"}>
                      {task.title}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Charts & History Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chart */}
          <Card className="lg:col-span-1 bg-neutral-900/50 border-neutral-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-neutral-200 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-neutral-400" />
                Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis type="number" stroke="rgba(255,255,255,0.2)" hide />
                    <YAxis dataKey="name" type="category" stroke="rgba(255,255,255,0.5)" width={80} tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#171717', border: '1px solid #404040', color: '#fff' }}
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* History Table */}
          <Card className="lg:col-span-2 bg-neutral-900/50 border-neutral-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-neutral-200">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-neutral-800 hover:bg-neutral-800/50">
                      <TableHead className="text-neutral-500">Date</TableHead>
                      <TableHead className="text-neutral-500">Check In</TableHead>
                      <TableHead className="text-neutral-500">Check Out</TableHead>
                      <TableHead className="text-neutral-500">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.length === 0 ? (
                      <TableRow className="border-neutral-800">
                        <TableCell colSpan={4} className="text-center text-neutral-600 py-8">
                          No recent attendance records
                        </TableCell>
                      </TableRow>
                    ) : (
                      history.map((attendance) => (
                        <TableRow key={attendance.id} className="border-neutral-800 hover:bg-neutral-800/50 transition-colors">
                          <TableCell className="text-neutral-300 font-medium">
                            {formatDate(new Date(attendance.shiftDate))}
                          </TableCell>
                          <TableCell className="text-neutral-400">
                            {attendance.checkInAt ? formatTime(new Date(attendance.checkInAt)) : '-'}
                          </TableCell>
                          <TableCell className="text-neutral-400">
                            {attendance.checkOutAt ? formatTime(new Date(attendance.checkOutAt)) : '-'}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(attendance.status)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>


      {/* Late Request Dialog */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="bg-neutral-900/95 backdrop-blur-xl border-neutral-800 text-neutral-200 sm:max-w-[500px] w-[95vw] rounded-3xl shadow-2xl p-0 gap-0 overflow-hidden">
          <div className="bg-gradient-to-b from-white/5 to-transparent px-6 py-6 sm:px-8 sm:py-8 border-b border-white/5">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-400">Request Late Arrival</DialogTitle>
              <DialogDescription className="text-neutral-500 text-base mt-2">
                Running behind schedule? Let Talha know to update your shift.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-neutral-300">Date</Label>
              <div className="relative">
                <Input
                  type="date"
                  value={requestDate}
                  onChange={(e) => setRequestDate(e.target.value)}
                  className="bg-neutral-800/50 border-neutral-700 text-neutral-200 focus:ring-purple-500/50 focus:border-purple-500 h-11 rounded-xl transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-neutral-300">Expected Arrival Time</Label>
              <div className="flex gap-2">
                <select
                  value={(() => {
                    const [h] = requestTime.split(':')
                    if (!h) return '12'
                    let hours = parseInt(h)
                    if (hours === 0) return '12'
                    if (hours > 12) return (hours - 12).toString().padStart(2, '0')
                    return hours.toString().padStart(2, '0')
                  })()}
                  onChange={(e) => {
                    const newHour = parseInt(e.target.value)
                    const [_, m] = requestTime.split(':')
                    const minutes = m ? parseInt(m) : 0
                    const currentH = requestTime ? parseInt(requestTime.split(':')[0]) : 12
                    const isPM = currentH >= 12

                    let finalH = newHour
                    if (isPM && newHour !== 12) finalH += 12
                    else if (!isPM && newHour === 12) finalH = 0

                    const timeStr = `${finalH.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
                    setRequestTime(timeStr)
                  }}
                  className="bg-neutral-800/50 border border-neutral-700 text-neutral-200 rounded-xl px-3 h-11 focus:ring-purple-500/50 focus:border-purple-500 flex-1 transition-all appearance-none text-center"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                    <option key={h} value={h.toString().padStart(2, '0')}>
                      {h.toString().padStart(2, '0')}
                    </option>
                  ))}
                </select>
                <div className="flex items-center text-neutral-500">:</div>
                <select
                  value={requestTime.split(':')[1] || '00'}
                  onChange={(e) => {
                    const [h] = requestTime.split(':')
                    const hour = h || '09'
                    setRequestTime(`${hour}:${e.target.value}`)
                  }}
                  className="bg-neutral-800/50 border border-neutral-700 text-neutral-200 rounded-xl px-3 h-11 focus:ring-purple-500/50 focus:border-purple-500 flex-1 transition-all appearance-none text-center"
                >
                  {['00', '15', '30', '45'].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <select
                  value={(() => {
                    const [h] = requestTime.split(':')
                    if (!h) return 'AM'
                    const hours = parseInt(h)
                    return hours >= 12 ? 'PM' : 'AM'
                  })()}
                  onChange={(e) => {
                    const [h, m] = requestTime.split(':')
                    let hours = h ? parseInt(h) : 9 // Default 9
                    const minutes = m || '00'
                    const newPeriod = e.target.value

                    if (newPeriod === 'PM' && hours < 12) hours += 12
                    else if (newPeriod === 'AM' && hours >= 12) hours -= 12

                    setRequestTime(`${hours.toString().padStart(2, '0')}:${minutes}`)
                  }}
                  className="bg-neutral-800/50 border border-neutral-700 text-neutral-200 rounded-xl px-3 h-11 focus:ring-purple-500/50 focus:border-purple-500 w-20 transition-all appearance-none text-center font-medium"
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-neutral-300">Reason</Label>
              <Textarea
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                placeholder="Briefly explain why you are late..."
                className="bg-neutral-800/50 border-neutral-700 text-neutral-200 focus:ring-purple-500/50 focus:border-purple-500 min-h-[100px] rounded-xl resize-none transition-all placeholder:text-neutral-600"
              />
            </div>
          </div>

          <DialogFooter className="bg-neutral-900/50 p-6 sm:p-8 pt-2 sm:pt-2 flex-col-reverse sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={() => setRequestOpen(false)}
              className="w-full sm:w-auto border-neutral-700 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 h-11 rounded-xl transition-colors"
            >
              Cancel
            </Button>
            <Button
              onClick={handleLateRequest}
              className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium h-11 rounded-xl shadow-lg shadow-purple-900/20 transition-all active:scale-[0.98]"
            >
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  )
}
