import { useEffect, useState } from 'react'
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  doc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Room } from '../types'

const SEED_ROOMS = [
  { name: 'Sala 1', capacity: 2, designation: 'Individual' as const },
  { name: 'Sala 2', capacity: 4, designation: 'Grupal' as const },
  { name: 'Sala 3', capacity: 6, designation: 'Grupal' as const },
  { name: 'Sala 4', capacity: 2, designation: 'Individual' as const },
  { name: 'Sala 5', capacity: 4, designation: 'Grupal' as const },
]

function getTodayRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start.getTime() + 86_400_000)
  return { start: start.getTime(), end: end.getTime() }
}

interface DashboardProps {
  userId: string
}

export default function Dashboard({ userId }: DashboardProps) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [myReservations, setMyReservations] = useState<Map<string, string>>(
    new Map()
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const roomsRef = collection(db, 'rooms')

    const seedIfEmpty = async () => {
      const snapshot = await getDocs(roomsRef)
      if (snapshot.empty) {
        const batch = writeBatch(db)
        for (const room of SEED_ROOMS) {
          const ref = doc(collection(db, 'rooms'))
          batch.set(ref, { ...room, isAvailable: true })
        }
        await batch.commit()
      }
    }

    seedIfEmpty()

    const unsub = onSnapshot(roomsRef, (snapshot) => {
      const list: Room[] = []
      snapshot.forEach((d) => {
        const data = d.data()
        list.push({
          id: d.id,
          name: data.name,
          capacity: data.capacity,
          designation: data.designation,
          isAvailable: data.isAvailable,
        })
      })
      setRooms(list)
      setLoading(false)
    })

    return () => unsub()
  }, [])

  useEffect(() => {
    const { start, end } = getTodayRange()
    const reservationsRef = collection(db, 'reservations')
    const q = query(
      reservationsRef,
      where('userId', '==', userId),
      where('timestamp', '>=', start),
      where('timestamp', '<', end)
    )

    const unsub = onSnapshot(q, (snapshot) => {
      const map = new Map<string, string>()
      snapshot.forEach((d) => {
        const data = d.data()
        map.set(data.roomId, d.id)
      })
      setMyReservations(map)
    })

    return () => unsub()
  }, [userId])

  const handleReservar = async (room: Room) => {
    setError(null)

    if (myReservations.size >= 2) {
      setError('Límite de 2 reservas diarias alcanzado')
      return
    }

    const batch = writeBatch(db)

    const reservationRef = doc(collection(db, 'reservations'))
    batch.set(reservationRef, {
      roomId: room.id,
      userId,
      timestamp: Date.now(),
    })

    const roomRef = doc(db, 'rooms', room.id)
    batch.update(roomRef, { isAvailable: false })

    await batch.commit()
  }

  const handleQuitarReserva = async (room: Room) => {
    setError(null)
    const reservationId = myReservations.get(room.id)
    if (!reservationId) return

    const batch = writeBatch(db)
    batch.delete(doc(db, 'reservations', reservationId))
    batch.update(doc(db, 'rooms', room.id), { isAvailable: true })
    await batch.commit()
  }

  const getButtonConfig = (room: Room) => {
    if (room.isAvailable) {
      return {
        label: 'Reservar',
        action: () => handleReservar(room),
        disabled: false,
        className:
          'bg-blue-600 text-white hover:bg-blue-700',
      }
    }
    if (myReservations.has(room.id)) {
      return {
        label: 'Quitar Reserva',
        action: () => handleQuitarReserva(room),
        disabled: false,
        className:
          'bg-red-500 text-white hover:bg-red-600',
      }
    }
    return {
      label: 'Ocupado',
      action: () => {},
      disabled: true,
      className:
        'cursor-not-allowed bg-gray-200 text-gray-500',
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="p-6">
      <h2 className="mb-6 text-2xl font-semibold text-gray-900">
        Salas de Estudio
      </h2>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room) => {
          const btn = getButtonConfig(room)
          return (
            <div
              key={room.id}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {room.name}
                </h3>
                <span
                  className={`inline-block h-3 w-3 rounded-full ${
                    room.isAvailable ? 'bg-green-500' : 'bg-gray-400'
                  }`}
                />
              </div>
              <p className="mb-1 text-sm text-gray-600">
                Capacidad: {room.capacity} personas
              </p>
              <p className="mb-4 text-sm text-gray-600">
                Tipo: {room.designation}
              </p>
              <button
                onClick={btn.action}
                disabled={btn.disabled}
                className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition ${btn.className}`}
              >
                {btn.label}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
