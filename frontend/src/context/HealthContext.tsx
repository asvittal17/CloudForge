/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { getHealth, type HealthSnapshot } from "../services/api"

/**
 * Shared application-health state.
 *
 * Driven exclusively by real /health responses (database + Ollama
 * connectivity). "unknown" means the check has not run or failed — never
 * shown to the user as "healthy".
 */

export type HealthState =
  | { status: "unknown"; snapshot: null; error: string | null }
  | { status: "ok"; snapshot: HealthSnapshot; error: null }
  | { status: "unreachable"; snapshot: null; error: string }

interface HealthContextValue {
  state: HealthState
  refresh: () => Promise<void>
}

const HealthContext = createContext<HealthContextValue>({
  state: { status: "unknown", snapshot: null, error: null },
  refresh: async () => {},
})

const POLL_INTERVAL_MS = 30_000

export function HealthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<HealthState>({
    status: "unknown",
    snapshot: null,
    error: null,
  })
  const requestSeq = useRef(0)

  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current
    try {
      const snapshot = await getHealth()
      if (seq === requestSeq.current) {
        setState({ status: "ok", snapshot, error: null })
      }
    } catch (error) {
      if (seq === requestSeq.current) {
        setState({
          status: "unreachable",
          snapshot: null,
          error:
            error instanceof Error
              ? error.message
              : "Health check failed",
        })
      }
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- normal mount-time data fetch; setState fires after await
    refresh()
    const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refresh])

  return (
    <HealthContext.Provider value={{ state, refresh }}>
      {children}
    </HealthContext.Provider>
  )
}

export function useHealth() {
  return useContext(HealthContext)
}
