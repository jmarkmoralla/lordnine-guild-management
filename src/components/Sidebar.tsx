import {
  CalendarDays,
  Bell,
  Calculator,
  Clock,
  Crown,
  LayoutDashboard,
  LogIn,
  LogOut,
  Moon,
  Sun,
  Trophy,
  User,
  Users,
} from 'lucide-react';
import '../styles/Sidebar.css';

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
  userType: 'guest' | 'admin';
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onLogout: () => void;
  onRequestSignIn?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate, userType, isDarkMode, onToggleDarkMode, onLogout, onRequestSignIn }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} strokeWidth={1.75} /> },
    { id: 'attendance', label: 'Attendance', icon: <CalendarDays size={18} strokeWidth={1.75} /> },
    { id: 'rankings', label: 'Rankings', icon: <Trophy size={18} strokeWidth={1.75} /> },
  ];

  const managementMenuItems = userType === 'admin'
    ? [
        { id: 'manage-boss-timer', label: 'Manage Boss Timer', icon: <Clock size={18} strokeWidth={1.75} /> },
        { id: 'manage-attendance', label: 'Manage Attendance', icon: <CalendarDays size={18} strokeWidth={1.75} /> },
        { id: 'manage-members', label: 'Manage Members', icon: <Users size={18} strokeWidth={1.75} /> },
      ]
    : [];

  const toolsMenuItems = [
    { id: 'relic-calculator', label: 'Relic Calculator', icon: <Calculator size={18} strokeWidth={1.75} /> },
    ...(userType === 'admin'
      ? [{ id: 'manage-boss-notifier', label: 'Field Boss Notifier', icon: <Bell size={18} strokeWidth={1.75} /> }]
      : []),
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="guild-header">
          <div className="guild-logo" title="Guild Logo - Admin can update">
            <img src="/assets/images/lordnine_logo.png" alt="Lordnine Logo" className="guild-logo-image" />
          </div>
          <div className="guild-info-section">
            <h1 className="guild-name">Secreta</h1>
            <p className="guild-subtitle">Guild Management</p>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <ul className="nav-menu">
          <li className="nav-section">Navigation</li>
          {menuItems.map((item) => (
            <li key={item.id} className="nav-item">
              <button
                className={`nav-link ${activePage === item.id ? 'active' : ''}`}
                onClick={() => onNavigate(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </button>
            </li>
          ))}
          {managementMenuItems.length > 0 && (
            <>
              <li className="nav-section">Management</li>
              {managementMenuItems.map((item) => (
                <li key={item.id} className="nav-item">
                  <button
                    className={`nav-link ${activePage === item.id ? 'active' : ''}`}
                    onClick={() => onNavigate(item.id)}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                  </button>
                </li>
              ))}
            </>
          )}
          {toolsMenuItems.length > 0 && (
            <>
              <li className="nav-section">Tools</li>
              {toolsMenuItems.map((item) => (
                <li key={item.id} className="nav-item">
                  <button
                    className={`nav-link ${activePage === item.id ? 'active' : ''}`}
                    onClick={() => onNavigate(item.id)}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                  </button>
                </li>
              ))}
            </>
          )}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div className="footer-controls">
          <div className="user-badge-small">
            <span className="user-icon" aria-hidden="true">
              {userType === 'admin' ? <Crown size={14} strokeWidth={1.8} /> : <User size={14} strokeWidth={1.8} />}
            </span>
            <span className="user-text">{userType === 'admin' ? 'Admin' : 'Guest'}</span>
          </div>
          
          <button
            className="control-btn theme-btn"
            onClick={onToggleDarkMode}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
          </button>
          
          {userType === 'admin' ? (
            <button
              className="control-btn logout-btn-sidebar"
              onClick={onLogout}
              title="Logout"
            >
              <LogOut size={16} strokeWidth={1.8} />
            </button>
          ) : (
            <button
              className="control-btn signin-btn-sidebar"
              onClick={() => onRequestSignIn && onRequestSignIn()}
              title="Sign In as Admin"
            >
              <LogIn size={16} strokeWidth={1.8} />
            </button>
          )}
        </div>
        <div className="sidebar-copyright" aria-label="Copyright footer">
          © 2026 メKraaam. All rights reserved.
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
