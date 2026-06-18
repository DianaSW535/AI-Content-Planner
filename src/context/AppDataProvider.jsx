import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../supabaseClient.js";
import {
  buildContentIdeas,
  buildContentMix,
  buildOverviewCards,
  buildPostDetail,
  buildPostingTimeTips,
  buildReachSeries,
  buildSuggestedHashtags,
  formatLabel,
  mapPlanItemToSlot,
  mapPostRow,
  mapRecommendationRow,
  scheduledDateForDrop,
  scheduledDateFromMonthWeek,
  scheduledDateFromWeekday,
  toLocalDateString,
} from "../api/mappers.js";
import {
  ACCESS_DENIED_MESSAGE,
  formatUserError,
  trimText,
  validatePlanFormat,
  validatePlanItemInsert,
  validatePlanSchedule,
  validatePlanTitle,
} from "../lib/validation.js";

function throwDbError(err) {
  if (err) throw new Error(formatUserError(err));
}

/* ---------- Общий контекст данных приложения + контент-план ---------- */

const AppDataContext = createContext(null);

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData: оберните приложение в AppDataProvider");
  return ctx;
}

/** Алиас для страницы контент-плана и действий с постами. */
export function usePlan() {
  const ctx = useAppData();
  return {
    slots: ctx.slots,
    planLoading: ctx.planLoading,
    planError: ctx.planError,
    duplicateIdeaToPlan: ctx.duplicateIdeaToPlan,
    generateFollowUp: ctx.generateFollowUp,
    followUpsByPost: ctx.followUpsByPost,
    addManualSlot: ctx.addManualSlot,
    copySlotToCell: ctx.copySlotToCell,
    updatePlanItem: ctx.updatePlanItem,
    deletePlanItem: ctx.deletePlanItem,
    refreshPlan: ctx.refreshPlan,
  };
}

export function AppDataProvider({ children, previewMode = false }) {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [profile, setProfile] = useState(null);
  const [socialAccounts, setSocialAccounts] = useState([]);
  const [posts, setPosts] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [analyticsRows, setAnalyticsRows] = useState([]);

  const [planId, setPlanId] = useState(null);
  const [slots, setSlots] = useState([]);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState(null);
  const [followUpsByPost, setFollowUpsByPost] = useState({});

  const userId = session?.user?.id;

  const getActiveUserId = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const id = data.session?.user?.id;
    if (id && data.session !== session) {
      setSession(data.session);
    }
    return id ?? null;
  }, [session]);

  const loadPlan = useCallback(async (uid) => {
    setPlanLoading(true);
    setPlanError(null);
    try {
      let { data: plans, error: planErr } = await supabase
        .from("content_plans")
        .select("*")
        .eq("user_id", uid)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1);

      if (planErr) throw planErr;

      let plan = plans?.[0];
      if (!plan) {
        const { data: created, error: createErr } = await supabase
          .from("content_plans")
          .insert({
            user_id: uid,
            title: "Контент-план",
            horizon: "week",
            start_date: toLocalDateString(new Date()),
          })
          .select()
          .single();
        if (createErr) throw createErr;
        plan = created;
      }

      setPlanId(plan.id);

      const { data: items, error: itemsErr } = await supabase
        .from("content_plan_items")
        .select("*, posts(thumbnail_url, format, tags)")
        .eq("content_plan_id", plan.id)
        .order("scheduled_date", { ascending: true });

      if (itemsErr) throw itemsErr;

      const mapped = (items || []).map((item) => {
        const linked = item.posts;
        const formatKey = item.format || linked?.format || "";
        return mapPlanItemToSlot({
          ...item,
          format: formatKey,
          thumbnail: linked?.thumbnail_url || "",
          tags: linked?.tags || "",
        });
      });
      setSlots(mapped);
      return plan.id;
    } catch (e) {
      setPlanError(
        formatUserError(e, "Ошибка загрузки данных. Попробуйте позже.")
      );
      setSlots([]);
      setPlanId(null);
      return null;
    } finally {
      setPlanLoading(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    if (previewMode) {
      setProfile(null);
      setPosts([]);
      setRecommendations([]);
      setAnalyticsRows([]);
      setSlots([]);
      setPlanId(null);
      setLoading(false);
      setError(null);
      return;
    }

    if (!userId) {
      setProfile(null);
      setPosts([]);
      setRecommendations([]);
      setAnalyticsRows([]);
      setSlots([]);
      setPlanId(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [
        profileRes,
        socialRes,
        postsRes,
        recsRes,
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("social_accounts").select("*").eq("user_id", userId),
        supabase
          .from("posts")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("ai_recommendations")
          .select("*")
          .eq("user_id", userId)
          .eq("is_dismissed", false)
          .order("created_at", { ascending: false }),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (socialRes.error) throw socialRes.error;
      if (postsRes.error) throw postsRes.error;
      if (recsRes.error) throw recsRes.error;

      const postRows = postsRes.data || [];
      const postIds = postRows.map((p) => p.id);

      let analytics = [];
      if (postIds.length) {
        const { data: aData, error: aErr } = await supabase
          .from("post_analytics")
          .select("*")
          .in("post_id", postIds)
          .order("snapshot_date", { ascending: false });
        if (aErr) throw aErr;
        analytics = aData || [];
      }

      const latestByPost = new Map();
      for (const row of analytics) {
        if (!latestByPost.has(row.post_id)) {
          latestByPost.set(row.post_id, row);
        }
      }

      const uiPosts = postRows.map((p) =>
        mapPostRow(p, latestByPost.get(p.id))
      );

      setProfile(profileRes.data);
      setSocialAccounts(socialRes.data || []);
      setPosts(uiPosts);
      setRecommendations((recsRes.data || []).map(mapRecommendationRow));
      setAnalyticsRows(analytics);

      await loadPlan(userId);
    } catch (e) {
      setError(formatUserError(e, "Ошибка загрузки данных. Попробуйте позже."));
    } finally {
      setLoading(false);
    }
  }, [previewMode, userId, loadPlan]);

  useEffect(() => {
    if (previewMode) {
      setSession(null);
      setAuthReady(true);
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthReady(true);
    });

    return () => subscription.unsubscribe();
  }, [previewMode]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const refresh = useCallback(() => loadAll(), [loadAll]);
  const refreshPlan = useCallback(() => {
    if (previewMode) return Promise.resolve();
    if (userId) return loadPlan(userId);
    return Promise.resolve();
  }, [previewMode, userId, loadPlan]);

  const signIn = useCallback(async (email, password) => {
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (err) throw new Error(formatUserError(err));
    if (data.session) setSession(data.session);
    return data.session;
  }, []);

  const signUp = useCallback(async (email, password, displayName) => {
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    });
    if (err) throw new Error(formatUserError(err));
    if (data.session) setSession(data.session);
    return data.session;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const userProfile = useMemo(
    () =>
      previewMode
        ? {
            name: "Гость",
            handle: "@preview",
            avatar:
              "https://api.dicebear.com/7.x/avataaars/svg?seed=preview",
            plan: "Просмотр",
          }
        : {
            name:
              profile?.display_name ||
              session?.user?.email?.split("@")[0] ||
              "Пользователь",
            handle: profile?.handle || "@user",
            avatar:
              profile?.avatar_url ||
              `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId || "guest"}`,
            plan: profile?.plan_tier === "pro" ? "Pro" : "Free",
          },
    [previewMode, profile, session, userId]
  );

  const reachSeries = useMemo(
    () => buildReachSeries(analyticsRows),
    [analyticsRows]
  );
  const contentMix = useMemo(() => buildContentMix(posts), [posts]);
  const overviewCards = useMemo(
    () => buildOverviewCards(posts, analyticsRows),
    [posts, analyticsRows]
  );
  const postingTimeTips = useMemo(
    () => buildPostingTimeTips(recommendations),
    [recommendations]
  );
  const contentIdeas = useMemo(
    () => buildContentIdeas(recommendations, posts),
    [recommendations, posts]
  );
  const suggestedHashtags = useMemo(
    () => buildSuggestedHashtags(posts),
    [posts]
  );

  const getPostDetail = useCallback(
    (postId) => {
      const post = posts.find((p) => p.id === postId);
      if (!post) return null;
      return buildPostDetail(post, recommendations);
    },
    [posts, recommendations]
  );

  const duplicateIdeaToPlan = useCallback(
    async (item) => {
      if (previewMode) {
        throw new Error("Войдите, чтобы добавлять записи в план");
      }
      const uid = await getActiveUserId();
      let activePlanId = planId;
      if (!activePlanId) {
        if (!uid) throw new Error("Войдите в аккаунт, чтобы сохранять план");
        activePlanId = await loadPlan(uid);
      }
      if (!activePlanId) throw new Error("Контент-план не загружен");

      const rawTitle = item.title?.startsWith("Идея:")
        ? item.title
        : `Идея: ${item.title ?? ""}`;
      const formatDb = posts.find((p) => p.id === item.id)?.format || "post";
      const horizon = "week";
      const day = "Сб";
      const scheduled_date = scheduledDateFromWeekday(day);

      const validationErr = validatePlanItemInsert({
        title: rawTitle,
        format: formatDb,
        horizon,
        day,
        week: 1,
        scheduled_date,
      });
      if (validationErr) throw new Error(validationErr);

      const trimmedTitle = trimText(rawTitle);

      const { error: err } = await supabase.from("content_plan_items").insert({
        content_plan_id: activePlanId,
        title: trimmedTitle,
        description: item.detail || item.description || "",
        content: item.detail || item.content || item.title || "",
        scheduled_date,
        status: "idea",
        format: formatDb,
        post_id:
          item.source_post_id ??
          (posts.some((p) => p.id === item.id) ? item.id : null),
      });
      throwDbError(err);
      if (item.id && recommendations.some((r) => r.id === item.id)) {
        const { error: recErr } = await supabase
          .from("ai_recommendations")
          .update({ is_added_to_plan: true })
          .eq("id", item.id);
        throwDbError(recErr);
      }
      await loadPlan(uid);
      await loadAll();
    },
    [previewMode, planId, getActiveUserId, loadPlan, loadAll, recommendations, posts]
  );

  const generateFollowUp = useCallback(
    (post) => {
      if (previewMode) return;
      const line = `Часть 2: «${post.title}» — ответы на топ-комментарии + опрос`;
      setFollowUpsByPost((prev) => ({
        ...prev,
        [post.id]: [...(prev[post.id] || []), line],
      }));
    },
    [previewMode]
  );

  const addManualSlot = useCallback(
    async ({ title, description, day, week, horizon = "week", format = "post" }) => {
      if (previewMode) {
        throw new Error("Войдите, чтобы добавлять записи в план");
      }
      const titleErr = validatePlanTitle(title);
      if (titleErr) throw new Error(titleErr);
      const formatErr = validatePlanFormat(format);
      if (formatErr) throw new Error(formatErr);
      const scheduleErr = validatePlanSchedule({ horizon, day, week });
      if (scheduleErr) throw new Error(scheduleErr);

      const uid = await getActiveUserId();
      let activePlanId = planId;
      if (!activePlanId) {
        if (!uid) throw new Error("Войдите в аккаунт, чтобы сохранять план");
        activePlanId = await loadPlan(uid);
      }
      if (!activePlanId) throw new Error("Контент-план не загружен");

      const scheduled_date =
        horizon === "week"
          ? scheduledDateFromWeekday(day)
          : scheduledDateFromMonthWeek(week, day);

      const validationErr = validatePlanItemInsert({
        title,
        format,
        horizon,
        day,
        week,
        scheduled_date,
      });
      if (validationErr) throw new Error(validationErr);

      const trimmedTitle = trimText(title);
      const trimmedDescription = trimText(description);

      const tempId = `temp-${Date.now()}`;
      const optimistic = mapPlanItemToSlot({
        id: tempId,
        title: trimmedTitle,
        description: trimmedDescription,
        content: trimmedDescription || "Текст поста будет добавлен позже.",
        scheduled_date,
        status: "draft",
        format,
      });
      setSlots((prev) => [...prev, optimistic]);

      try {
        const { error: err } = await supabase.from("content_plan_items").insert({
          content_plan_id: activePlanId,
          title: trimmedTitle,
          description: trimmedDescription,
          content: trimmedDescription || "Текст поста будет добавлен позже.",
          scheduled_date,
          status: "draft",
          format,
        });
        throwDbError(err);
        await loadPlan(uid);
      } catch (e) {
        setSlots((prev) => prev.filter((s) => s.id !== tempId));
        throw new Error(formatUserError(e));
      }
    },
    [previewMode, planId, getActiveUserId, loadPlan]
  );

  const copySlotToCell = useCallback(
    async ({ sourceId, day, week, horizon = "week" }) => {
      if (previewMode) return;
      const uid = await getActiveUserId();
      let activePlanId = planId;
      if (!activePlanId) {
        if (!uid) throw new Error("Войдите в аккаунт, чтобы сохранять план");
        activePlanId = await loadPlan(uid);
      }
      if (!activePlanId) throw new Error("Контент-план не загружен");

      const src = slots.find((s) => s.id === sourceId);
      if (!src) throw new Error(ACCESS_DENIED_MESSAGE);

      const titleBase = String(src.title).replace(/\s+\(копия\)$/, "").trim();
      const title = `${titleBase} (копия)`;
      const format = src.formatKey || "post";
      const scheduled_date = scheduledDateForDrop({ day, week, horizon });

      const validationErr = validatePlanItemInsert({
        title,
        format,
        horizon,
        day,
        week,
        scheduled_date,
      });
      if (validationErr) throw new Error(validationErr);

      const trimmedTitle = trimText(title);

      const { error: err } = await supabase.from("content_plan_items").insert({
        content_plan_id: activePlanId,
        title: trimmedTitle,
        description: src.description,
        content: src.content,
        scheduled_date,
        status: src.status,
        format,
        source_item_id: sourceId,
        post_id: src.post_id || null,
      });
      throwDbError(err);
      await loadPlan(uid);
    },
    [previewMode, planId, slots, getActiveUserId, loadPlan]
  );

  const updatePlanItem = useCallback(
    async (id, { title, format, description }) => {
      if (previewMode) {
        throw new Error("Войдите, чтобы редактировать записи");
      }
      if (!slots.some((s) => s.id === id)) {
        throw new Error(ACCESS_DENIED_MESSAGE);
      }
      const titleErr = validatePlanTitle(title);
      if (titleErr) throw new Error(titleErr);
      if (format !== undefined) {
        const formatErr = validatePlanFormat(format);
        if (formatErr) throw new Error(formatErr);
      }

      const trimmedTitle = trimText(title);

      const prev = slots;
      setSlots((current) =>
        current.map((s) => {
          if (s.id !== id) return s;
          const nextDescription =
            description !== undefined ? description.trim() : s.description;
          return {
            ...s,
            title: trimmedTitle,
            formatKey: format ?? s.formatKey,
            format: format ? formatLabel(format) : s.format,
            description: nextDescription,
            content: nextDescription || s.content,
          };
        })
      );

      try {
        const payload = { title: trimmedTitle };
        if (format) payload.format = format;
        if (description !== undefined) {
          const trimmedDescription = trimText(description);
          payload.description = trimmedDescription;
          payload.content = trimmedDescription || "Текст поста будет добавлен позже.";
        }
        const { error: err } = await supabase
          .from("content_plan_items")
          .update(payload)
          .eq("id", id);
        throwDbError(err);
      } catch (e) {
        setSlots(prev);
        throw new Error(formatUserError(e));
      }
    },
    [previewMode, slots]
  );

  const deletePlanItem = useCallback(async (id) => {
    if (previewMode) {
      throw new Error("Войдите, чтобы удалять записи");
    }
    if (!slots.some((s) => s.id === id)) {
      throw new Error(ACCESS_DENIED_MESSAGE);
    }
    const prev = slots;
    setSlots((current) => current.filter((s) => s.id !== id));

    try {
      const { error: err } = await supabase
        .from("content_plan_items")
        .delete()
        .eq("id", id);
      throwDbError(err);
    } catch (e) {
      setSlots(prev);
      throw new Error(formatUserError(e));
    }
  }, [previewMode, slots]);

  const value = useMemo(
    () => ({
      previewMode,
      session,
      authReady,
      loading,
      error,
      refresh,
      signIn,
      signUp,
      signOut,
      profile,
      userProfile,
      socialAccounts,
      posts,
      recommendations,
      reachSeries,
      contentMix,
      overviewCards,
      postingTimeTips,
      contentIdeas,
      suggestedHashtags,
      getPostDetail,
      slots,
      planLoading,
      planError,
      duplicateIdeaToPlan,
      generateFollowUp,
      followUpsByPost,
      addManualSlot,
      copySlotToCell,
      updatePlanItem,
      deletePlanItem,
      refreshPlan,
    }),
    [
      previewMode,
      session,
      authReady,
      loading,
      error,
      refresh,
      signIn,
      signUp,
      signOut,
      profile,
      userProfile,
      socialAccounts,
      posts,
      recommendations,
      reachSeries,
      contentMix,
      overviewCards,
      postingTimeTips,
      contentIdeas,
      suggestedHashtags,
      getPostDetail,
      slots,
      planLoading,
      planError,
      duplicateIdeaToPlan,
      generateFollowUp,
      followUpsByPost,
      addManualSlot,
      copySlotToCell,
      updatePlanItem,
      deletePlanItem,
      refreshPlan,
    ]
  );

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}
