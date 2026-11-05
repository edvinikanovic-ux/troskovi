import { onAuthStateChanged, type User } from 'firebase/auth'
import { useEffect, useState } from 'react'
import { firebaseAuth } from './data/firebase'

// undefined = still checking, null = signed out
export function useAuthUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  useEffect(() => onAuthStateChanged(firebaseAuth(), setUser), [])
  return user
}
