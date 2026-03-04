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
import './App.css'

function App() {
  const { isAdmin, logout } = useFirebaseAuth()
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

