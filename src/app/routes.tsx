import { lazy } from 'react'
import type { RouteObject } from 'react-router'
import { Layout } from './Layout'

// Every page is code-split, so the shell loads fast and each page loads on first
// use. Keep content imports out of this file and Layout.
const HomePage = lazy(() => import('../pages/HomePage'))
const PracticePage = lazy(() => import('../pages/PracticePage'))
const QuestionsPage = lazy(() => import('../pages/QuestionsPage'))
const MockExamPage = lazy(() => import('../pages/MockExamPage'))
const TerminalPage = lazy(() => import('../pages/TerminalPage'))
const ProgressPage = lazy(() => import('../pages/ProgressPage'))

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'practice', element: <PracticePage /> },
      { path: 'questions', element: <QuestionsPage /> },
      { path: 'questions/:itemId', element: <QuestionsPage /> },
      { path: 'mock', element: <MockExamPage /> },
      { path: 'terminal', element: <TerminalPage /> },
      { path: 'progress', element: <ProgressPage /> },
      { path: '*', element: <h1 className="text-2xl font-semibold">Page not found</h1> },
    ],
  },
]
