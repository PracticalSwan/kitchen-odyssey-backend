// Next.js root page component - displays API information
export default function ApiRoot() {
  return (
    <div>
      <h1>Kitchen Odyssey API</h1>
      <p>
        This is an API-only backend. Use <code>/api/v1/health</code> to check
        status.
      </p>
    </div>
  );
}
