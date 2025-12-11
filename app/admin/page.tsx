'use client'

import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { formatDate, formatTime } from '@/lib/attendance'
import { getGoogleMapsLink } from '@/lib/location'
import { MapPin, LogOut, Users, TrendingUp, Download, Plus, Edit, Trash2, AlertTriangle, CheckCircle, Clock, XCircle, BarChart3, PieChart } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, Legend } from 'recharts'

interface EmployeeStats {
  total: number
  onTime: number
  late: number
  absent: number
  noCheckout: number
  onTimeRate: number
  lateRate: number
  absentRate: number
  isRedFlag: boolean
}

interface Employee {
  id: string
  name: string
  email: string
  checkInTime: string | null
  checkOutTime: string | null
  createdAt: string
  stats: EmployeeStats
  _count: {
    attendances: number
  }
}

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

interface Analytics {
  weeklyTrends: Array<{
    date: string
    fullDate: string
    onTime: number
    late: number
    absent: number
    noCheckout: number
  }>
  statusDistribution: Array<{
    name: string
    value: number
    color: string
  }>
  summary: {
    totalEmployees: number
    totalOnTime: number
    totalLate: number
    totalAbsent: number
    totalNoCheckout: number
    total: number
  }
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newEmployee, setNewEmployee] = useState({ name: '', email: '', password: '' })
  const [editTimeDialogOpen, setEditTimeDialogOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [editTimes, setEditTimes] = useState({ checkInTime: '', checkOutTime: '' })
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null)
  const [filters, setFilters] = useState({
    userId: '',
    status: '',
    startDate: '',
    endDate: '',
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN') {
      router.push('/dashboard')
      return
    }
    if (status === 'authenticated') {
      loadData()
    }
  }, [status, session, router])

  const loadData = async () => {
    try {
      const [employeesRes, attendanceRes, analyticsRes] = await Promise.all([
        fetch('/api/admin/employees'),
        fetch('/api/admin/attendance?' + new URLSearchParams({
          ...(filters.userId && { userId: filters.userId }),
          ...(filters.status && { status: filters.status }),
          ...(filters.startDate && { startDate: filters.startDate }),
          ...(filters.endDate && { endDate: filters.endDate }),
        })),
        fetch('/api/admin/analytics'),
      ])

      const employeesData = await employeesRes.json()
      const attendanceData = await attendanceRes.json()
      const analyticsData = await analyticsRes.json()

      setEmployees(employeesData.employees || [])
      setAttendances(attendanceData.attendances || [])
      setAnalytics(analyticsData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'ADMIN') {
      loadData()
    }
  }, [filters])

  const handleCreateEmployee = async () => {
    try {
      const response = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmployee),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create employee')
      }

      setCreateDialogOpen(false)
      setNewEmployee({ name: '', email: '', password: '' })
      loadData()
    } catch (error: any) {
      alert(error.message || 'Failed to create employee')
    }
  }

  const handleDeleteEmployee = async (employee: Employee) => {
    try {
      const response = await fetch(`/api/admin/employees/${employee.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete employee')
      }

      setDeletingEmployee(null)
      loadData()
    } catch (error: any) {
      alert(error.message || 'Failed to delete employee')
    }
  }

  const handleDeleteAttendance = async (attendanceId: string) => {
    if (!confirm('Are you sure you want to delete this attendance record?')) return

    try {
      const response = await fetch(`/api/admin/attendance/${attendanceId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete attendance')
      }

      loadData()
    } catch (error: any) {
      alert(error.message || 'Failed to delete attendance')
    }
  }

  const handleExport = () => {
    const params = new URLSearchParams({
      ...(filters.userId && { userId: filters.userId }),
      ...(filters.status && { status: filters.status }),
      ...(filters.startDate && { startDate: filters.startDate }),
      ...(filters.endDate && { endDate: filters.endDate }),
    })

    window.open(`/api/admin/export?${params}`, '_blank')
  }

  const handleEditTimes = (employee: Employee) => {
    setEditingEmployee(employee)
    setEditTimes({
      checkInTime: employee.checkInTime || '',
      checkOutTime: employee.checkOutTime || '',
    })
    setEditTimeDialogOpen(true)
  }

  const handleSaveTimes = async () => {
    if (!editingEmployee) return

    try {
      const response = await fetch(`/api/admin/employees/${editingEmployee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkInTime: editTimes.checkInTime || null,
          checkOutTime: editTimes.checkOutTime || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update times')
      }

      setEditTimeDialogOpen(false)
      setEditingEmployee(null)
      loadData()
    } catch (error: any) {
      alert(error.message || 'Failed to update times')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'EARLY':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Early</Badge>
      case 'ON_TIME':
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">On Time</Badge>
      case 'LATE':
        return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">Late</Badge>
      case 'ABSENT':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Absent</Badge>
      case 'NO_CHECKOUT':
        return <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20">No Checkout</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-neutral-800 border-t-neutral-400 rounded-full mx-auto mb-4"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 font-sans text-neutral-200">
      {/* Header */}
      <div className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="h-10 w-10 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center shadow-lg">
              <BarChart3 className="h-5 w-5 text-neutral-200" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-100">Admin Dashboard</h1>
              <p className="text-xs text-neutral-500">Attendance Management System</p>
            </div>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
            <span className="text-sm font-medium text-neutral-200">
              {session?.user?.name}
            </span>
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

      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-neutral-900/50 border-neutral-800 backdrop-blur-sm overflow-hidden group hover:border-neutral-700 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-neutral-500 text-sm">Total Employees</p>
                  <p className="text-3xl font-bold text-neutral-200 mt-1">{analytics?.summary?.totalEmployees || 0}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-neutral-800 flex items-center justify-center">
                  <Users className="h-6 w-6 text-neutral-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-neutral-900/50 border-neutral-800 backdrop-blur-sm overflow-hidden group hover:border-emerald-900/50 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-neutral-500 text-sm">On Time</p>
                  <p className="text-3xl font-bold text-neutral-200 mt-1">{analytics?.summary.totalOnTime || 0}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-emerald-950/30 flex items-center justify-center border border-emerald-900/30">
                  <CheckCircle className="h-6 w-6 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-neutral-900/50 border-neutral-800 backdrop-blur-sm overflow-hidden group hover:border-amber-900/50 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-neutral-500 text-sm">Late Arrivals</p>
                  <p className="text-3xl font-bold text-neutral-200 mt-1">{analytics?.summary.totalLate || 0}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-amber-950/30 flex items-center justify-center border border-amber-900/30">
                  <Clock className="h-6 w-6 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-neutral-900/50 border-neutral-800 backdrop-blur-sm overflow-hidden group hover:border-red-900/50 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6 relative">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-neutral-500 text-sm">Absent</p>
                  <p className="text-3xl font-bold text-neutral-200 mt-1">{analytics?.summary.totalAbsent || 0}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-red-950/30 flex items-center justify-center border border-red-900/30">
                  <XCircle className="h-6 w-6 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Bar Chart */}
          <Card className="lg:col-span-2 bg-neutral-900/50 border-neutral-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-neutral-200 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-neutral-400" />
                Weekly Attendance Trends
              </CardTitle>
              <CardDescription className="text-neutral-500">Last 7 days overview</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics?.weeklyTrends || []}>
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
                    <Bar dataKey="onTime" name="On Time" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="late" name="Late" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="absent" name="Absent" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Pie Chart */}
          <Card className="bg-neutral-900/50 border-neutral-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-neutral-200 flex items-center gap-2">
                <PieChart className="h-5 w-5 text-neutral-400" />
                Status Distribution
              </CardTitle>
              <CardDescription className="text-neutral-500">Overall breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={analytics?.statusDistribution || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {analytics?.statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#171717',
                        border: '1px solid #404040',
                        borderRadius: '8px',
                        color: 'white'
                      }}
                    />
                    <Legend
                      wrapperStyle={{ color: '#a3a3a3' }}
                      formatter={(value) => <span className="text-neutral-400">{value}</span>}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Employee Management */}
        <Card className="mb-8 bg-neutral-900/50 border-neutral-800 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-neutral-200 flex items-center gap-2">
                <Users className="h-5 w-5 text-neutral-400" />
                Employees
              </CardTitle>
              <CardDescription className="text-neutral-500">Manage your team members</CardDescription>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-white text-black hover:bg-neutral-200 border-0">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Employee
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-neutral-900 border-neutral-800 text-neutral-200">
                <DialogHeader>
                  <DialogTitle>Create New Employee</DialogTitle>
                  <DialogDescription className="text-neutral-500">
                    Create a new employee account. They will use this password to login.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-neutral-200">Name</Label>
                    <Input
                      id="name"
                      value={newEmployee.name}
                      onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                      placeholder="John Doe"
                      className="bg-neutral-950 border-neutral-800 text-neutral-200 placeholder:text-neutral-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-neutral-200">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newEmployee.email}
                      onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                      placeholder="john@example.com"
                      className="bg-neutral-950 border-neutral-800 text-neutral-200 placeholder:text-neutral-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-neutral-200">Temporary Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={newEmployee.password}
                      onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                      placeholder="Enter temporary password"
                      className="bg-neutral-950 border-neutral-800 text-neutral-200 placeholder:text-neutral-600"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="border-neutral-700 text-neutral-400 hover:bg-neutral-800 hover:text-white">
                    Cancel
                  </Button>
                  <Button onClick={handleCreateEmployee} className="bg-white text-black hover:bg-neutral-200">Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-neutral-800 hover:bg-neutral-800/50">
                    <TableHead className="text-neutral-500">Name</TableHead>
                    <TableHead className="text-neutral-500">Email</TableHead>
                    <TableHead className="text-neutral-500">Performance</TableHead>
                    <TableHead className="text-neutral-500">On-Time Rate</TableHead>
                    <TableHead className="text-neutral-500">Late/Absent</TableHead>
                    <TableHead className="text-neutral-500">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.length === 0 ? (
                    <TableRow className="border-neutral-800">
                      <TableCell colSpan={6} className="text-center text-neutral-500 py-8">
                        No employees found
                      </TableCell>
                    </TableRow>
                  ) : (
                    employees.map((employee) => (
                      <TableRow
                        key={employee.id}
                        className={`border-neutral-800 hover:bg-neutral-800/50 transition-colors ${employee.stats.isRedFlag ? 'bg-red-900/10 hover:bg-red-900/20' : ''
                          }`}
                      >
                        <TableCell className="font-medium text-neutral-200">
                          <div className="flex items-center gap-2">
                            {employee.stats.isRedFlag && (
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            )}
                            {employee.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-neutral-400">{employee.email}</TableCell>
                        <TableCell>
                          {employee.stats.isRedFlag ? (
                            <Badge className="bg-red-950/30 text-red-400 border-red-900/30">At Risk</Badge>
                          ) : employee.stats.total >= 5 ? (
                            <Badge className="bg-emerald-950/30 text-emerald-400 border-emerald-900/30">Good</Badge>
                          ) : (
                            <Badge className="bg-neutral-800 text-neutral-400 border-neutral-700">New</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-2 bg-neutral-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all"
                                style={{ width: `${employee.stats.onTimeRate}%` }}
                              />
                            </div>
                            <span className="text-neutral-400 text-sm">{employee.stats.onTimeRate}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-neutral-400">
                          <span className="text-amber-500">{employee.stats.late}</span>
                          {' / '}
                          <span className="text-red-500">{employee.stats.absent}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/admin/employee/${employee.id}`)}
                              className="bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700 hover:text-white"
                              title="View History"
                            >
                              <TrendingUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditTimes(employee)}
                              className="bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700 hover:text-white"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="bg-neutral-800 border-red-900/50 text-red-500 hover:bg-red-950/50 hover:text-red-400"
                                  onClick={() => setDeletingEmployee(employee)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-neutral-900 border-neutral-800">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-neutral-200">Delete Employee?</AlertDialogTitle>
                                  <AlertDialogDescription className="text-neutral-500">
                                    This will permanently delete <strong className="text-white">{employee.name}</strong> and all their attendance records. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="bg-transparent border-neutral-700 text-neutral-400 hover:bg-neutral-800 hover:text-white">Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteEmployee(employee)} className="bg-red-600 hover:bg-red-700 text-white border-0">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card className="mb-8 bg-neutral-900/50 border-neutral-800 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-neutral-200 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-neutral-400" />
              Attendance Overview
            </CardTitle>
            <CardDescription className="text-neutral-500">View and filter attendance records</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="space-y-2">
                <Label className="text-white/70">Employee</Label>
                <Select
                  value={filters.userId || "all"}
                  onValueChange={(value) => setFilters({ ...filters, userId: value === "all" ? "" : value })}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="All employees" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10">
                    <SelectItem value="all" className="text-white hover:bg-white/10">All employees</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id} className="text-white hover:bg-white/10">
                        {emp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Status</Label>
                <Select
                  value={filters.status || "all"}
                  onValueChange={(value) => setFilters({ ...filters, status: value === "all" ? "" : value })}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10">
                    <SelectItem value="all" className="text-white hover:bg-white/10">All statuses</SelectItem>
                    <SelectItem value="ON_TIME" className="text-white hover:bg-white/10">On Time</SelectItem>
                    <SelectItem value="LATE" className="text-white hover:bg-white/10">Late</SelectItem>
                    <SelectItem value="ABSENT" className="text-white hover:bg-white/10">Absent</SelectItem>
                    <SelectItem value="NO_CHECKOUT" className="text-white hover:bg-white/10">No Checkout</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Start Date</Label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">End Date</Label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleExport} className="border-white/20 text-white hover:bg-white/10">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Table */}
        <Card className="bg-black/40 border-white/10 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white">Attendance Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-white/5">
                    <TableHead className="text-white/70">Employee</TableHead>
                    <TableHead className="text-white/70">Date</TableHead>
                    <TableHead className="text-white/70">Check In</TableHead>
                    <TableHead className="text-white/70">Check Out</TableHead>
                    <TableHead className="text-white/70">Status</TableHead>
                    <TableHead className="text-white/70">Location</TableHead>
                    <TableHead className="text-white/70">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendances.length === 0 ? (
                    <TableRow className="border-white/10">
                      <TableCell colSpan={7} className="text-center text-white/50">
                        No attendance records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    attendances.map((attendance) => (
                      <TableRow key={attendance.id} className="border-white/10 hover:bg-white/5">
                        <TableCell className="font-medium text-white">
                          {attendance.user.name}
                        </TableCell>
                        <TableCell className="text-white/70">{formatDate(new Date(attendance.shiftDate))}</TableCell>
                        <TableCell className="text-white/70">
                          {attendance.checkInAt
                            ? formatTime(new Date(attendance.checkInAt))
                            : 'N/A'}
                        </TableCell>
                        <TableCell className="text-white/70">
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
                              className="text-purple-400 hover:text-purple-300 flex items-center gap-1"
                            >
                              <MapPin className="h-4 w-4" />
                              View
                            </a>
                          ) : (
                            <span className="text-white/30 text-sm">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/admin/attendance/${attendance.id}`)}
                              className="border-white/20 text-white hover:bg-white/10"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteAttendance(attendance.id)}
                              className="border-red-500/30 text-red-500 hover:bg-red-500/10 hover:border-red-500/50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Edit Times Dialog */}
        <Dialog open={editTimeDialogOpen} onOpenChange={setEditTimeDialogOpen}>
          <DialogContent className="bg-slate-900 border-white/10 text-white">
            <DialogHeader>
              <DialogTitle>Edit Employee Times</DialogTitle>
              <DialogDescription className="text-white/50">
                Set custom check-in and check-out times for {editingEmployee?.name}. Leave empty to use default times.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Label htmlFor="checkInTime" className="text-white">Check-In Time (HH:mm)</Label>
              <Input
                id="checkInTime"
                type="time"
                value={editTimes.checkInTime}
                onChange={(e) => setEditTimes({ ...editTimes, checkInTime: e.target.value })}
                placeholder="21:00"
                className="bg-white/5 border-white/10 text-white"
              />
              <div className="space-y-2">
                <Label htmlFor="checkOutTime" className="text-white">Check-Out Time (HH:mm)</Label>
                <Input
                  id="checkOutTime"
                  type="time"
                  value={editTimes.checkOutTime}
                  onChange={(e) => setEditTimes({ ...editTimes, checkOutTime: e.target.value })}
                  placeholder="05:00"
                  className="bg-white/5 border-white/10 text-white"
                />
                <p className="text-xs text-white/30">Default: 05:00 (5:00 AM)</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditTimeDialogOpen(false)} className="border-white/20 text-white hover:bg-white/10">
                Cancel
              </Button>
              <Button onClick={handleSaveTimes} className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
