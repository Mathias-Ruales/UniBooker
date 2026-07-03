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

function getTodayRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start.getTime() + 86_400_000)
  return { start: start.getTime(), end: end.getTime() }
}

function generateSlots() {
  const now = new Date()
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime()
  const slots: { start: number; label: string }[] = []
  for (let hour = 7; hour <= 20; hour++) {
    const start = startOfDay + hour * 3_600_000
    const endLabel = `${(hour + 1).toString().padStart(2, '0')}:00`
    slots.push({
      start,
      label: `${hour.toString().padStart(2, '0')}:00 - ${endLabel}`,
    })
  }
  return slots
}

function formatSlot(slotStart: number) {
  const hour = new Date(slotStart).getHours()
  const endHour = hour + 1
  return `${hour.toString().padStart(2, '0')}:00 - ${endHour.toString().padStart(2, '0')}:00`
}

interface BookingModalProps {
  room: Room
  userId: string
  onClose: () => void
}

export default function BookingModal({
  room,
  userId,
  onClose,
}: BookingModalProps) {
  const [bookedSlots, setBookedSlots] = useState<Set<number>>(new Set())
  const [myRoomReservations, setMyRoomReservations] = useState<
    { id: string; slotStart: number }[]
  >([])
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const slots = generateSlots()

  useEffect(() => {
    const { start, end } = getTodayRange()
    const reservationsRef = collection(db, 'reservations')
    const q = query(
      reservationsRef,
      where('roomId', '==', room.id),
      where('slotStart', '>=', start),
      where('slotStart', '<', end)
    )

    const unsub = onSnapshot(q, (snapshot) => {
      const taken = new Set<number>()
      const mine: { id: string; slotStart: number }[] = []
      snapshot.forEach((d) => {
        const data = d.data()
        taken.add(data.slotStart)
        if (data.userId === userId) {
          mine.push({ id: d.id, slotStart: data.slotStart })
        }
      })
      setBookedSlots(taken)
      setMyRoomReservations(mine)
    })

    return () => unsub()
  }, [room.id, userId])

  const handleConfirm = async () => {
    if (selectedSlot === null) return
    setError(null)
    setConfirming(true)

    try {
      const { start, end } = getTodayRange()
      const q = query(
        collection(db, 'reservations'),
        where('userId', '==', userId),
        where('slotStart', '>=', start),
        where('slotStart', '<', end)
      )
      const snapshot = await getDocs(q)
      if (snapshot.size >= 2) {
        setError('Límite de 2 reservas diarias alcanzado')
        setConfirming(false)
        return
      }

      const batch = writeBatch(db)

      const reservationRef = doc(collection(db, 'reservations'))
      batch.set(reservationRef, {
        roomId: room.id,
        userId,
        slotStart: selectedSlot,
      })

      await batch.commit()
      onClose()
    } catch {
      setError('Error al crear la reserva')
      setConfirming(false)
    }
  }

  const handleCancelSlot = async (reservationId: string) => {
    setError(null)
    try {
      const batch = writeBatch(db)
      batch.delete(doc(db, 'reservations', reservationId))
      await batch.commit()
    } catch {
      setError('Error al cancelar la reserva')
    }
  }

  const getSlotClass = (slotStart: number) => {
    const isBooked = bookedSlots.has(slotStart)
    const isSelected = selectedSlot === slotStart

    if (isBooked) {
      return 'bg-gray-300 text-gray-500 cursor-not-allowed'
    }
    if (isSelected) {
      return 'bg-yellow-400 text-yellow-900 ring-2 ring-yellow-600'
    }
    return 'bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900">
            {room.name}
          </h3>
          <span className="text-sm text-gray-500">
            {room.designation} &middot; {room.capacity} pers.
          </span>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {myRoomReservations.length > 0 && (
          <div className="mb-6">
            <p className="mb-2 text-sm font-medium text-gray-700">
              Tus reservas en esta sala:
            </p>
            <div className="space-y-2">
              {myRoomReservations.map((res) => (
                <div
                  key={res.id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2"
                >
                  <span className="text-sm text-gray-700">
                    {formatSlot(res.slotStart)}
                  </span>
                  <button
                    onClick={() => handleCancelSlot(res.id)}
                    className="text-sm font-medium text-red-600 hover:text-red-800 transition"
                  >
                    Cancelar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="mb-4 text-sm font-medium text-gray-700">
          Selecciona un horario:
        </p>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {slots.map((slot) => (
            <button
              key={slot.start}
              onClick={() => {
                if (!bookedSlots.has(slot.start)) {
                  setSelectedSlot(slot.start)
                }
              }}
              disabled={bookedSlots.has(slot.start)}
              className={`rounded-lg px-3 py-2 text-center text-sm font-medium transition ${getSlotClass(slot.start)}`}
            >
              {slot.label}
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedSlot === null || confirming}
            className={`rounded-lg px-5 py-2 text-sm font-medium text-white transition ${
              selectedSlot !== null && !confirming
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'cursor-not-allowed bg-blue-300'
            }`}
          >
            {confirming ? 'Reservando...' : 'Confirmar Reserva'}
          </button>
        </div>
      </div>
    </div>
  )
}
