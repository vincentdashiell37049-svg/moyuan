import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  {
    path: '/recognize',
    label: '古籍识读',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
        <path d="M3 7V5a2 2 0 0 1 2-2h2" />
        <path d="M17 3h2a2 2 0 0 1 2 2v2" />
        <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
        <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
        <line x1="7" y1="12" x2="17" y2="12" />
      </svg>
    ),
  },
  {
    path: '/library',
    label: '史料库',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        <line x1="9" y1="7" x2="15" y2="7" />
        <line x1="9" y1="11" x2="14" y2="11" />
      </svg>
    ),
  },
  {
    path: '/graph',
    label: '知识图谱',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
        <circle cx="12" cy="5" r="2.5" />
        <circle cx="5" cy="19" r="2.5" />
        <circle cx="19" cy="19" r="2.5" />
        <line x1="12" y1="7.5" x2="5" y2="16.5" />
        <line x1="12" y1="7.5" x2="19" y2="16.5" />
        <line x1="7.5" y1="19" x2="16.5" y2="19" />
      </svg>
    ),
  },
  {
    path: '/diff',
    label: '差异比对',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
        <rect x="3" y="3" width="7" height="18" rx="1" />
        <rect x="14" y="3" width="7" height="18" rx="1" />
        <circle cx="6.5" cy="8" r="1" fill="currentColor" />
        <circle cx="17.5" cy="8" r="1" fill="currentColor" />
        <circle cx="6.5" cy="12" r="1" fill="currentColor" />
        <circle cx="17.5" cy="12" r="1" fill="currentColor" />
        <circle cx="6.5" cy="16" r="1" fill="currentColor" />
        <circle cx="17.5" cy="16" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    path: '/writing',
    label: '写作台',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
        <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        <path d="m15 5 4 4" />
      </svg>
    ),
  },
]

export default function AppLayout() {
  const [collapsed] = useState(false)
  const sidebarWidth = collapsed ? 64 : 240

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* 侧边栏 */}
      <aside
        style={{
          width: `${sidebarWidth}px`,
          minWidth: `${sidebarWidth}px`,
          backgroundColor: 'var(--sidebar-bg)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 100,
          transition: 'width 0.2s ease',
        }}
      >
        {/* Logo 区域 */}
        <div
          style={{
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            padding: collapsed ? '0 16px' : '0 24px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--accent) 0%, #DC2626 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontFamily: '"STKaiti", "KaiTi", "楷体", serif',
              color: '#fff',
              fontSize: '20px',
              fontWeight: 700,
              boxShadow: '0 2px 8px rgba(185, 28, 28, 0.3)',
            }}
          >
            墨
          </div>
          {!collapsed && (
            <span
              style={{
                color: '#fff',
                fontSize: '18px',
                fontWeight: 600,
                marginLeft: '12px',
                letterSpacing: '2px',
                fontFamily: '"STKaiti", "KaiTi", "楷体", serif',
              }}
            >
              墨源
            </span>
          )}
        </div>

        {/* 导航列表 */}
        <nav style={{ flex: 1, paddingTop: '12px', overflowY: 'auto' }}>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                height: '44px',
                padding: collapsed ? '0 20px' : '0 24px',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
                textDecoration: 'none',
                fontSize: '14px',
                position: 'relative',
                backgroundColor: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                transition: 'all 0.15s ease',
                cursor: 'pointer',
              })}
            >
              <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                {item.icon}
              </span>
              {!collapsed && (
                <span style={{ marginLeft: '12px', whiteSpace: 'nowrap' }}>
                  {item.label}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* 底部 */}
        <div
          style={{
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '0 16px' : '0 24px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.3)',
            fontSize: '12px',
          }}
        >
          {!collapsed && 'v1.0.0'}
        </div>
      </aside>

      {/* 主工作区 */}
      <main
        style={{
          flex: 1,
          marginLeft: `${sidebarWidth}px`,
          backgroundColor: 'var(--bg)',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 顶部栏 */}
        <header
          style={{
            height: '64px',
            backgroundColor: '#fff',
            borderBottom: '1px solid var(--rule)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 32px',
            position: 'sticky',
            top: 0,
            zIndex: 50,
          }}
        >
          <span
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--ink)',
              letterSpacing: '1px',
              fontFamily: '"STKaiti", "KaiTi", "楷体", serif',
            }}
          >
            墨源
          </span>
        </header>

        {/* 页面内容 */}
        <div style={{ flex: 1, padding: '24px 32px' }}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}