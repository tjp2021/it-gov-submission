export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            TTB Label Verification Tool
          </h1>
          <p className="text-gray-600 mt-2">
            AI-powered alcohol beverage label verification
          </p>
        </header>

        <div className="bg-white rounded-lg shadow-md p-6">
          <p className="text-gray-500">
            Upload a label image and enter application data to verify compliance.
          </p>
        </div>
      </div>
    </main>
  );
}
