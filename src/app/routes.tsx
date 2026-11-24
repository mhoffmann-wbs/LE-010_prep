import { lazy } from 'react'
import type { RouteObject } from 'react-router'
import { Layout } from './Layout'

// Every page is code-split, so the shell loads fast and each page loads on first
// use. Keep content imports out of this file and Layout.
const HomePage = lazy(() => import('../pages/HomePage'))
const TerminalPage = lazy(() => import('../pages/TerminalPage'))

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'terminal', element: <TerminalPage /> },
      { path: '*', element: <h1 className="text-2xl font-semibold">Page not found</h1> },
    ],
  },
]
