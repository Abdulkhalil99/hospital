export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 540,
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 16,
          padding: 28,
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.08)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: '#185FA5', marginBottom: 8 }}>
          404
        </div>
        <h1 style={{ fontSize: 28, lineHeight: 1.2, margin: '0 0 10px', color: '#0f172a' }}>
          Page not found
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: '#475569', margin: '0 0 18px' }}>
          The page you requested does not exist or may have been moved.
        </p>
        <a
          href="/en"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px 16px',
            borderRadius: 8,
            background: '#185FA5',
            color: '#fff',
            textDecoration: 'none',
          }}
        >
          Back to home
        </a>
      </div>
    </div>
  );
}
// this page is for those pages that doesn't exist in the system 