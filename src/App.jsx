import { Navigate, Route, Routes } from "react-router-dom";
import { AppDataProvider } from "./context/AppDataProvider.jsx";
import {
  AuthPage,
  ContentPlanPage,
  DashboardHome,
  DashboardLayout,
  LandingPage,
  RecommendationsPage,
  SettingsPage,
  SinglePostPage,
  ThemeProvider,
} from "./pages.jsx";

/**
 * AppDataProvider — загрузка данных из Supabase (посты, аналитика, план, профиль).
 */
export default function App() {
  return (
    <ThemeProvider>
      <AppDataProvider>
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
      </AppDataProvider>
    </ThemeProvider>
  );
}
