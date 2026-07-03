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
  timestamp: number
}

export interface AppUser {
  uid: string
  email: string
  displayName: string
  role: 'student'
}
