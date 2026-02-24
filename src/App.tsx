import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import Sidebar from './components/Sidebar'
import DashboardPage from './components/DashboardPage'
import AttendancePage from './components/AttendancePage'
import ManageGuildAttendancePage from './components/ManageGuildAttendancePage'
import RankingsPage from './components/RankingsPage'
import MembersManagePage from './components/MembersManagePage'
import ManageBossTimerPage from './components/ManageBossTimerPage'
import BossNotifierSettingsPage from './components/BossNotifierSettingsPage'
import RelicCalculatorPage from './components/RelicCalculatorPage'
import LoginPage from './components/LoginPage'
import { useFirebaseAuth } from './hooks/useFirebaseAuth'
import { useDailyBossDiscordNotifier } from './hooks/useDailyBossDiscordNotifier'
import { createDefaultAdminUser } from './data/createDefaultAdmin'
import { seedFirestoreDatabase } from './data/seedDatabase'
import './App.css'

const shouldBootstrapDefaultAdmin = import.meta.env.VITE_ENABLE_DEFAULT_ADMIN_BOOTSTRAP === 'true'
const shouldSeedDatabase = import.meta.env.VITE_ENABLE_DB_SEED === 'true'

function App() {
  const { isAdmin, loading: authLoading, logout } = useFirebaseAuth()
  const [activePage, setActivePage] = useState('dashboard')
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('darkMode')
    return savedMode ? JSON.parse(savedMode) : false
  })

  // Determine user type from Firebase auth state (treat not-logged-in as guest view)
  const userType: 'guest' | 'admin' = isAdmin ? 'admin' : 'guest'

  useDailyBossDiscordNotifier({ enabled: isAdmin })

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode))
    if (isDarkMode) {
      document.documentElement.classList.add('dark-mode')
    } else {
      document.documentElement.classList.remove('dark-mode')
    }
  }, [isDarkMode])

  // Initialize Firestore database with sample data if empty
  useEffect(() => {
    if (!authLoading) {
      if (shouldBootstrapDefaultAdmin) {
        createDefaultAdminUser().catch((err) => console.error(err))
      }

      if (shouldSeedDatabase) {
        seedFirestoreDatabase().catch((error) => {
          console.error('Database initialization failed:', error)
        })
      }
    }
  }, [authLoading])

  const handleLogout = async () => {
    try {
      await logout()
      setActivePage('dashboard')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage />
      case 'attendance':
        return <AttendancePage userType={userType!} mode="view" />
      case 'manage-attendance':
        return <ManageGuildAttendancePage userType={userType!} />
      case 'rankings':
        return <RankingsPage />
      case 'manage-members':
        return <MembersManagePage userType={userType!} />
      case 'manage-boss-timer':
        return <ManageBossTimerPage userType={userType!} />
      case 'manage-boss-notifier':
        return <BossNotifierSettingsPage userType={userType!} />
      case 'relic-calculator':
        return <RelicCalculatorPage userType={userType!} />
      case 'boss-timer':
        return <ManageBossTimerPage userType={userType!} />
      default:
        return <DashboardPage />
    }
  }

  const handleOpenLogin = () => setShowLoginModal(true)
  const handleCloseLogin = () => setShowLoginModal(false)

  return (
    <div className="app-container">
      <Sidebar 
        activePage={activePage} 
        onNavigate={setActivePage}
        userType={userType}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        onLogout={handleLogout}
        onRequestSignIn={handleOpenLogin}
      />
      <main className="main-content">
        {renderPage()}
      </main>
      {showLoginModal && (
        <div className="login-overlay" role="dialog" aria-modal="true">
          <button className="login-modal-close" onClick={handleCloseLogin} aria-label="Close">
            <X size={18} strokeWidth={1.8} />
          </button>
          <LoginPage
            onLogin={() => {
              // close modal when login completes
              handleCloseLogin()
            }}
          />
        </div>
      )}
    </div>
  )
}

export default App

