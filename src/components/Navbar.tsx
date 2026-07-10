import { useState } from 'react'
import { signOut } from 'firebase/auth'
import { Link, useLocation } from 'react-router-dom'
import { auth } from '../firebase'
import ConfirmModal from './ConfirmModal'

interface NavbarProps {
  displayName: string | null
  role: 'student' | 'admin'
}

export default function Navbar({ displayName, role }: NavbarProps) {
  const { pathname } = useLocation()
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">UniBooker</h1>
        <div className="flex items-center gap-4">
          <Link
            to="/dashboard"
            className={`text-sm font-medium transition ${
              pathname === '/dashboard'
                ? 'text-blue-600 underline decoration-blue-600 underline-offset-4'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Reservar
          </Link>
          {role === 'admin' && (
            <Link
              to="/admin"
              className={`text-sm font-medium transition ${
                pathname === '/admin'
                  ? 'text-blue-600 underline decoration-blue-600 underline-offset-4'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Panel de Admin
            </Link>
          )}
          <span className="text-sm text-gray-600">{displayName}</span>
          <button
            onClick={() => setShowSignOutConfirm(true)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>

      {showSignOutConfirm && (
        <ConfirmModal
          message="¿Cerrar sesión?"
          confirmLabel="Cerrar sesión"
          onConfirm={() => signOut(auth)}
          onClose={() => setShowSignOutConfirm(false)}
        />
      )}
    </nav>
  )
}
