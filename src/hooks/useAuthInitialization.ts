import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { initializeAuth } from '../redux/slices/AuthSlice'

export const useAuthInitialization = () => {
  const dispatch = useDispatch()

  useEffect(() => {
    // Initialize auth state from storage when app starts
    dispatch(initializeAuth() as any)
  }, [dispatch])
}
