import { lazy } from 'react'
import type { RouteObject } from 'react-router'
import { Layout } from './Layout'

// Every page is code-split, so the shell loads fast and each page loads on first
// use. Keep content imports out of this file and Layout.
const HomePage = lazy(() => import('../pages/HomePage'))
const LearnPage = lazy(() => import('../pages/LearnPage'))
const PracticePage = lazy(() => import('../pages/PracticePage'))
const QuestionsPage = lazy(() => import('../pages/QuestionsPage'))
const MockExamPage = lazy(() => import('../pages/MockExamPage'))
const TerminalPage = lazy(() => import('../pages/TerminalPage'))
const ExercisesPage = lazy(() => import('../pages/ExercisesPage'))
const ExplorePage = lazy(() => import('../pages/ExplorePage'))
const SimPage = lazy(() => import('../pages/SimPage'))
const DrillsPage = lazy(() => import('../pages/DrillsPage'))
const FlashcardsPage = lazy(() => import('../pages/FlashcardsPage'))
const FlashcardReviewPage = lazy(() => import('../pages/FlashcardReviewPage'))
const FlashcardDeckPage = lazy(() => import('../pages/FlashcardDeckPage'))
const ProgressPage = lazy(() => import('../pages/ProgressPage'))

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'learn', element: <LearnPage /> },
      { path: 'learn/:objectiveId', element: <LearnPage /> },
      { path: 'practice', element: <PracticePage /> },
      { path: 'questions', element: <QuestionsPage /> },
      { path: 'questions/:itemId', element: <QuestionsPage /> },
      { path: 'mock', element: <MockExamPage /> },
      { path: 'terminal', element: <TerminalPage /> },
      { path: 'exercises', element: <ExercisesPage /> },
      { path: 'exercises/:exerciseId', element: <ExercisesPage /> },
      { path: 'explore', element: <ExplorePage /> },
      { path: 'explore/sims', element: <SimPage /> },
      { path: 'explore/sims/:simId', element: <SimPage /> },
      { path: 'explore/drills', element: <DrillsPage /> },
      { path: 'explore/drills/:deckId', element: <DrillsPage /> },
      { path: 'explore/flashcards', element: <FlashcardsPage /> },
      { path: 'explore/flashcards/review', element: <FlashcardReviewPage /> },
      { path: 'explore/flashcards/deck/:deckId', element: <FlashcardDeckPage /> },
      { path: 'progress', element: <ProgressPage /> },
      { path: '*', element: <h1 className="text-2xl font-semibold">Page not found</h1> },
    ],
  },
]
