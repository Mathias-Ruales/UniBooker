import { signOut } from 'firebase/auth'
import { Link } from 'react-router-dom'
import { auth } from '../firebase'

interface NavbarProps {
  displayName: string | null
  role: 'student' | 'admin'
}

export default function Navbar({ displayName, role }: NavbarProps) {
  return (
    <nav className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
      <h1 className="text-xl font-bold text-gray-900">UniBooker</h1>
      <div className="flex items-center gap-4">
        <Link
          to="/dashboard"
          className="text-sm font-medium text-gray-600 hover:text-gray-900 transition"
        >
          Reservar
        </Link>
        {role === 'admin' && (
          <Link
            to="/admin"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition"
          >
            Panel de Admin
          </Link>
        )}
        <span className="text-sm text-gray-600">{displayName}</span>
        <button
          onClick={() => signOut(auth)}
          className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition"
        >
          Cerrar Sesión
        </button>
      </div>
    </nav>
  )
}
