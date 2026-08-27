import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Home, CalendarRange, Navigation, Settings } from 'lucide-react'

export default function Layout() {
  const location = useLocation()

  const navItems = [
    {
      to: '/',
      label: 'Início',
      icon: Home,
      exact: true,
    },
    {
      to: '/janelas',
      label: 'Janelas',
      icon: CalendarRange,
      exact: false,
    },
    {
      to: '/travessia',
      label: 'Travessia',
      icon: Navigation,
      exact: false,
    },
    {
      to: '/config',
      label: 'Configurações',
      icon: Settings,
      exact: false,
    },
  ]

  const isActive = (itemTo: string, exact: boolean) => {
    if (exact) {
      return location.pathname === itemTo
    }
    return location.pathname.startsWith(itemTo)
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0e14] text-zinc-100">
      {/* Conteúdo Principal */}
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>

      {/* Barra de Navegação Inferior Fixa (Mobile e Desktop) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0d1218]/95 backdrop-blur-md border-t border-zinc-800/80 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
        <div className="max-w-lg mx-auto px-4 py-2 flex items-center justify-around">
          {navItems.map((item) => {
            const active = isActive(item.to, item.exact)
            const Icon = item.icon

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-all ${
                  active ? 'text-cyan-400 font-bold scale-105' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div
                  className={`p-1 rounded-md transition-colors ${
                    active
                      ? 'bg-cyan-950/80 border border-cyan-700/60 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                      : ''
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] tracking-tight">{item.label}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
