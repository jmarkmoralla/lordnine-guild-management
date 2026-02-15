import AttendancePage from './AttendancePage';

interface ManageGuildAttendancePageProps {
  userType: 'guest' | 'admin';
}

const ManageGuildAttendancePage: React.FC<ManageGuildAttendancePageProps> = ({ userType }) => {
  if (userType !== 'admin') {
    return (
      <div className="page-container">
        <div className="page-header">
          <h2>Manage Attendance</h2>
          <p className="page-subtitle">Admin access only</p>
        </div>
        <div className="error-state">
          <p>You do not have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return <AttendancePage userType={userType} mode="manage" />;
};

export default ManageGuildAttendancePage;
