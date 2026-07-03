import { signOut } from 'firebase/auth'
import { auth } from '../firebase'

interface NavbarProps {
  displayName: string | null
}

export default function Navbar({ displayName }: NavbarProps) {
  return (
    <nav className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
      <h1 className="text-xl font-bold text-gray-900">UniBook</h1>
      <div className="flex items-center gap-4">
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
