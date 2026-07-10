export interface Room {
  id: string
  name: string
  capacity: number
  designation: 'Grupal' | 'Individual'
  isAvailable: boolean
}

export interface Reservation {
  id: string
  roomId: string
  userId: string
  slotStart: number
  status?: 'checked-in'
}

export interface ReservationHistoryEntry {
  id: string
  roomId: string
  userId: string
  slotStart: number
  outcome: 'checked-in' | 'cancelled' | 'no-show'
  outcomeAt: number
  roomName: string
  userName: string
}

export interface AppUser {
  uid: string
  email: string
  displayName: string
  role: 'student'
}
