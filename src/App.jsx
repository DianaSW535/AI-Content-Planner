import { Navigate, Route, Routes } from "react-router-dom";
import {
  AuthPage,
  ContentPlanPage,
  DashboardHome,
  DashboardLayout,
  LandingPage,
  PlanProvider,
  RecommendationsPage,
  SettingsPage,
  SinglePostPage,
  ThemeProvider,
} from "./pages.jsx";

/**
 * V2: объединённый дашборд на /app; /app/analytics редиректит на главный экран.
 * PlanProvider — mock-состояние контент-плана для действий со страницы поста.
 */
export default function App() {
  return (
    <ThemeProvider>
      <PlanProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/app" element={<DashboardLayout />}>
            <Route index element={<DashboardHome />} />
            <Route path="analytics" element={<Navigate to="/app" replace />} />
            <Route path="recommendations" element={<RecommendationsPage />} />
            <Route path="plan" element={<ContentPlanPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="posts/:postId" element={<SinglePostPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PlanProvider>
    </ThemeProvider>
  );
}
