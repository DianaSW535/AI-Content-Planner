import { Navigate, Route, Routes, useLocation } from "react-router-dom";
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

function AppDataWrapper({ children }) {
  const { pathname } = useLocation();
  const previewMode = pathname.startsWith("/preview");
  return (
    <AppDataProvider previewMode={previewMode}>{children}</AppDataProvider>
  );
}

/**
 * AppDataProvider — загрузка данных из Supabase (посты, аналитика, план, профиль).
 * Маршруты /preview — режим просмотра без данных и без изменений.
 */
export default function App() {
  return (
    <ThemeProvider>
      <AppDataWrapper>
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
          <Route path="/preview" element={<DashboardLayout />}>
            <Route index element={<DashboardHome />} />
            <Route path="recommendations" element={<RecommendationsPage />} />
            <Route path="plan" element={<ContentPlanPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="posts/:postId" element={<SinglePostPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppDataWrapper>
    </ThemeProvider>
  );
}
