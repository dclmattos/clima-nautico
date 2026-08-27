/* Main App Component - Handles routing (using react-router-dom), query client and other providers */
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PerfilProvider } from '@/contexts/PerfilContext'
import Index from './pages/Index'
import PontoDetalhePage from './pages/PontoDetalhePage'
import JanelasPage from './pages/JanelasPage'
import TravessiaPage from './pages/TravessiaPage'
import ConfigPage from './pages/ConfigPage'
import NotFound from './pages/NotFound'
import Layout from './components/Layout'

const App = () => (
  <BrowserRouter>
    <TooltipProvider>
      <PerfilProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Index />} />
            <Route path="/janelas" element={<JanelasPage />} />
            <Route path="/travessia" element={<TravessiaPage />} />
            <Route path="/config" element={<ConfigPage />} />
            <Route path="/ponto/:slug" element={<PontoDetalhePage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </PerfilProvider>
    </TooltipProvider>
  </BrowserRouter>
)

export default App
