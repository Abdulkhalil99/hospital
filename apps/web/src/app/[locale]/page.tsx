export default function LocalePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Medicore Hospital Management System
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Patients</h2>
            <p className="text-gray-600">Manage patient records and information</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Appointments</h2>
            <p className="text-gray-600">Schedule and manage appointments</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Dashboard</h2>
            <p className="text-gray-600">View system overview and analytics</p>
          </div>
        </div>
      </div>
    </div>
  );
}