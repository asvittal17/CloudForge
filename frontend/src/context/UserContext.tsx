/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { getMe, clearToken, type Me } from "../services/api"

interface UserContextValue {
  user: Me | null
  isAdmin: boolean
  loading: boolean
  refresh: () => Promise<void>
  signOut: () => void
}

const UserContext = createContext<UserContextValue>({
  user: null,
  isAdmin: false,
  loading: true,
  refresh: async () => {},
  signOut: () => {},
})

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null)
  // Loading only starts true when a token exists (profile load is pending).
  const [loading, setLoading] = useState(() => !!localStorage.getItem("access_token"))

  const refresh = useCallback(async () => {
    try {
      const me = await getMe()
      setUser(me)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Only fetch the profile when a token actually exists.
    if (localStorage.getItem("access_token")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- normal mount-time data fetch; setState fires after await
      refresh()
    }
  }, [refresh])

  const signOut = useCallback(() => {
    clearToken()
    setUser(null)
  }, [])

  return (
    <UserContext.Provider
      value={{
        user,
        isAdmin: user?.role === "admin",
        loading,
        refresh,
        signOut,
      }}
    >
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}
