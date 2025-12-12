

import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowRight, CheckCircle2, ShieldCheck, Zap } from 'lucide-react'
import { MapPin, Calendar, Clock, LogOut, CheckCircle, AlertTriangle, AlertCircle, CalendarClock } from 'lucide-react'

export default function HomePage() {


  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 selection:bg-neutral-800 selection:text-white overflow-hidden relative">

      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-900/10 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '6s' }} />
      </div>

      <div className="container mx-auto px-4 py-8 relative z-10 flex flex-col items-center justify-center min-h-screen">

        {/* Navigation / Header */}
        <header className="fixed top-0 w-full border-b border-white/5 bg-black/50 backdrop-blur-xl z-50">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative w-8 h-8">
                <Image
                  src="/icon.png"
                  alt="Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-500">
                AI Attend
              </span>
            </div>
            <nav className="flex items-center gap-4">
              <Link href="/login">
                <Button size="sm" className="bg-white text-black hover:bg-neutral-200 transition-colors">
                  Employee Login
                </Button>
              </Link>
            </nav>
          </div>
        </header>
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto mt-24 md:mt-0 animate-in fade-in slide-in-from-bottom-8 duration-1000 px-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900/50 border border-neutral-800 text-neutral-400 text-sm mb-8 hover:border-neutral-700 transition-colors cursor-default">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>System Operational</span>
          </div>

          <h1 className="text-4xl md:text-7xl font-bold tracking-tight mb-8 text-transparent bg-clip-text bg-gradient-to-b from-white to-neutral-500">
            Intelligent Attendance<br />
            <span className="text-white">For Modern Teams.</span>
          </h1>

          <p className="text-lg md:text-xl text-neutral-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            Experience the next generation of workforce management.
            Seamless tracking, automated insights, and precise analytics powered by advanced algorithms.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-20">
            <Link href="/login" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto bg-white text-black hover:bg-neutral-200 h-12 px-8 text-base font-semibold shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)] transition-all hover:scale-105 hover:shadow-[0_0_30px_-5px_rgba(255,255,255,0.4)]">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 w-full max-w-6xl animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200">
          <Card className="bg-neutral-900/40 border-neutral-800 backdrop-blur-sm hover:bg-neutral-900/60 transition-colors group">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-neutral-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-xl text-white">Instant Check-In</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-neutral-400">
                Lightning fast attendance logging with verifiable location data. One click is all it takes.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-neutral-900/40 border-neutral-800 backdrop-blur-sm hover:bg-neutral-900/60 transition-colors group">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-neutral-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <ShieldCheck className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-xl text-white">Verified Security</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-neutral-400">
                Enterprise-grade security ensures your data is safe. Immutable records and secure sessions.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-neutral-900/40 border-neutral-800 backdrop-blur-sm hover:bg-neutral-900/60 transition-colors group">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-neutral-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <CheckCircle2 className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-xl text-white">Smart Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-neutral-400">
                Gain deep insights into workforce patterns with our advanced dashboard and reporting tools.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <footer className="mt-20 py-8 border-t border-neutral-900 w-full text-center text-neutral-600 text-sm">
          <p>© 2025 Intelligent Attendance Systems. All rights reserved.</p>
        </footer>

      </div>

      {/* Late Request Dialog */}

    </div>
  )
}
