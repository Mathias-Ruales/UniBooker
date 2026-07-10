import { useEffect, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { Navigate, Route, Routes } from 'react-router-dom'
import { auth, db } from './firebase'
import Auth from './components/Auth'
import Navbar from './components/Navbar'
import Dashboard from './components/Dashboard'
import AdminDashboard from './components/AdminDashboard'

interface AuthUser {
  user: User
  role: 'student' | 'admin'
}

export default function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const snap = await getDoc(doc(db, 'users', u.uid))
        const role = (snap.data()?.role as 'student' | 'admin') || 'student'
        setAuthUser({ user: u, role })
      } else {
        setAuthUser(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          authUser ? <Navigate to="/dashboard" replace /> : <Auth />
        }
      />
      <Route
        path="/dashboard"
        element={
          authUser ? (
            <div className="min-h-screen bg-gray-50">
              <Navbar
                displayName={authUser.user.displayName}
                role={authUser.role}
              />
              <Dashboard userId={authUser.user.uid} />
            </div>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/admin"
        element={
          authUser?.role === 'admin' ? (
            <div className="min-h-screen bg-gray-50">
              <Navbar
                displayName={authUser.user.displayName}
                role={authUser.role}
              />
              <AdminDashboard />
            </div>
          ) : authUser ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
