import { useEffect, useRef, useState } from 'react'
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDocs,
  writeBatch,
} from 'firebase/firestore'
import { toast } from 'sonner'
import { db } from '../firebase'
import type { ReservationHistoryEntry } from '../types'
import ConfirmModal from './ConfirmModal'

function getTodayRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start.getTime() + 86_400_000)
  return { start: start.getTime(), end: end.getTime() }
}

function formatSlot(slotStart: number) {
  const hour = new Date(slotStart).getHours()
  const endHour = hour + 1
  return `${hour.toString().padStart(2, '0')}:00 - ${endHour.toString().padStart(2, '0')}:00`
}

interface ActiveRow {
  id: string
  roomId: string
  userId: string
  roomName: string
  userName: string
  slotStart: number
}

type Tab = 'active' | 'history'

export default function AdminDashboard() {
  const [activeRows, setActiveRows] = useState<ActiveRow[]>([])
  const [historyRows, setHistoryRows] = useState<ReservationHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('active')
  const [confirmModal, setConfirmModal] = useState<{
    type: 'check-in' | 'cancel'
    row: ActiveRow
  } | null>(null)

  const roomMapRef = useRef<Map<string, string>>(new Map())
  const userMapRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    const unsubRooms = onSnapshot(collection(db, 'rooms'), (snapshot) => {
      const map = new Map<string, string>()
      snapshot.forEach((d) => map.set(d.id, d.data().name))
      roomMapRef.current = map
    })

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const map = new Map<string, string>()
      snapshot.forEach((d) =>
        map.set(d.id, d.data().displayName || d.id)
      )
      userMapRef.current = map
    })

    const { start, end } = getTodayRange()
    const unsubRes = onSnapshot(
      query(
        collection(db, 'reservations'),
        where('slotStart', '>=', start),
        where('slotStart', '<', end)
      ),
      (snap) => {
        const list: ActiveRow[] = []
        snap.forEach((d) => {
          const data = d.data()
          list.push({
            id: d.id,
            roomId: data.roomId,
            userId: data.userId,
            roomName:
              roomMapRef.current.get(data.roomId) || 'Desconocida',
            userName:
              userMapRef.current.get(data.userId) || data.userId,
            slotStart: data.slotStart,
          })
        })
        setActiveRows(list)
        setLoading(false)
      }
    )

    const unsubHistory = onSnapshot(
      query(
        collection(db, 'reservationHistory'),
        where('slotStart', '>=', start),
        where('slotStart', '<', end)
      ),
      (snap) => {
        const list: ReservationHistoryEntry[] = []
        snap.forEach((d) => {
          const data = d.data()
          list.push({
            id: d.id,
            roomId: data.roomId,
            userId: data.userId,
            slotStart: data.slotStart,
            outcome: data.outcome,
            outcomeAt: data.outcomeAt,
            roomName: data.roomName,
            userName: data.userName,
          })
        })
        list.sort((a, b) => a.slotStart - b.slotStart)
        setHistoryRows(list)
      }
    )

    return () => {
      unsubRooms()
      unsubUsers()
      unsubRes()
      unsubHistory()
    }
  }, [])

  const moveToHistory = async (
    reservationId: string,
    roomId: string,
    userId: string,
    slotStart: number,
    outcome: 'checked-in' | 'cancelled'
  ) => {
    const batch = writeBatch(db)
    const historyRef = doc(collection(db, 'reservationHistory'))
    batch.set(historyRef, {
      roomId,
      userId,
      slotStart,
      outcome,
      outcomeAt: Date.now(),
      roomName: roomMapRef.current.get(roomId) || 'Desconocida',
      userName: userMapRef.current.get(userId) || userId,
    })
    batch.delete(doc(db, 'reservations', reservationId))
    await batch.commit()
  }

  const tick = async () => {
    const now = Date.now()
    const { start, end } = getTodayRange()
    const snapshot = await getDocs(
      query(
        collection(db, 'reservations'),
        where('slotStart', '>=', start),
        where('slotStart', '<', end)
      )
    )
    const batch = writeBatch(db)
    let count = 0
    snapshot.forEach((d) => {
      const data = d.data()
      if (
        data.slotStart + 15 * 60 * 1000 <= now &&
        data.status !== 'checked-in'
      ) {
        const historyRef = doc(collection(db, 'reservationHistory'))
        batch.set(historyRef, {
          roomId: data.roomId,
          userId: data.userId,
          slotStart: data.slotStart,
          outcome: 'no-show',
          outcomeAt: now,
          roomName: roomMapRef.current.get(data.roomId) || 'Desconocida',
          userName: userMapRef.current.get(data.userId) || data.userId,
        })
        batch.delete(d.ref)
        count++
      }
    })
    if (count > 0) {
      await batch.commit()
      toast(`${count} reserva(s) cancelada(s) por inasistencia`)
    } else {
      toast('No se encontraron reservas vencidas')
    }
  }

  useEffect(() => {
    if (!loading) {
      tick()
    }
  }, [loading])

  useEffect(() => {
    const scheduleNext = (): ReturnType<typeof setTimeout> | undefined => {
      const now = new Date()
      const next = new Date(now)
      next.setMinutes(15, 0, 0)
      next.setSeconds(0, 0)
      if (next.getTime() <= now.getTime()) {
        next.setHours(next.getHours() + 1)
      }
      if (
        next.getHours() > 20 ||
        (next.getHours() === 20 && next.getMinutes() > 15)
      ) {
        return
      }

      const delay = next.getTime() - now.getTime()
      return setTimeout(() => {
        tick().then(() => scheduleNext())
      }, delay)
    }

    const timeoutId = scheduleNext()
    return () => clearTimeout(timeoutId)
  }, [])

  const handleConfirmAction = async () => {
    if (!confirmModal) return
    const { type, row } = confirmModal
    setConfirmModal(null)
    try {
      await moveToHistory(row.id, row.roomId, row.userId, row.slotStart, type === 'check-in' ? 'checked-in' : 'cancelled')
      toast.success(type === 'check-in' ? 'Asistencia registrada' : 'Reserva cancelada')
    } catch {
      toast.error('Error al procesar la acción')
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
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-gray-900">
          Panel de Administración
        </h2>
        <button
          onClick={tick}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
        >
          Revisar reservas vencidas
        </button>
      </div>

      <div className="mb-6 flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setTab('active')}
          className={`px-4 py-2 text-sm font-medium transition ${
            tab === 'active'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Reservas activas
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-4 py-2 text-sm font-medium transition ${
            tab === 'history'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Historial
        </button>
      </div>

      {tab === 'active' && (
        <>
          {activeRows.length === 0 ? (
            <p className="text-sm text-gray-500">No hay reservas activas para hoy.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 font-semibold text-gray-700">Sala</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Usuario</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Horario</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 text-gray-900">{row.roomName}</td>
                      <td className="px-4 py-3 text-gray-700">{row.userName}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {formatSlot(row.slotStart)}
                      </td>
                      <td className="flex gap-2 px-4 py-3">
                        <button
                          onClick={() => setConfirmModal({ type: 'check-in', row })}
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition"
                        >
                          Asistió
                        </button>
                        <button
                          onClick={() => setConfirmModal({ type: 'cancel', row })}
                          className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 transition"
                        >
                          Cancelar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'history' && (
        <>
          {historyRows.length === 0 ? (
            <p className="text-sm text-gray-500">No hay reservas finalizadas para hoy.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 font-semibold text-gray-700">Sala</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Usuario</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Horario</th>
                    <th className="px-4 py-3 font-semibold text-gray-700">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-gray-100 bg-gray-50 last:border-0 hover:bg-gray-100"
                    >
                      <td className="px-4 py-3 text-gray-400">{row.roomName}</td>
                      <td className="px-4 py-3 text-gray-400">{row.userName}</td>
                      <td className="px-4 py-3 text-gray-400">
                        {formatSlot(row.slotStart)}
                      </td>
                      <td className="px-4 py-3">
                        {row.outcome === 'checked-in' && (
                          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                            Asistió
                          </span>
                        )}
                        {row.outcome === 'cancelled' && (
                          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                            Cancelado
                          </span>
                        )}
                        {row.outcome === 'no-show' && (
                          <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-500">
                            No-show
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {confirmModal && (
        <ConfirmModal
          message={
            confirmModal.type === 'check-in'
              ? `¿Confirmar asistencia de ${confirmModal.row.userName} para ${formatSlot(confirmModal.row.slotStart)}?`
              : `¿Cancelar reserva de ${confirmModal.row.userName} para ${formatSlot(confirmModal.row.slotStart)}?`
          }
          confirmLabel={confirmModal.type === 'check-in' ? 'Asistió' : 'Cancelar'}
          onConfirm={handleConfirmAction}
          onClose={() => setConfirmModal(null)}
        />
      )}
    </div>
  )
}
