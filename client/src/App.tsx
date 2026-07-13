import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import RecognizePage from './pages/RecognizePage'
import LibraryPage from './pages/LibraryPage'
import GraphPage from './pages/GraphPage'
import DiffPage from './pages/DiffPage'
import WritingPage from './pages/WritingPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/recognize" replace />} />
        <Route path="recognize" element={<RecognizePage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="graph" element={<GraphPage />} />
        <Route path="diff" element={<DiffPage />} />
        <Route path="writing/:id?" element={<WritingPage />} />
      </Route>
    </Routes>
  )
}

export default App