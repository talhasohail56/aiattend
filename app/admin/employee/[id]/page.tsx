'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDate, formatTime, formatDateTime } from '@/lib/attendance'
import { getGoogleMapsLink } from '@/lib/location'
import { ArrowLeft, MapPin, Download, Calendar } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Attendance {
  id: string
  shiftDate: string
  checkInAt: string | null
  checkOutAt: string | null
  checkInLatitude: number | null
  checkInLongitude: number | null
  status: string
}

interface Stats {
  total: number
  present: number
  late: number
  absent: number
  noCheckout: number
}



export default function EmployeeDetailPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams()
  const employeeId = params.id as string

  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [tasks, setTasks] = useState<Task[]>([]) // Fetched tasks
  const [stats, setStats] = useState<Stats>({
    total: 0,
    present: 0,
    late: 0,
    absent: 0,
    noCheckout: 0,
  })
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Task Management State
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDate, setTaskDate] = useState(new Date().toISOString().split('T')[0])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
        <div className="animate-spin h-8 w-8 border-2 border-neutral-800 border-t-neutral-400 rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 font-sans text-neutral-200">
      <div className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Button
            variant="outline"
            onClick={() => router.push('/admin')}
            className="border-neutral-700 bg-transparent text-neutral-400 hover:bg-neutral-800 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleExport}
              className="border-neutral-700 bg-transparent text-neutral-400 hover:bg-neutral-800 hover:text-white"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card className="bg-neutral-900/50 border-neutral-800 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-neutral-500">Total Days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-neutral-200">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="bg-neutral-900/50 border-neutral-800 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-neutral-500">Present</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-400">{stats.present}</div>
            </CardContent>
          </Card>
          <Card className="bg-neutral-900/50 border-neutral-800 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-neutral-500">Late</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-400">{stats.late}</div>
            </CardContent>
          </Card>
          <Card className="bg-neutral-900/50 border-neutral-800 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-neutral-500">Absent</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-400">{stats.absent}</div>
            </CardContent>
          </Card>
          <Card className="bg-neutral-900/50 border-neutral-800 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-neutral-500">No Checkout</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-neutral-400">{stats.noCheckout}</div>
            </CardContent>
          </Card>
        </div>

        {/* Task Assignment */}
        <Card className="mb-8 bg-neutral-900/50 border-neutral-800 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-neutral-200">Assign Tasks</CardTitle>
            <CardDescription className="text-neutral-500">Manage daily tasks for this employee.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="space-y-2">
                <Label className="text-neutral-200">Date</Label>
                <Input
                  type="date"
                  value={taskDate}
                  onChange={(e) => setTaskDate(e.target.value)}
                  className="bg-neutral-950 border-neutral-800 text-neutral-200"
                />
              </div>
              <div className="space-y-2 flex-1">
                <Label className="text-neutral-200">Task Title</Label>
                <div className="flex gap-2">
                  <Input
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="e.g. Complete safety training"
                    className="bg-neutral-950 border-neutral-800 text-neutral-200"
                  />
                  <Button onClick={handleCreateTask} className="bg-purple-600 hover:bg-purple-500 text-white">
                    Add
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium text-neutral-400 mb-3">Tasks for {taskDate}</h3>
              {tasks.length === 0 ? (
                <p className="text-neutral-600 text-sm italic">No tasks assigned for this date.</p>
              ) : (
                <div className="space-y-2">
                  {tasks.map(task => (
                    <div key={task.id} className="flex items-center justify-between p-3 rounded bg-neutral-800/30 border border-neutral-800">
                      <span className={task.completed ? "text-neutral-500 line-through" : "text-neutral-200"}>
                        {task.title}
                      </span>
                      {task.completed && <Badge className="bg-emerald-900/30 text-emerald-400">Done</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Date Filters */}
        <Card className="mb-8 bg-neutral-900/50 border-neutral-800 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-neutral-200 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-neutral-400" />
              Date Range Filter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-neutral-200">Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-neutral-950 border-neutral-800 text-neutral-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-neutral-200">End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-neutral-950 border-neutral-800 text-neutral-200"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chart */}
        {chartData.length > 0 && (
          <Card className="mb-8 bg-neutral-900/50 border-neutral-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-neutral-200">Attendance Trend (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" />
                  <YAxis stroke="rgba(255,255,255,0.2)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#171717',
                      border: '1px solid #404040',
                      borderRadius: '8px',
                      color: 'white'
                    }}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  />
                  <Bar dataKey="present" fill="#10b981" name="Present" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="late" fill="#f59e0b" name="Late" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="absent" fill="#ef4444" name="Absent" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Attendance Table */}
        <Card className="bg-neutral-900/50 border-neutral-800 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-neutral-200">Attendance History</CardTitle>
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
                    <TableHead className="text-neutral-500">Location</TableHead>
                    <TableHead className="text-neutral-500">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendances.length === 0 ? (
                    <TableRow className="border-neutral-800">
                      <TableCell colSpan={6} className="text-center text-neutral-500 py-8">
                        No attendance records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    attendances.map((attendance) => (
                      <TableRow key={attendance.id} className="border-neutral-800 hover:bg-neutral-800/50 transition-colors">
                        <TableCell className="text-neutral-200">{formatDate(new Date(attendance.shiftDate))}</TableCell>
                        <TableCell className="text-neutral-400">
                          {attendance.checkInAt
                            ? formatTime(new Date(attendance.checkInAt))
                            : 'N/A'}
                        </TableCell>
                        <TableCell className="text-neutral-400">
                          {attendance.checkOutAt
                            ? formatTime(new Date(attendance.checkOutAt))
                            : 'N/A'}
                        </TableCell>
                        <TableCell>{getStatusBadge(attendance.status)}</TableCell>
                        <TableCell>
                          {attendance.checkInLatitude && attendance.checkInLongitude ? (
                            <a
                              href={getGoogleMapsLink(
                                attendance.checkInLatitude,
                                attendance.checkInLongitude
                              ) || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-neutral-400 hover:text-white flex items-center gap-1"
                            >
                              <MapPin className="h-4 w-4" />
                              View
                            </a>
                          ) : (
                            <span className="text-neutral-600 text-sm">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/admin/attendance/${attendance.id}`)} // Assuming this route exists or logic is handled elsewhere
                            className="border-neutral-700 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                          >
                            Edit
                          </Button>
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
  )
}


