'use client'

import { useEffect, useState } from 'react'
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

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [currentAttendance, setCurrentAttendance] = useState<Attendance | null>(null)
  const [history, setHistory] = useState<Attendance[]>([])
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
      const [statusRes, historyRes, timesRes] = await Promise.all([
        fetch('/api/attendance/status', { cache: 'no-store' }),
        fetch('/api/attendance/history?limit=14', { cache: 'no-store' }),
        fetch('/api/user/times', { cache: 'no-store' }),
      ])

      const statusData: AttendanceStatus = await statusRes.json()
      const historyData = await historyRes.json()
      const timesData = await timesRes.json()

      setCurrentAttendance(statusData.attendance)
      setHistory(historyData.attendances || [])
      setUserTimes(timesData)

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
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
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
      alert('Request submitted! Admin will be notified.')
    } catch (error) {
      alert('Failed to submit request')
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
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="h-10 w-10 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center shadow-lg">
              <Clock className="h-5 w-5 text-neutral-200" />
            </div>
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
        <DialogContent className="bg-neutral-900 border-neutral-800 text-neutral-200">
          <DialogHeader>
            <DialogTitle>Request Late Arrival</DialogTitle>
            <DialogDescription className="text-neutral-500">
              Notify admin that you will be late. If approved, your schedule will be adjusted.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-neutral-200">Date</Label>
              <Input
                type="date"
                value={requestDate}
                onChange={(e) => setRequestDate(e.target.value)}
                className="bg-neutral-950 border-neutral-800 text-neutral-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-neutral-200">Expected Arrival Time</Label>
              <Input
                type="time"
                value={requestTime}
                onChange={(e) => setRequestTime(e.target.value)}
                className="bg-neutral-950 border-neutral-800 text-neutral-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-neutral-200">Reason</Label>
              <Textarea
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                placeholder="Why are you late?"
                className="bg-neutral-950 border-neutral-800 text-neutral-200"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestOpen(false)} className="border-neutral-700 text-neutral-400 hover:bg-neutral-800">Cancel</Button>
            <Button onClick={handleLateRequest} className="bg-blue-600 hover:bg-blue-700 text-white">Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  )
}
