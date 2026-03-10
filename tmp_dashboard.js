import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/pages/Dashboard.tsx");import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=eb0b1326"; const Fragment = __vite__cjsImport0_react_jsxDevRuntime["Fragment"]; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
import * as RefreshRuntime from "/@react-refresh";
const inWebWorker = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
let prevRefreshReg;
let prevRefreshSig;
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "@vitejs/plugin-react can't detect preamble. Something is wrong."
    );
  }
  prevRefreshReg = window.$RefreshReg$;
  prevRefreshSig = window.$RefreshSig$;
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
var _s = $RefreshSig$();
import __vite__cjsImport3_react from "/node_modules/.vite/deps/react.js?v=eb0b1326"; const useEffect = __vite__cjsImport3_react["useEffect"]; const useMemo = __vite__cjsImport3_react["useMemo"]; const useState = __vite__cjsImport3_react["useState"]; const useRef = __vite__cjsImport3_react["useRef"];
import { format } from "/node_modules/.vite/deps/date-fns.js?v=eb0b1326";
import PageHeader from "/src/components/PageHeader.tsx";
import Card from "/src/components/Card.tsx";
import MonthSelector from "/src/components/MonthSelector.tsx";
import { PAGE_HEADERS } from "/src/constants/pages.ts";
import { useExpenses } from "/src/hooks/useExpenses.ts?t=1773174649047";
import { useIncomes } from "/src/hooks/useIncomes.ts?t=1773174649047";
import { useInvestments } from "/src/hooks/useInvestments.ts?t=1773174649047";
import { useCategories } from "/src/hooks/useCategories.ts?t=1773174649047";
import { useIncomeCategories } from "/src/hooks/useIncomeCategories.ts?t=1773174649047";
import { useCreditCards } from "/src/hooks/useCreditCards.ts?t=1773174649047";
import { useExpenseCategoryLimits } from "/src/hooks/useExpenseCategoryLimits.ts?t=1773174649047";
import { usePaletteColors } from "/src/hooks/usePaletteColors.ts";
import { getCategoryColorForPalette } from "/src/utils/categoryColors.ts";
import { APP_START_DATE, addMonths, formatCurrency, formatDate, formatMoneyInput, formatMonth, formatNumberBR, getCurrentMonthString, parseMoneyInput } from "/src/utils/format.ts";
import { TrendingUp, TrendingDown, PiggyBank, Plus, Sparkles, RefreshCw } from "/node_modules/.vite/deps/lucide-react.js?v=eb0b1326";
import Button from "/src/components/Button.tsx";
import Modal from "/src/components/Modal.tsx";
import ModalActionFooter from "/src/components/ModalActionFooter.tsx?t=1773168889222";
import Input from "/src/components/Input.tsx";
import Select from "/src/components/Select.tsx";
import AssistantConfirmationPanel from "/src/components/AssistantConfirmationPanel.tsx";
import { useAssistantTurn } from "/src/hooks/useAssistantTurn.ts?t=1773174649047";
import { useAssistantOfflineQueueStatus } from "/src/hooks/useAssistantOfflineQueueStatus.ts?t=1773174649047";
import { useAppSettings } from "/src/hooks/useAppSettings.ts";
import { useNetworkStatus } from "/src/hooks/useNetworkStatus.ts";
import { useVoiceAdapter } from "/src/hooks/useVoiceAdapter.ts";
import { isSupabaseConfigured } from "/src/lib/supabase.ts";
import { getAssistantMonthlyInsights } from "/src/services/assistantService.ts?t=1773174649047";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "/node_modules/.vite/deps/recharts.js?v=eb0b1326";
const EXPENSE_LIMIT_WARNING_THRESHOLD = 85;
export default function Dashboard() {
  _s();
  const {
    monthlyInsightsEnabled,
    assistantConfirmationMode,
    assistantConfirmationPolicyMode,
    assistantLocale,
    assistantOfflineBehavior,
    assistantResponseDepth,
    assistantAutoSpeak,
    assistantSpeechRate,
    assistantSpeechPitch,
    assistantDoubleConfirmationEnabled
  } = useAppSettings();
  const {
    assistantLoading,
    assistantError,
    lastInterpretation,
    editableConfirmationText,
    setEditableConfirmationText,
    editableSlots,
    updateEditableSlots,
    interpretCommand,
    confirmLastInterpretation,
    resetAssistantTurn
  } = useAssistantTurn("web-dashboard-device", {
    locale: assistantLocale,
    offlineBehavior: assistantOfflineBehavior,
    responseDepth: assistantResponseDepth
  });
  const { pendingCount: assistantOfflinePendingCount, hasPending: hasAssistantOfflinePending } = useAssistantOfflineQueueStatus();
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthString);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const { isOnline } = useNetworkStatus();
  const {
    voiceSupport,
    setVoiceStatus,
    voiceListening,
    voicePhase,
    lastHeardCommand,
    clearVoiceFeedback,
    captureSpeech,
    stopActiveListening,
    resolveVoiceConfirmation,
    stopSpeaking
  } = useVoiceAdapter({
    locale: assistantLocale,
    networkErrorMessage: "Falha de rede no reconhecimento de voz. Use o comando em texto e toque em Interpretar.",
    autoSpeakEnabled: assistantAutoSpeak,
    speechRate: assistantSpeechRate,
    speechPitch: assistantSpeechPitch
  });
  const [quickAddType, setQuickAddType] = useState("expense");
  const [hiddenDailyFlowSeries, setHiddenDailyFlowSeries] = useState([]);
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState(null);
  const [formData, setFormData] = useState({
    amount: "",
    report_amount: "",
    date: format(/* @__PURE__ */ new Date(), "yyyy-MM-dd"),
    installment_total: "1",
    payment_method: "other",
    credit_card_id: "",
    month: getCurrentMonthString(),
    category_id: "",
    income_category_id: "",
    description: ""
  });
  const [monthlyInsights, setMonthlyInsights] = useState([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const lastFetchedMonthRef = useRef(null);
  const [isMonthTransitioning, setIsMonthTransitioning] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const formatAxisCurrencyTick = (value) => {
    if (value >= 1e3) {
      return `R$ ${formatNumberBR(value / 1e3, { maximumFractionDigits: 0 })}k`;
    }
    return `R$ ${formatNumberBR(value, { maximumFractionDigits: 0 })}`;
  };
  const handleAmountChange = (nextAmount) => {
    setFormData((prev) => {
      const prevAmount = parseMoneyInput(prev.amount);
      const prevReportAmount = parseMoneyInput(prev.report_amount);
      const shouldSyncReportAmount = !prev.report_amount || !Number.isNaN(prevAmount) && !Number.isNaN(prevReportAmount) && Math.abs(prevReportAmount - prevAmount) < 9e-3;
      return {
        ...prev,
        amount: nextAmount,
        report_amount: shouldSyncReportAmount ? nextAmount : prev.report_amount
      };
    });
  };
  const { colorPalette } = usePaletteColors();
  const { categories } = useCategories();
  const { incomeCategories } = useIncomeCategories();
  const { creditCards } = useCreditCards();
  const { expenses, loading: expensesLoading, refreshExpenses, createExpense } = useExpenses(currentMonth);
  const previousMonth = useMemo(() => addMonths(currentMonth, -1), [currentMonth]);
  const { expenses: previousMonthExpenses } = useExpenses(previousMonth);
  const { incomes, loading: incomesLoading, refreshIncomes, createIncome } = useIncomes(currentMonth);
  const { investments, loading: investmentsLoading, refreshInvestments, createInvestment } = useInvestments(currentMonth);
  const { limits: currentMonthExpenseLimits, loading: expenseLimitsLoading } = useExpenseCategoryLimits(currentMonth);
  const { limits: previousMonthExpenseLimits, loading: previousExpenseLimitsLoading } = useExpenseCategoryLimits(previousMonth);
  const expenseAmountForDashboard = (amount, reportWeight) => amount * (reportWeight ?? 1);
  const incomeAmountForDashboard = (amount, reportWeight) => amount * (reportWeight ?? 1);
  const totalExpenses = expenses.reduce((sum, exp) => sum + expenseAmountForDashboard(exp.amount, exp.report_weight), 0);
  const totalIncomes = incomes.reduce((sum, inc) => sum + incomeAmountForDashboard(inc.amount, inc.report_weight), 0);
  const totalInvestments = investments.reduce((sum, inv) => sum + inv.amount, 0);
  const balance = totalIncomes - totalExpenses - totalInvestments;
  const hasMonthlyData = expenses.length > 0 || incomes.length > 0 || investments.length > 0;
  const loading = expensesLoading || incomesLoading || investmentsLoading || expenseLimitsLoading || previousExpenseLimitsLoading;
  const monthlyOverviewData = useMemo(
    () => [
      { name: "Rendas", value: totalIncomes, color: "var(--color-income)" },
      { name: "Despesas", value: totalExpenses, color: "var(--color-expense)" },
      { name: "Investimentos", value: totalInvestments, color: "var(--color-balance)" }
    ],
    [totalExpenses, totalIncomes, totalInvestments]
  );
  const expenseByCategory = useMemo(() => {
    const map = /* @__PURE__ */ new Map();
    expenses.forEach((expense) => {
      const name = expense.category?.name || "Sem categoria";
      const categoryId = expense.category?.id || expense.category_id || "";
      const key = categoryId || name;
      const color = getCategoryColorForPalette(expense.category?.color || "var(--color-primary)", colorPalette);
      const current = map.get(key);
      if (current) {
        current.value += expenseAmountForDashboard(expense.amount, expense.report_weight);
      } else {
        map.set(key, { categoryId, name, color, value: expenseAmountForDashboard(expense.amount, expense.report_weight) });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [expenses, colorPalette]);
  const currentMonthExpenseLimitMap = useMemo(() => {
    const map = /* @__PURE__ */ new Map();
    currentMonthExpenseLimits.forEach((item) => map.set(item.category_id, item.limit_amount));
    return map;
  }, [currentMonthExpenseLimits]);
  const previousMonthExpenseLimitMap = useMemo(() => {
    const map = /* @__PURE__ */ new Map();
    previousMonthExpenseLimits.forEach((item) => map.set(item.category_id, item.limit_amount));
    return map;
  }, [previousMonthExpenseLimits]);
  const expenseLimitMap = useMemo(() => {
    const map = /* @__PURE__ */ new Map();
    categories.forEach((category) => {
      const currentValue = currentMonthExpenseLimitMap.get(category.id);
      if (currentValue !== void 0) {
        map.set(category.id, currentValue);
        return;
      }
      const previousValue = previousMonthExpenseLimitMap.get(category.id);
      if (previousValue !== void 0) {
        map.set(category.id, previousValue);
      }
    });
    return map;
  }, [categories, currentMonthExpenseLimitMap, previousMonthExpenseLimitMap]);
  const expenseLimitAlerts = useMemo(() => {
    return expenseByCategory.map((item) => {
      const limitAmount = item.categoryId ? expenseLimitMap.get(item.categoryId) : void 0;
      const hasLimit = limitAmount !== null && limitAmount !== void 0;
      if (!hasLimit) return null;
      const exceededAmount = item.value - (limitAmount || 0);
      if (exceededAmount <= 0) return null;
      const exceededPercentage = (limitAmount || 0) > 0 ? exceededAmount / (limitAmount || 1) * 100 : 100;
      const usagePercentage = (limitAmount || 0) > 0 ? item.value / (limitAmount || 1) * 100 : 100;
      return {
        ...item,
        limitAmount: limitAmount || 0,
        exceededAmount,
        exceededPercentage,
        usagePercentage
      };
    }).filter((item) => Boolean(item)).sort((a, b) => b.exceededAmount - a.exceededAmount);
  }, [expenseByCategory, expenseLimitMap]);
  const expenseCategoriesPieData = useMemo(() => {
    if (expenseByCategory.length <= 5) return expenseByCategory;
    const top = expenseByCategory.slice(0, 5);
    const othersValue = expenseByCategory.slice(5).reduce((sum, item) => sum + item.value, 0);
    return [...top, { categoryId: "", name: "Outras", color: "var(--color-text-secondary)", value: othersValue }];
  }, [expenseByCategory]);
  const expenseAttentionCategories = useMemo(() => {
    return expenseByCategory.map((item) => {
      const limitAmount = item.categoryId ? expenseLimitMap.get(item.categoryId) : void 0;
      const hasLimit = limitAmount !== null && limitAmount !== void 0;
      if (!hasLimit || (limitAmount || 0) <= 0) return null;
      const usagePercentage = item.value / (limitAmount || 1) * 100;
      const isNearLimit = usagePercentage >= EXPENSE_LIMIT_WARNING_THRESHOLD && usagePercentage < 100;
      if (!isNearLimit) return null;
      const level = usagePercentage >= 95 ? "Crítica" : usagePercentage >= 90 ? "Alta" : "Média";
      return {
        ...item,
        level,
        usagePercentage,
        limitAmount: limitAmount || 0,
        remainingAmount: (limitAmount || 0) - item.value
      };
    }).filter((item) => Boolean(item)).sort((a, b) => b.usagePercentage - a.usagePercentage);
  }, [expenseByCategory, expenseLimitMap]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const updateViewport = () => setIsMobileViewport(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => {
      mediaQuery.removeEventListener("change", updateViewport);
    };
  }, []);
  const [insightToastError, setInsightToastError] = useState(null);
  const handleRefreshInsights = async () => {
    if (insightsLoading) return;
    setInsightsLoading(true);
    try {
      const result = await getAssistantMonthlyInsights(currentMonth, true);
      if (result) {
        const mergedInsights = [...result.highlights, ...result.recommendations].map((item) => item.trim()).filter(Boolean);
        setMonthlyInsights(mergedInsights.slice(0, 3));
        setInsightToastError(null);
      } else {
        setInsightToastError("Não foi possível gerar os insights no momento. Tente novamente mais tarde.");
      }
    } catch (error) {
      setInsightToastError(error instanceof Error ? error.message : "Falha ao atualizar insights.");
    } finally {
      setInsightsLoading(false);
    }
  };
  useEffect(
    () => {
      let isCancelled = false;
      if (lastFetchedMonthRef.current !== currentMonth) {
        setMonthlyInsights([]);
        setIsMonthTransitioning(true);
        lastFetchedMonthRef.current = currentMonth;
      }
      if (!monthlyInsightsEnabled) {
        setInsightsLoading(false);
        setIsMonthTransitioning(false);
        return;
      }
      if (!hasMonthlyData) {
        setInsightsLoading(false);
        const fadeTimer = setTimeout(() => setIsMonthTransitioning(false), 150);
        return () => clearTimeout(fadeTimer);
      }
      const loadInsights = async () => {
        setInsightsLoading(true);
        try {
          const result = await getAssistantMonthlyInsights(currentMonth);
          if (isCancelled) return;
          if (result) {
            const mergedInsights = [...result.highlights, ...result.recommendations].map((item) => item.trim()).filter(Boolean);
            setMonthlyInsights(mergedInsights.slice(0, 3));
          } else {
            if (typeof navigator !== "undefined" && !navigator.onLine) {
              return;
            }
            setMonthlyInsights([]);
          }
        } catch (error) {
          if (isCancelled) return;
          if (typeof navigator !== "undefined" && !navigator.onLine) {
            return;
          }
          setInsightToastError(error instanceof Error ? error.message : "Falha ao carregar insights do mês.");
          setMonthlyInsights([]);
        } finally {
          if (!isCancelled) {
            setInsightsLoading(false);
            setIsMonthTransitioning(false);
          }
        }
      };
      const timeoutId = setTimeout(() => {
        void loadInsights();
      }, 150);
      return () => {
        isCancelled = true;
        clearTimeout(timeoutId);
      };
    },
    [
      currentMonth,
      monthlyInsightsEnabled,
      hasMonthlyData,
      totalExpenses,
      totalIncomes,
      totalInvestments
    ]
  );
  const prioritizedExpenseCategoryItems = useMemo(() => {
    return expenseByCategory.map((item) => {
      const exceeded = expenseLimitAlerts.find((alert2) => alert2.categoryId === item.categoryId);
      if (exceeded) {
        return {
          ...item,
          alertPriority: 2,
          alertStatusLabel: "Ultrapassou",
          alertStatusClass: "text-secondary"
        };
      }
      const nearLimit = expenseAttentionCategories.find((alert2) => alert2.categoryId === item.categoryId);
      if (nearLimit) {
        return {
          ...item,
          alertPriority: 1,
          alertStatusLabel: nearLimit.level,
          alertStatusClass: "text-secondary"
        };
      }
      return {
        ...item,
        alertPriority: 0,
        alertStatusLabel: "",
        alertStatusClass: "text-secondary"
      };
    }).sort((a, b) => {
      if (b.alertPriority !== a.alertPriority) return b.alertPriority - a.alertPriority;
      return b.value - a.value;
    });
  }, [expenseByCategory, expenseLimitAlerts, expenseAttentionCategories]);
  const dailyFlowData = useMemo(() => {
    const [year, month] = currentMonth.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const series = Array.from({ length: daysInMonth }, (_, index) => ({
      day: String(index + 1).padStart(2, "0"),
      Rendas: 0,
      Despesas: 0,
      Investimentos: 0
    }));
    incomes.forEach((income) => {
      const day = (/* @__PURE__ */ new Date(`${income.date}T00:00:00`)).getDate();
      if (day >= 1 && day <= daysInMonth) series[day - 1].Rendas += incomeAmountForDashboard(income.amount, income.report_weight);
    });
    expenses.forEach((expense) => {
      const day = (/* @__PURE__ */ new Date(`${expense.date}T00:00:00`)).getDate();
      if (day >= 1 && day <= daysInMonth) series[day - 1].Despesas += expenseAmountForDashboard(expense.amount, expense.report_weight);
    });
    investments.forEach((investment) => {
      const investmentDay = 1;
      if (investmentDay >= 1 && investmentDay <= daysInMonth) {
        series[investmentDay - 1].Investimentos += investment.amount;
      }
    });
    return series;
  }, [currentMonth, incomes, expenses, investments]);
  const chartTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;
    const isDayLabel = typeof label === "string" && /^\d{1,2}$/.test(label);
    return /* @__PURE__ */ jsxDEV("div", { className: "rounded-lg border border-primary bg-primary px-3 py-2 shadow-sm", children: [
      label && /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-secondary mb-1", children: isDayLabel ? `Dia ${label}` : label }, void 0, false, {
        fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
        lineNumber: 510,
        columnNumber: 19
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "space-y-1", children: payload.map(
        (entry, index) => /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-primary", children: [
          entry.name,
          ": ",
          formatCurrency(Number(entry.value || 0))
        ] }, `${entry.name}-${index}`, true, {
          fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
          lineNumber: 513,
          columnNumber: 11
        }, this)
      ) }, void 0, false, {
        fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
        lineNumber: 511,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
      lineNumber: 509,
      columnNumber: 7
    }, this);
  };
  const openExpenseCategoryDetails = (categoryId, categoryName) => {
    if (!categoryId) return;
    setSelectedExpenseCategory({ id: categoryId, name: categoryName });
  };
  const selectedExpenseCategoryDetails = useMemo(() => {
    if (!selectedExpenseCategory) return null;
    const currentItems = expenses.filter((expense) => (expense.category?.id || expense.category_id || "") === selectedExpenseCategory.id);
    const previousItems = previousMonthExpenses.filter((expense) => (expense.category?.id || expense.category_id || "") === selectedExpenseCategory.id);
    const currentTotal = currentItems.reduce((sum, item) => sum + expenseAmountForDashboard(item.amount, item.report_weight), 0);
    const previousTotal = previousItems.reduce((sum, item) => sum + expenseAmountForDashboard(item.amount, item.report_weight), 0);
    return {
      currentItems,
      currentTotal,
      previousTotal
    };
  }, [selectedExpenseCategory, expenses, previousMonthExpenses]);
  const selectedExpenseCategoryLimitDetails = useMemo(() => {
    if (!selectedExpenseCategory || !selectedExpenseCategoryDetails) return null;
    const rawLimit = expenseLimitMap.get(selectedExpenseCategory.id);
    const hasLimit = rawLimit !== null && rawLimit !== void 0;
    if (!hasLimit) return null;
    const limitAmount = rawLimit || 0;
    const currentTotal = selectedExpenseCategoryDetails.currentTotal;
    const exceededAmount = Math.max(currentTotal - limitAmount, 0);
    const remainingAmount = Math.max(limitAmount - currentTotal, 0);
    return {
      limitAmount,
      currentTotal,
      exceededAmount,
      remainingAmount,
      isExceeded: currentTotal > limitAmount
    };
  }, [selectedExpenseCategory, selectedExpenseCategoryDetails, expenseLimitMap]);
  const toggleDailyFlowSeries = (dataKey) => {
    setHiddenDailyFlowSeries(
      (prev) => prev.includes(dataKey) ? prev.filter((key) => key !== dataKey) : [...prev, dataKey]
    );
  };
  const renderInteractiveLegend = ({ payload }) => {
    if (!payload?.length) return null;
    return /* @__PURE__ */ jsxDEV("div", { className: "flex flex-wrap gap-2 pt-2", children: payload.map((entry) => {
      const dataKey = String(entry.dataKey ?? entry.value ?? "");
      const isHidden = hiddenDailyFlowSeries.includes(dataKey);
      return /* @__PURE__ */ jsxDEV(
        "button",
        {
          type: "button",
          onClick: () => toggleDailyFlowSeries(dataKey),
          className: `px-2 py-1 rounded-md border border-primary text-xs flex items-center gap-2 motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] ${isHidden ? "opacity-50 bg-secondary text-secondary" : "bg-primary text-primary"}`,
          "aria-pressed": !isHidden,
          children: [
            /* @__PURE__ */ jsxDEV("span", { className: "w-2.5 h-2.5 rounded-full", style: { backgroundColor: entry.color } }, void 0, false, {
              fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
              lineNumber: 590,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("span", { className: "text-primary", children: entry.value }, void 0, false, {
              fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
              lineNumber: 591,
              columnNumber: 15
            }, this)
          ]
        },
        dataKey,
        true,
        {
          fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
          lineNumber: 582,
          columnNumber: 13
        },
        this
      );
    }) }, void 0, false, {
      fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
      lineNumber: 576,
      columnNumber: 7
    }, this);
  };
  const interactiveRowButtonClasses = "w-full rounded-lg border border-primary bg-secondary text-primary px-3 py-3 text-left motion-standard hover-lift-subtle press-subtle hover:bg-tertiary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]";
  const insightNarrativeMoment = useMemo(() => {
    const now = /* @__PURE__ */ new Date();
    const currentMonthKey = format(now, "yyyy-MM");
    const isClosedMonth = currentMonth < currentMonthKey;
    if (isClosedMonth) {
      return {
        isFinalized: true
      };
    }
    if (currentMonth !== currentMonthKey) {
      return {
        isFinalized: false
      };
    }
    const [year, month] = currentMonth.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const isLastDay = now.getDate() >= daysInMonth;
    return {
      isFinalized: isLastDay
    };
  }, [currentMonth]);
  const monthlyInsightsNarrative = useMemo(() => {
    if (!monthlyInsights.length) return "";
    const normalized = monthlyInsights.map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean).map((item) => /[.!?]$/.test(item) ? item : `${item}.`);
    if (normalized.length === 1) {
      const single = normalized[0].replace(/[.!?]+$/, "");
      return `${single}.`;
    }
    const withoutTrailingDot = normalized.map((item) => item.replace(/[.!?]+$/, ""));
    const firstSentence = `${withoutTrailingDot[0]}.`;
    const toClauseAfterConnector = (value) => {
      const text = value.trim();
      if (!text) return text;
      const [firstChar, ...restChars] = text;
      const rest = restChars.join("");
      return `${firstChar.toLowerCase()}${rest}`;
    };
    const simplifyForMobile = (value) => {
      const compact = value.replace(/^Com base no andamento atual do mês,\s*/i, "").replace(/^No mês analisado,\s*/i, "").replace(/^vale revisar este ponto:\s*/i, "").replace(/\s+até o momento$/i, "").replace(/\s+até aqui$/i, "").trim();
      const firstClause = compact.split(/[;:]/)[0]?.trim() || compact;
      return firstClause || compact;
    };
    if (isMobileViewport) {
      const firstMobileSentence = simplifyForMobile(withoutTrailingDot[0]);
      if (withoutTrailingDot.length === 1) {
        return `${firstMobileSentence}.`;
      }
      const secondMobileSentence = simplifyForMobile(withoutTrailingDot[1]);
      return `${firstMobileSentence}. ${secondMobileSentence}.`;
    }
    if (withoutTrailingDot.length === 2) {
      return insightNarrativeMoment.isFinalized ? `${firstSentence} Além disso, ${toClauseAfterConnector(withoutTrailingDot[1])}.` : `${firstSentence} Até aqui, ${toClauseAfterConnector(withoutTrailingDot[1])}.`;
    }
    return insightNarrativeMoment.isFinalized ? `${firstSentence} ${withoutTrailingDot[1]}. ${withoutTrailingDot[2]}.` : `${firstSentence} ${withoutTrailingDot[1]}. Para os próximos dias, ${toClauseAfterConnector(withoutTrailingDot[2])}.`;
  }, [monthlyInsights, insightNarrativeMoment.isFinalized, isMobileViewport]);
  const shouldShowMonthlyInsightsCard = monthlyInsightsEnabled && hasMonthlyData && isOnline;
  const openQuickAdd = (type) => {
    setQuickAddType(type);
    setFormData({
      amount: "",
      report_amount: "",
      date: format(/* @__PURE__ */ new Date(), "yyyy-MM-dd"),
      installment_total: "1",
      payment_method: "other",
      credit_card_id: "",
      month: currentMonth,
      category_id: categories[0]?.id || "",
      income_category_id: incomeCategories[0]?.id || "",
      description: ""
    });
    setIsQuickAddOpen(true);
  };
  const closeQuickAdd = () => {
    setIsQuickAddOpen(false);
  };
  const quickAddTitle = quickAddType === "expense" ? "Nova despesa" : quickAddType === "income" ? "Nova renda" : "Novo investimento";
  const playAssistantBeep = (type = "start") => {
    if (typeof window === "undefined") return;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return;
    const context = new AudioContextCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    const toneMap = {
      start: { start: 880, end: 1040 },
      end: { start: 520, end: 420 },
      heard: { start: 700, end: 760 },
      executed: { start: 980, end: 1180 }
    };
    const startFrequency = toneMap[type].start;
    const endFrequency = toneMap[type].end;
    oscillator.frequency.setValueAtTime(startFrequency, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, context.currentTime + 0.14);
    gain.gain.setValueAtTime(1e-3, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(1e-3, context.currentTime + 0.14);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.14);
    oscillator.onended = () => {
      context.close().catch(() => void 0);
    };
  };
  const openAssistant = () => {
    resetAssistantTurn();
    setIsAssistantOpen(true);
    clearVoiceFeedback();
    void handleVoiceInterpret();
  };
  const closeAssistant = () => {
    stopActiveListening();
    stopSpeaking();
    setIsAssistantOpen(false);
    clearVoiceFeedback();
    resetAssistantTurn();
  };
  const isExpenseIntent = lastInterpretation?.intent === "add_expense";
  const touchConfirmationEnabled = assistantConfirmationMode !== "voice" || isExpenseIntent;
  const voiceConfirmationEnabled = assistantConfirmationMode !== "touch" && !isExpenseIntent;
  const actionColumnsClass = touchConfirmationEnabled && voiceConfirmationEnabled ? "sm:grid-cols-3" : "sm:grid-cols-2";
  const handleConfirmAssistant = async (confirmed) => {
    if (!isSupabaseConfigured) return;
    try {
      const result = await confirmLastInterpretation({ confirmed });
      if (!result) return;
      if (result.status === "executed" || result.status === "denied") {
        if (result.status === "executed") {
          playAssistantBeep("executed");
        }
        closeAssistant();
      }
    } catch (error) {
      console.error("[Dashboard] Error confirming assistant:", error);
    }
  };
  const handleVoiceInterpret = async () => {
    if (!isSupabaseConfigured || assistantLoading) return;
    if (voiceListening) {
      stopActiveListening();
      return;
    }
    try {
      playAssistantBeep();
      const transcript = await captureSpeech("Fale seu comando");
      if (!transcript) return;
      const result = await interpretCommand(transcript, {
        confirmationMode: assistantConfirmationPolicyMode,
        forceConfirmation: assistantDoubleConfirmationEnabled
      });
      if (!result) return;
      if (!result.requiresConfirmation) {
        playAssistantBeep("executed");
      }
    } catch (error) {
      setVoiceStatus(error instanceof Error ? error.message : "Erro ao interpretar comando por voz.");
    }
  };
  const handleVoiceConfirm = async () => {
    if (!isSupabaseConfigured || assistantLoading || !lastInterpretation?.command.id) return;
    if (!voiceConfirmationEnabled) {
      setVoiceStatus("Confirmação por voz está desativada nas suas configurações.");
      return;
    }
    try {
      const transcript = await captureSpeech("Confirme por voz");
      if (!transcript) return;
      const confirmed = resolveVoiceConfirmation(transcript);
      const result = await confirmLastInterpretation({
        confirmed,
        spokenText: transcript,
        includeEditable: false
      });
      if (!result) return;
      if (result.status === "executed") {
        playAssistantBeep("executed");
      }
    } catch (error) {
      setVoiceStatus(error instanceof Error ? error.message : "Erro ao confirmar por voz.");
    }
  };
  const handleQuickAddSubmit = async (event) => {
    event.preventDefault();
    const amount = parseMoneyInput(formData.amount);
    if (!amount || amount <= 0) {
      alert("Insira um valor válido maior que zero.");
      return;
    }
    const reportAmount = formData.report_amount ? parseMoneyInput(formData.report_amount) : amount;
    if (quickAddType !== "investment" && (Number.isNaN(reportAmount) || reportAmount < 0 || reportAmount > amount)) {
      alert("O valor no relatório deve estar entre 0 e o valor total.");
      return;
    }
    const reportWeight = amount > 0 ? Number((reportAmount / amount).toFixed(4)) : 1;
    const rawInstallments = Number(formData.installment_total || "1");
    const installmentTotal = Math.max(1, Math.min(60, rawInstallments));
    if (quickAddType === "expense" && (!Number.isInteger(rawInstallments) || rawInstallments < 1)) {
      alert("Informe um número válido de parcelas (mínimo 1).");
      return;
    }
    if (quickAddType === "expense" && formData.payment_method === "credit_card" && !formData.credit_card_id) {
      alert("Selecione um cartão de crédito para compras no crédito.");
      return;
    }
    if (quickAddType === "expense") {
      if (!formData.category_id) {
        alert("Selecione uma categoria de despesa.");
        return;
      }
      const { error } = await createExpense({
        amount,
        report_weight: reportWeight,
        date: formData.date,
        installment_total: installmentTotal,
        payment_method: formData.payment_method,
        credit_card_id: formData.payment_method === "credit_card" ? formData.credit_card_id : null,
        category_id: formData.category_id,
        ...formData.description && { description: formData.description }
      });
      if (error) {
        alert(`Erro ao criar despesa: ${error}`);
        return;
      }
    }
    if (quickAddType === "income") {
      if (!formData.income_category_id) {
        alert("Selecione uma categoria de renda.");
        return;
      }
      const { error } = await createIncome({
        amount,
        report_weight: reportWeight,
        date: formData.date,
        income_category_id: formData.income_category_id,
        ...formData.description && { description: formData.description }
      });
      if (error) {
        alert(`Erro ao criar renda: ${error}`);
        return;
      }
    }
    if (quickAddType === "investment") {
      const selectedDate = formData.date || format(/* @__PURE__ */ new Date(), "yyyy-MM-dd");
      const { error } = await createInvestment({
        amount,
        month: selectedDate.substring(0, 7),
        ...formData.description && { description: formData.description }
      });
      if (error) {
        alert(`Erro ao criar investimento: ${error}`);
        return;
      }
    }
    closeQuickAdd();
    refreshExpenses();
    refreshIncomes();
    refreshInvestments();
  };
  return /* @__PURE__ */ jsxDEV("div", { children: [
    insightToastError && /* @__PURE__ */ jsxDEV(
      "div",
      {
        role: "alert",
        className: "fixed bottom-4 right-4 z-50 max-w-xs w-full bg-secondary border border-primary rounded-xl shadow-lg px-4 py-3 flex items-start gap-3 animate-fade-in",
        onClick: () => setInsightToastError(null),
        children: [
          /* @__PURE__ */ jsxDEV("span", { className: "text-xs text-secondary leading-relaxed flex-1 cursor-pointer", children: [
            "⚠️ ",
            insightToastError
          ] }, void 0, true, {
            fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
            lineNumber: 950,
            columnNumber: 11
          }, this),
          /* @__PURE__ */ jsxDEV(
            "button",
            {
              type: "button",
              className: "text-secondary hover:text-primary flex-shrink-0 mt-0.5",
              onClick: () => setInsightToastError(null),
              "aria-label": "Fechar notificação",
              children: "✕"
            },
            void 0,
            false,
            {
              fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
              lineNumber: 953,
              columnNumber: 11
            },
            this
          )
        ]
      },
      void 0,
      true,
      {
        fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
        lineNumber: 945,
        columnNumber: 7
      },
      this
    ),
    /* @__PURE__ */ jsxDEV(
      PageHeader,
      {
        title: PAGE_HEADERS.dashboard.title,
        subtitle: PAGE_HEADERS.dashboard.description,
        action: /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2", children: [
          isOnline && /* @__PURE__ */ jsxDEV(
            Button,
            {
              size: "sm",
              variant: "outline",
              onClick: openAssistant,
              className: "flex items-center gap-2",
              "aria-label": "Assistente",
              title: "Assistente",
              children: /* @__PURE__ */ jsxDEV(Sparkles, { size: 16 }, void 0, false, {
                fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                lineNumber: 978,
                columnNumber: 17
              }, this)
            },
            void 0,
            false,
            {
              fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
              lineNumber: 970,
              columnNumber: 11
            },
            this
          ),
          /* @__PURE__ */ jsxDEV(
            Button,
            {
              size: "sm",
              variant: "outline",
              onClick: () => openQuickAdd("expense"),
              className: "flex items-center gap-2",
              disabled: categories.length === 0 && incomeCategories.length === 0,
              children: [
                /* @__PURE__ */ jsxDEV(Plus, { size: 16 }, void 0, false, {
                  fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                  lineNumber: 988,
                  columnNumber: 15
                }, this),
                /* @__PURE__ */ jsxDEV("span", { className: "hidden sm:inline", children: "Lançamento" }, void 0, false, {
                  fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                  lineNumber: 989,
                  columnNumber: 15
                }, this)
              ]
            },
            void 0,
            true,
            {
              fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
              lineNumber: 981,
              columnNumber: 13
            },
            this
          )
        ] }, void 0, true, {
          fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
          lineNumber: 968,
          columnNumber: 9
        }, this)
      },
      void 0,
      false,
      {
        fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
        lineNumber: 964,
        columnNumber: 7
      },
      this
    ),
    /* @__PURE__ */ jsxDEV("div", { className: "p-4 lg:p-6", children: [
      /* @__PURE__ */ jsxDEV(MonthSelector, { value: currentMonth, onChange: setCurrentMonth }, void 0, false, {
        fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
        lineNumber: 996,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV(
        "div",
        {
          style: {
            opacity: isMonthTransitioning ? 0 : 1,
            transition: "opacity 150ms ease-in-out",
            willChange: "opacity"
          },
          children: [
            shouldShowMonthlyInsightsCard && /* @__PURE__ */ jsxDEV(Card, { className: "mt-4 lg:mt-6 animate-insight-enter", children: /* @__PURE__ */ jsxDEV("div", { className: "space-y-4", children: [
              /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between gap-4", children: [
                /* @__PURE__ */ jsxDEV("h3", { className: "text-lg font-semibold text-primary", children: "Insights personalizados do mês" }, void 0, false, {
                  fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                  lineNumber: 1011,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV(
                  "button",
                  {
                    type: "button",
                    onClick: handleRefreshInsights,
                    disabled: insightsLoading,
                    className: `p-2 rounded-lg border border-primary bg-secondary text-primary motion-standard hover-lift-subtle press-subtle hover:bg-tertiary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] disabled:opacity-50 ${insightsLoading ? "animate-spin" : ""}`,
                    title: "Forçar atualização dos insights",
                    children: /* @__PURE__ */ jsxDEV(RefreshCw, { size: 16 }, void 0, false, {
                      fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                      lineNumber: 1020,
                      columnNumber: 21
                    }, this)
                  },
                  void 0,
                  false,
                  {
                    fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                    lineNumber: 1012,
                    columnNumber: 19
                  },
                  this
                )
              ] }, void 0, true, {
                fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                lineNumber: 1010,
                columnNumber: 17
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "transition-opacity duration-300", style: { opacity: insightsLoading ? 0.4 : 1 }, children: insightsLoading || isMonthTransitioning ? /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-3 py-2 animate-pulse", children: [
                /* @__PURE__ */ jsxDEV("div", { className: "w-1.5 h-10 rounded-full bg-tertiary" }, void 0, false, {
                  fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                  lineNumber: 1027,
                  columnNumber: 23
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "flex-1 space-y-2", children: [
                  /* @__PURE__ */ jsxDEV("div", { className: "h-4 bg-tertiary rounded w-3/4" }, void 0, false, {
                    fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                    lineNumber: 1029,
                    columnNumber: 25
                  }, this),
                  /* @__PURE__ */ jsxDEV("div", { className: "h-3 bg-tertiary rounded w-1/2" }, void 0, false, {
                    fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                    lineNumber: 1030,
                    columnNumber: 25
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                  lineNumber: 1028,
                  columnNumber: 23
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                lineNumber: 1026,
                columnNumber: 17
              }, this) : monthlyInsightsNarrative.length > 0 ? /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-primary leading-relaxed", children: monthlyInsightsNarrative }, void 0, false, {
                fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                lineNumber: 1034,
                columnNumber: 17
              }, this) : /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-secondary leading-relaxed italic", children: "Nenhum insight gerado para este mês. Clique em ↻ para gerar agora." }, void 0, false, {
                fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                lineNumber: 1038,
                columnNumber: 17
              }, this) }, void 0, false, {
                fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                lineNumber: 1024,
                columnNumber: 17
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
              lineNumber: 1009,
              columnNumber: 15
            }, this) }, void 0, false, {
              fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
              lineNumber: 1008,
              columnNumber: 11
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: shouldShowMonthlyInsightsCard ? "mt-4 lg:mt-6" : "mt-3 lg:mt-4", children: loading ? /* @__PURE__ */ jsxDEV("div", { className: "text-center py-8 text-secondary", children: "Carregando..." }, void 0, false, {
              fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
              lineNumber: 1050,
              columnNumber: 13
            }, this) : !hasMonthlyData ? /* @__PURE__ */ jsxDEV(Card, { children: /* @__PURE__ */ jsxDEV("div", { className: "text-center py-8", children: /* @__PURE__ */ jsxDEV("p", { className: "text-base text-primary font-medium", children: "Adicione o primeiro lançamento do mês." }, void 0, false, {
              fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
              lineNumber: 1054,
              columnNumber: 19
            }, this) }, void 0, false, {
              fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
              lineNumber: 1053,
              columnNumber: 17
            }, this) }, void 0, false, {
              fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
              lineNumber: 1052,
              columnNumber: 13
            }, this) : /* @__PURE__ */ jsxDEV(Fragment, { children: [
              /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch", children: [
                /* @__PURE__ */ jsxDEV(Card, { className: "h-full", children: /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between", children: [
                  /* @__PURE__ */ jsxDEV("div", { className: "flex-1", children: [
                    /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-secondary", children: "Rendas" }, void 0, false, {
                      fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                      lineNumber: 1063,
                      columnNumber: 25
                    }, this),
                    /* @__PURE__ */ jsxDEV("p", { className: "text-2xl font-bold mt-1", style: { color: "var(--color-income)" }, children: formatCurrency(totalIncomes) }, void 0, false, {
                      fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                      lineNumber: 1064,
                      columnNumber: 25
                    }, this)
                  ] }, void 0, true, {
                    fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                    lineNumber: 1062,
                    columnNumber: 23
                  }, this),
                  /* @__PURE__ */ jsxDEV(TrendingUp, { className: "flex-shrink-0 ml-2", size: 24, style: { color: "var(--color-income)" } }, void 0, false, {
                    fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                    lineNumber: 1068,
                    columnNumber: 23
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                  lineNumber: 1061,
                  columnNumber: 21
                }, this) }, void 0, false, {
                  fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                  lineNumber: 1060,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV(Card, { className: "h-full", children: /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between", children: [
                  /* @__PURE__ */ jsxDEV("div", { className: "flex-1", children: [
                    /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-secondary", children: "Despesas" }, void 0, false, {
                      fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                      lineNumber: 1075,
                      columnNumber: 25
                    }, this),
                    /* @__PURE__ */ jsxDEV("p", { className: "text-2xl font-bold mt-1", style: { color: "var(--color-expense)" }, children: formatCurrency(totalExpenses) }, void 0, false, {
                      fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                      lineNumber: 1076,
                      columnNumber: 25
                    }, this)
                  ] }, void 0, true, {
                    fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                    lineNumber: 1074,
                    columnNumber: 23
                  }, this),
                  /* @__PURE__ */ jsxDEV(TrendingDown, { className: "flex-shrink-0 ml-2", size: 24, style: { color: "var(--color-expense)" } }, void 0, false, {
                    fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                    lineNumber: 1080,
                    columnNumber: 23
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                  lineNumber: 1073,
                  columnNumber: 21
                }, this) }, void 0, false, {
                  fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                  lineNumber: 1072,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV(Card, { className: "h-full", children: /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between", children: [
                  /* @__PURE__ */ jsxDEV("div", { className: "flex-1", children: [
                    /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-secondary", children: "Investimentos" }, void 0, false, {
                      fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                      lineNumber: 1087,
                      columnNumber: 25
                    }, this),
                    /* @__PURE__ */ jsxDEV("p", { className: "text-2xl font-bold mt-1", style: { color: "var(--color-balance)" }, children: formatCurrency(totalInvestments) }, void 0, false, {
                      fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                      lineNumber: 1088,
                      columnNumber: 25
                    }, this)
                  ] }, void 0, true, {
                    fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                    lineNumber: 1086,
                    columnNumber: 23
                  }, this),
                  /* @__PURE__ */ jsxDEV(PiggyBank, { className: "flex-shrink-0 ml-2", size: 24, style: { color: "var(--color-balance)" } }, void 0, false, {
                    fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                    lineNumber: 1092,
                    columnNumber: 23
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                  lineNumber: 1085,
                  columnNumber: 21
                }, this) }, void 0, false, {
                  fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                  lineNumber: 1084,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV(Card, { className: "h-full", children: /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between", children: /* @__PURE__ */ jsxDEV("div", { className: "flex-1", children: [
                  /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-secondary", children: "Saldo" }, void 0, false, {
                    fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                    lineNumber: 1099,
                    columnNumber: 25
                  }, this),
                  /* @__PURE__ */ jsxDEV(
                    "p",
                    {
                      className: "text-2xl font-bold mt-1",
                      style: {
                        color: balance >= 0 ? "var(--color-income)" : "var(--color-expense)"
                      },
                      children: formatCurrency(balance)
                    },
                    void 0,
                    false,
                    {
                      fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                      lineNumber: 1100,
                      columnNumber: 25
                    },
                    this
                  )
                ] }, void 0, true, {
                  fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                  lineNumber: 1098,
                  columnNumber: 23
                }, this) }, void 0, false, {
                  fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                  lineNumber: 1097,
                  columnNumber: 21
                }, this) }, void 0, false, {
                  fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                  lineNumber: 1096,
                  columnNumber: 19
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                lineNumber: 1059,
                columnNumber: 17
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "mt-4 space-y-4", children: [
                /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch", children: [
                  /* @__PURE__ */ jsxDEV(Card, { className: "h-full flex flex-col", children: [
                    /* @__PURE__ */ jsxDEV("h3", { className: "text-lg font-semibold text-primary mb-4", children: "Panorama do mês" }, void 0, false, {
                      fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                      lineNumber: 1116,
                      columnNumber: 23
                    }, this),
                    /* @__PURE__ */ jsxDEV(ResponsiveContainer, { width: "100%", height: 280, children: /* @__PURE__ */ jsxDEV(BarChart, { data: monthlyOverviewData, children: [
                      /* @__PURE__ */ jsxDEV(CartesianGrid, { strokeDasharray: "3 3", stroke: "var(--color-border)" }, void 0, false, {
                        fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                        lineNumber: 1119,
                        columnNumber: 27
                      }, this),
                      /* @__PURE__ */ jsxDEV(XAxis, { dataKey: "name", stroke: "var(--color-text-secondary)", fontSize: 12, tick: { fill: "var(--color-text-secondary)" } }, void 0, false, {
                        fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                        lineNumber: 1120,
                        columnNumber: 27
                      }, this),
                      /* @__PURE__ */ jsxDEV(
                        YAxis,
                        {
                          stroke: "var(--color-text-secondary)",
                          fontSize: 12,
                          tick: { fill: "var(--color-text-secondary)" },
                          tickFormatter: (value) => formatAxisCurrencyTick(Number(value))
                        },
                        void 0,
                        false,
                        {
                          fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                          lineNumber: 1121,
                          columnNumber: 27
                        },
                        this
                      ),
                      /* @__PURE__ */ jsxDEV(Tooltip, { content: chartTooltip }, void 0, false, {
                        fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                        lineNumber: 1127,
                        columnNumber: 27
                      }, this),
                      /* @__PURE__ */ jsxDEV(Bar, { dataKey: "value", radius: [6, 6, 0, 0], children: monthlyOverviewData.map(
                        (item) => /* @__PURE__ */ jsxDEV(Cell, { fill: item.color }, item.name, false, {
                          fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                          lineNumber: 1130,
                          columnNumber: 27
                        }, this)
                      ) }, void 0, false, {
                        fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                        lineNumber: 1128,
                        columnNumber: 27
                      }, this)
                    ] }, void 0, true, {
                      fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                      lineNumber: 1118,
                      columnNumber: 25
                    }, this) }, void 0, false, {
                      fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                      lineNumber: 1117,
                      columnNumber: 23
                    }, this)
                  ] }, void 0, true, {
                    fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                    lineNumber: 1115,
                    columnNumber: 21
                  }, this),
                  /* @__PURE__ */ jsxDEV(Card, { className: "h-full flex flex-col", children: [
                    /* @__PURE__ */ jsxDEV("h3", { className: "text-lg font-semibold text-primary mb-4", children: "Fluxo diário (mês)" }, void 0, false, {
                      fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                      lineNumber: 1138,
                      columnNumber: 23
                    }, this),
                    /* @__PURE__ */ jsxDEV(ResponsiveContainer, { width: "100%", height: 280, children: /* @__PURE__ */ jsxDEV(LineChart, { data: dailyFlowData, children: [
                      /* @__PURE__ */ jsxDEV(CartesianGrid, { strokeDasharray: "3 3", stroke: "var(--color-border)" }, void 0, false, {
                        fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                        lineNumber: 1141,
                        columnNumber: 27
                      }, this),
                      /* @__PURE__ */ jsxDEV(XAxis, { dataKey: "day", stroke: "var(--color-text-secondary)", fontSize: 12, tick: { fill: "var(--color-text-secondary)" }, minTickGap: 14 }, void 0, false, {
                        fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                        lineNumber: 1142,
                        columnNumber: 27
                      }, this),
                      /* @__PURE__ */ jsxDEV(
                        YAxis,
                        {
                          stroke: "var(--color-text-secondary)",
                          fontSize: 12,
                          tick: { fill: "var(--color-text-secondary)" },
                          tickFormatter: (value) => formatAxisCurrencyTick(Number(value))
                        },
                        void 0,
                        false,
                        {
                          fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                          lineNumber: 1143,
                          columnNumber: 27
                        },
                        this
                      ),
                      /* @__PURE__ */ jsxDEV(Tooltip, { content: chartTooltip }, void 0, false, {
                        fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                        lineNumber: 1149,
                        columnNumber: 27
                      }, this),
                      /* @__PURE__ */ jsxDEV(Legend, { content: renderInteractiveLegend }, void 0, false, {
                        fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                        lineNumber: 1150,
                        columnNumber: 27
                      }, this),
                      /* @__PURE__ */ jsxDEV(Line, { type: "monotone", dataKey: "Rendas", stroke: "var(--color-income)", strokeWidth: 2, dot: false, hide: hiddenDailyFlowSeries.includes("Rendas") }, void 0, false, {
                        fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                        lineNumber: 1151,
                        columnNumber: 27
                      }, this),
                      /* @__PURE__ */ jsxDEV(Line, { type: "monotone", dataKey: "Despesas", stroke: "var(--color-expense)", strokeWidth: 2, dot: false, hide: hiddenDailyFlowSeries.includes("Despesas") }, void 0, false, {
                        fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                        lineNumber: 1152,
                        columnNumber: 27
                      }, this),
                      /* @__PURE__ */ jsxDEV(Line, { type: "monotone", dataKey: "Investimentos", stroke: "var(--color-balance)", strokeWidth: 2, dot: false, hide: hiddenDailyFlowSeries.includes("Investimentos") }, void 0, false, {
                        fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                        lineNumber: 1153,
                        columnNumber: 27
                      }, this)
                    ] }, void 0, true, {
                      fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                      lineNumber: 1140,
                      columnNumber: 25
                    }, this) }, void 0, false, {
                      fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                      lineNumber: 1139,
                      columnNumber: 23
                    }, this)
                  ] }, void 0, true, {
                    fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                    lineNumber: 1137,
                    columnNumber: 21
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                  lineNumber: 1114,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-1 gap-4 items-stretch", children: /* @__PURE__ */ jsxDEV(Card, { className: "h-full flex flex-col", children: [
                  /* @__PURE__ */ jsxDEV("div", { className: "mb-4 space-y-1.5", children: [
                    /* @__PURE__ */ jsxDEV("h3", { className: "text-lg font-semibold text-primary", children: "Despesas por categoria" }, void 0, false, {
                      fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                      lineNumber: 1162,
                      columnNumber: 25
                    }, this),
                    /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-secondary", children: "Gráfico por porcentagem e lista priorizada por alertas de limite." }, void 0, false, {
                      fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                      lineNumber: 1163,
                      columnNumber: 25
                    }, this)
                  ] }, void 0, true, {
                    fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                    lineNumber: 1161,
                    columnNumber: 23
                  }, this),
                  expenseCategoriesPieData.length === 0 ? /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-secondary text-center", children: "Sem despesas no mês selecionado." }, void 0, false, {
                    fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                    lineNumber: 1166,
                    columnNumber: 21
                  }, this) : /* @__PURE__ */ jsxDEV(Fragment, { children: [
                    /* @__PURE__ */ jsxDEV("div", { className: "mx-auto w-full max-w-2xl", children: /* @__PURE__ */ jsxDEV(ResponsiveContainer, { width: "100%", height: 260, children: /* @__PURE__ */ jsxDEV(PieChart, { children: [
                      /* @__PURE__ */ jsxDEV(
                        Pie,
                        {
                          data: expenseCategoriesPieData,
                          dataKey: "value",
                          nameKey: "name",
                          outerRadius: 86,
                          labelLine: false,
                          label: false,
                          onClick: (entry) => {
                            if (entry?.categoryId && entry?.name) {
                              openExpenseCategoryDetails(entry.categoryId, entry.name);
                            }
                          },
                          children: expenseCategoriesPieData.map(
                            (entry) => /* @__PURE__ */ jsxDEV(Cell, { fill: entry.color }, entry.name, false, {
                              fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                              lineNumber: 1186,
                              columnNumber: 31
                            }, this)
                          )
                        },
                        void 0,
                        false,
                        {
                          fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                          lineNumber: 1172,
                          columnNumber: 33
                        },
                        this
                      ),
                      /* @__PURE__ */ jsxDEV(Tooltip, { content: chartTooltip }, void 0, false, {
                        fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                        lineNumber: 1189,
                        columnNumber: 33
                      }, this)
                    ] }, void 0, true, {
                      fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                      lineNumber: 1171,
                      columnNumber: 31
                    }, this) }, void 0, false, {
                      fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                      lineNumber: 1170,
                      columnNumber: 29
                    }, this) }, void 0, false, {
                      fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                      lineNumber: 1169,
                      columnNumber: 27
                    }, this),
                    /* @__PURE__ */ jsxDEV("div", { className: "mt-4 space-y-3", children: prioritizedExpenseCategoryItems.map((item) => {
                      const percentage = totalExpenses > 0 ? item.value / totalExpenses * 100 : 0;
                      return /* @__PURE__ */ jsxDEV(
                        "button",
                        {
                          type: "button",
                          onClick: () => openExpenseCategoryDetails(item.categoryId, item.name),
                          className: interactiveRowButtonClasses,
                          children: [
                            /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between gap-3", children: [
                              /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2.5 min-w-0", children: [
                                /* @__PURE__ */ jsxDEV("span", { className: "w-3 h-3 rounded-full flex-shrink-0", style: { backgroundColor: item.color } }, void 0, false, {
                                  fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                                  lineNumber: 1206,
                                  columnNumber: 39
                                }, this),
                                /* @__PURE__ */ jsxDEV("span", { className: "text-primary truncate", children: item.name }, void 0, false, {
                                  fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                                  lineNumber: 1207,
                                  columnNumber: 39
                                }, this)
                              ] }, void 0, true, {
                                fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                                lineNumber: 1205,
                                columnNumber: 37
                              }, this),
                              /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-end gap-2.5 flex-shrink-0", children: [
                                item.alertPriority > 0 && /* @__PURE__ */ jsxDEV("span", { className: `text-xs px-2 py-0.5 rounded-full border border-primary bg-secondary ${item.alertStatusClass}`, children: item.alertStatusLabel }, void 0, false, {
                                  fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                                  lineNumber: 1211,
                                  columnNumber: 35
                                }, this),
                                /* @__PURE__ */ jsxDEV("span", { className: "text-xs px-2 py-0.5 rounded-full border border-primary bg-secondary text-secondary", children: [
                                  formatNumberBR(percentage, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
                                  "%"
                                ] }, void 0, true, {
                                  fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                                  lineNumber: 1215,
                                  columnNumber: 39
                                }, this)
                              ] }, void 0, true, {
                                fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                                lineNumber: 1209,
                                columnNumber: 37
                              }, this)
                            ] }, void 0, true, {
                              fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                              lineNumber: 1204,
                              columnNumber: 35
                            }, this),
                            /* @__PURE__ */ jsxDEV("div", { className: "w-full h-1.5 rounded-full bg-secondary mt-3", children: /* @__PURE__ */ jsxDEV("div", { className: "h-1.5 rounded-full", style: { width: `${Math.min(percentage, 100)}%`, backgroundColor: item.color } }, void 0, false, {
                              fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                              lineNumber: 1222,
                              columnNumber: 37
                            }, this) }, void 0, false, {
                              fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                              lineNumber: 1221,
                              columnNumber: 35
                            }, this),
                            /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-secondary mt-2 text-center sm:text-left truncate", children: [
                              "Total: ",
                              formatCurrency(item.value)
                            ] }, void 0, true, {
                              fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                              lineNumber: 1225,
                              columnNumber: 35
                            }, this)
                          ]
                        },
                        item.name,
                        true,
                        {
                          fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                          lineNumber: 1198,
                          columnNumber: 29
                        },
                        this
                      );
                    }) }, void 0, false, {
                      fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                      lineNumber: 1194,
                      columnNumber: 27
                    }, this)
                  ] }, void 0, true, {
                    fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                    lineNumber: 1168,
                    columnNumber: 21
                  }, this)
                ] }, void 0, true, {
                  fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                  lineNumber: 1160,
                  columnNumber: 21
                }, this) }, void 0, false, {
                  fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                  lineNumber: 1159,
                  columnNumber: 19
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                lineNumber: 1113,
                columnNumber: 17
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
              lineNumber: 1058,
              columnNumber: 13
            }, this) }, void 0, false, {
              fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
              lineNumber: 1047,
              columnNumber: 11
            }, this)
          ]
        },
        void 0,
        true,
        {
          fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
          lineNumber: 999,
          columnNumber: 9
        },
        this
      )
    ] }, void 0, true, {
      fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
      lineNumber: 995,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV(Modal, { isOpen: isQuickAddOpen, onClose: closeQuickAdd, title: quickAddTitle, children: /* @__PURE__ */ jsxDEV("form", { onSubmit: handleQuickAddSubmit, className: "w-full max-w-md mx-auto space-y-4", children: [
      /* @__PURE__ */ jsxDEV("div", { children: [
        /* @__PURE__ */ jsxDEV("label", { className: "block text-sm font-medium text-primary mb-2", children: "Tipo de lançamento" }, void 0, false, {
          fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
          lineNumber: 1244,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-3 gap-2", children: [
          /* @__PURE__ */ jsxDEV(
            Button,
            {
              type: "button",
              size: "sm",
              variant: quickAddType === "expense" ? "primary" : "outline",
              onClick: () => setQuickAddType("expense"),
              disabled: categories.length === 0,
              children: "Despesa"
            },
            void 0,
            false,
            {
              fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
              lineNumber: 1246,
              columnNumber: 15
            },
            this
          ),
          /* @__PURE__ */ jsxDEV(
            Button,
            {
              type: "button",
              size: "sm",
              variant: quickAddType === "income" ? "primary" : "outline",
              onClick: () => setQuickAddType("income"),
              disabled: incomeCategories.length === 0,
              children: "Renda"
            },
            void 0,
            false,
            {
              fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
              lineNumber: 1255,
              columnNumber: 15
            },
            this
          ),
          /* @__PURE__ */ jsxDEV(
            Button,
            {
              type: "button",
              size: "sm",
              variant: quickAddType === "investment" ? "primary" : "outline",
              onClick: () => setQuickAddType("investment"),
              children: "Invest."
            },
            void 0,
            false,
            {
              fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
              lineNumber: 1264,
              columnNumber: 15
            },
            this
          )
        ] }, void 0, true, {
          fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
          lineNumber: 1245,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
        lineNumber: 1243,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV(
        Input,
        {
          label: "Valor",
          type: "text",
          inputMode: "decimal",
          value: formData.amount,
          onChange: (event) => handleAmountChange(event.target.value),
          onBlur: () => {
            const parsed = parseMoneyInput(formData.amount);
            if (!Number.isNaN(parsed) && parsed >= 0) {
              handleAmountChange(formatMoneyInput(parsed));
            }
          },
          placeholder: "0,00",
          required: true
        },
        void 0,
        false,
        {
          fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
          lineNumber: 1274,
          columnNumber: 11
        },
        this
      ),
      quickAddType !== "investment" && /* @__PURE__ */ jsxDEV(
        Input,
        {
          label: "Valor no relatório (opcional)",
          type: "text",
          inputMode: "decimal",
          value: formData.report_amount,
          onChange: (event) => setFormData((prev) => ({ ...prev, report_amount: event.target.value })),
          onBlur: () => {
            if (!formData.report_amount) return;
            const parsed = parseMoneyInput(formData.report_amount);
            if (!Number.isNaN(parsed) && parsed >= 0) {
              setFormData((prev) => ({ ...prev, report_amount: formatMoneyInput(parsed) }));
            }
          },
          placeholder: "Se vazio, usa o valor total"
        },
        void 0,
        false,
        {
          fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
          lineNumber: 1291,
          columnNumber: 11
        },
        this
      ),
      /* @__PURE__ */ jsxDEV(
        Input,
        {
          label: "Data",
          type: "date",
          value: formData.date,
          onChange: (event) => setFormData((prev) => ({ ...prev, date: event.target.value })),
          min: APP_START_DATE,
          required: true
        },
        void 0,
        false,
        {
          fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
          lineNumber: 1308,
          columnNumber: 11
        },
        this
      ),
      quickAddType === "expense" && /* @__PURE__ */ jsxDEV(
        Input,
        {
          label: "Parcelas",
          type: "number",
          min: "1",
          max: "60",
          value: formData.installment_total,
          onChange: (event) => setFormData((prev) => ({ ...prev, installment_total: event.target.value })),
          placeholder: "1"
        },
        void 0,
        false,
        {
          fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
          lineNumber: 1318,
          columnNumber: 11
        },
        this
      ),
      quickAddType === "expense" && /* @__PURE__ */ jsxDEV(
        Select,
        {
          label: "Forma de pagamento",
          value: formData.payment_method,
          onChange: (event) => setFormData((prev) => ({
            ...prev,
            payment_method: event.target.value,
            credit_card_id: event.target.value === "credit_card" ? prev.credit_card_id : ""
          })),
          options: [
            { value: "other", label: "Outros" },
            { value: "cash", label: "Dinheiro" },
            { value: "debit", label: "Débito" },
            { value: "credit_card", label: "Cartão de crédito" },
            { value: "pix", label: "PIX" },
            { value: "transfer", label: "Transferência" }
          ]
        },
        void 0,
        false,
        {
          fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
          lineNumber: 1330,
          columnNumber: 11
        },
        this
      ),
      quickAddType === "expense" && formData.payment_method === "credit_card" && /* @__PURE__ */ jsxDEV(
        Select,
        {
          label: "Cartão",
          value: formData.credit_card_id,
          onChange: (event) => setFormData((prev) => ({ ...prev, credit_card_id: event.target.value })),
          options: [
            { value: "", label: "Selecionar cartão" },
            ...creditCards.filter((card) => card.is_active !== false || card.id === formData.credit_card_id).map((card) => ({ value: card.id, label: card.name }))
          ],
          required: true
        },
        void 0,
        false,
        {
          fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
          lineNumber: 1350,
          columnNumber: 11
        },
        this
      ),
      quickAddType === "expense" && /* @__PURE__ */ jsxDEV(
        Select,
        {
          label: "Categoria",
          value: formData.category_id,
          onChange: (event) => setFormData((prev) => ({ ...prev, category_id: event.target.value })),
          options: categories.map((category) => ({ value: category.id, label: category.name })),
          required: true
        },
        void 0,
        false,
        {
          fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
          lineNumber: 1365,
          columnNumber: 11
        },
        this
      ),
      quickAddType === "income" && /* @__PURE__ */ jsxDEV(
        Select,
        {
          label: "Categoria de renda",
          value: formData.income_category_id,
          onChange: (event) => setFormData((prev) => ({ ...prev, income_category_id: event.target.value })),
          options: incomeCategories.map((category) => ({ value: category.id, label: category.name })),
          required: true
        },
        void 0,
        false,
        {
          fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
          lineNumber: 1375,
          columnNumber: 11
        },
        this
      ),
      /* @__PURE__ */ jsxDEV(
        Input,
        {
          label: "Descrição (opcional)",
          value: formData.description,
          onChange: (event) => setFormData((prev) => ({ ...prev, description: event.target.value })),
          placeholder: "Ex: mercado, salário, reserva..."
        },
        void 0,
        false,
        {
          fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
          lineNumber: 1384,
          columnNumber: 11
        },
        this
      ),
      /* @__PURE__ */ jsxDEV(ModalActionFooter, { onCancel: closeQuickAdd, submitLabel: "Salvar" }, void 0, false, {
        fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
        lineNumber: 1391,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
      lineNumber: 1242,
      columnNumber: 9
    }, this) }, void 0, false, {
      fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
      lineNumber: 1241,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV(
      Modal,
      {
        isOpen: Boolean(selectedExpenseCategory),
        onClose: () => setSelectedExpenseCategory(null),
        title: selectedExpenseCategory ? `Detalhamento: ${selectedExpenseCategory.name}` : "Detalhamento",
        children: /* @__PURE__ */ jsxDEV("div", { className: "space-y-4", children: [
          /* @__PURE__ */ jsxDEV("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsxDEV("p", { className: "text-xs font-medium uppercase tracking-wide text-secondary", children: "Comparação mensal" }, void 0, false, {
              fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
              lineNumber: 1402,
              columnNumber: 13
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3", children: [
              /* @__PURE__ */ jsxDEV("div", { className: "rounded-lg border border-primary bg-secondary p-3", children: [
                /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-secondary", children: [
                  "Total em ",
                  formatMonth(currentMonth)
                ] }, void 0, true, {
                  fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                  lineNumber: 1405,
                  columnNumber: 17
                }, this),
                /* @__PURE__ */ jsxDEV("p", { className: "text-lg font-semibold text-primary", children: formatCurrency(selectedExpenseCategoryDetails?.currentTotal ?? 0) }, void 0, false, {
                  fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                  lineNumber: 1406,
                  columnNumber: 17
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                lineNumber: 1404,
                columnNumber: 15
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "rounded-lg border border-primary bg-secondary p-3", children: [
                /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-secondary", children: [
                  "Total em ",
                  formatMonth(previousMonth)
                ] }, void 0, true, {
                  fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                  lineNumber: 1409,
                  columnNumber: 17
                }, this),
                /* @__PURE__ */ jsxDEV("p", { className: "text-lg font-semibold text-primary", children: formatCurrency(selectedExpenseCategoryDetails?.previousTotal ?? 0) }, void 0, false, {
                  fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                  lineNumber: 1410,
                  columnNumber: 17
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                lineNumber: 1408,
                columnNumber: 15
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
              lineNumber: 1403,
              columnNumber: 13
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
            lineNumber: 1401,
            columnNumber: 11
          }, this),
          selectedExpenseCategoryLimitDetails && /* @__PURE__ */ jsxDEV("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsxDEV("p", { className: "text-xs font-medium uppercase tracking-wide text-secondary", children: "Metas do mês" }, void 0, false, {
              fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
              lineNumber: 1417,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "rounded-lg border border-primary bg-secondary p-3", children: [
              /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-primary", children: [
                "Limite: ",
                formatCurrency(selectedExpenseCategoryLimitDetails.limitAmount)
              ] }, void 0, true, {
                fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                lineNumber: 1419,
                columnNumber: 17
              }, this),
              /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-primary", children: [
                "Gasto: ",
                formatCurrency(selectedExpenseCategoryLimitDetails.currentTotal)
              ] }, void 0, true, {
                fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                lineNumber: 1420,
                columnNumber: 17
              }, this),
              /* @__PURE__ */ jsxDEV("p", { className: `text-sm font-medium ${selectedExpenseCategoryLimitDetails.isExceeded ? "text-expense" : "text-income"}`, children: selectedExpenseCategoryLimitDetails.isExceeded ? `Excesso: ${formatCurrency(selectedExpenseCategoryLimitDetails.exceededAmount)}` : `Restante: ${formatCurrency(selectedExpenseCategoryLimitDetails.remainingAmount)}` }, void 0, false, {
                fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                lineNumber: 1421,
                columnNumber: 17
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
              lineNumber: 1418,
              columnNumber: 15
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
            lineNumber: 1416,
            columnNumber: 11
          }, this),
          /* @__PURE__ */ jsxDEV("p", { className: "text-xs font-medium uppercase tracking-wide text-secondary", children: "Lançamentos do mês" }, void 0, false, {
            fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
            lineNumber: 1430,
            columnNumber: 11
          }, this),
          selectedExpenseCategoryDetails && selectedExpenseCategoryDetails.currentItems.length > 0 ? /* @__PURE__ */ jsxDEV("div", { className: "max-h-72 overflow-y-auto space-y-2 pr-1", children: selectedExpenseCategoryDetails.currentItems.map((item) => {
            const reportAmount = expenseAmountForDashboard(item.amount, item.report_weight);
            const showOriginal = Math.abs(reportAmount - item.amount) > 9e-3;
            return /* @__PURE__ */ jsxDEV("div", { className: "rounded-lg border border-primary bg-primary p-3", children: /* @__PURE__ */ jsxDEV("div", { className: "flex items-start justify-between gap-3", children: [
              /* @__PURE__ */ jsxDEV("div", { className: "min-w-0", children: [
                /* @__PURE__ */ jsxDEV("p", { className: "text-sm font-medium text-primary truncate", children: item.description || item.category?.name || "Despesa" }, void 0, false, {
                  fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                  lineNumber: 1442,
                  columnNumber: 25
                }, this),
                /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-secondary mt-0.5", children: formatDate(item.date) }, void 0, false, {
                  fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                  lineNumber: 1443,
                  columnNumber: 25
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                lineNumber: 1441,
                columnNumber: 23
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "text-right", children: [
                /* @__PURE__ */ jsxDEV("p", { className: "text-sm font-semibold text-primary", children: formatCurrency(reportAmount) }, void 0, false, {
                  fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                  lineNumber: 1446,
                  columnNumber: 25
                }, this),
                showOriginal && /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-secondary", children: [
                  "Total: ",
                  formatCurrency(item.amount)
                ] }, void 0, true, {
                  fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                  lineNumber: 1447,
                  columnNumber: 42
                }, this)
              ] }, void 0, true, {
                fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                lineNumber: 1445,
                columnNumber: 23
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
              lineNumber: 1440,
              columnNumber: 21
            }, this) }, item.id, false, {
              fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
              lineNumber: 1439,
              columnNumber: 17
            }, this);
          }) }, void 0, false, {
            fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
            lineNumber: 1433,
            columnNumber: 11
          }, this) : /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-secondary", children: "Sem lançamentos dessa categoria no mês selecionado." }, void 0, false, {
            fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
            lineNumber: 1455,
            columnNumber: 11
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
          lineNumber: 1400,
          columnNumber: 9
        }, this)
      },
      void 0,
      false,
      {
        fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
        lineNumber: 1395,
        columnNumber: 7
      },
      this
    ),
    /* @__PURE__ */ jsxDEV(
      Modal,
      {
        isOpen: isAssistantOpen,
        onClose: closeAssistant,
        title: "Assistente",
        children: /* @__PURE__ */ jsxDEV("div", { className: "space-y-4", children: [
          /* @__PURE__ */ jsxDEV("div", { className: "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1", children: [
            /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-2", children: [
              /* @__PURE__ */ jsxDEV("div", { className: `h-2 w-2 rounded-full transition-colors duration-300 ${voicePhase === "listening" ? "bg-[var(--color-success)] animate-pulse shadow-[0_0_8px_var(--color-success)]" : "bg-secondary"}` }, void 0, false, {
                fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                lineNumber: 1469,
                columnNumber: 15
              }, this),
              /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] uppercase tracking-widest text-secondary font-semibold whitespace-nowrap", children: voicePhase === "listening" ? "Assistente Ouvindo" : "Aguardando Comando" }, void 0, false, {
                fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
                lineNumber: 1470,
                columnNumber: 15
              }, this)
            ] }, void 0, true, {
              fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
              lineNumber: 1468,
              columnNumber: 13
            }, this),
            lastHeardCommand && /* @__PURE__ */ jsxDEV("span", { className: "text-[11px] italic text-secondary break-words sm:truncate sm:max-w-[250px] sm:border-l sm:border-primary/20 sm:pl-3", children: [
              '"',
              lastHeardCommand,
              '"'
            ] }, void 0, true, {
              fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
              lineNumber: 1475,
              columnNumber: 13
            }, this)
          ] }, void 0, true, {
            fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
            lineNumber: 1467,
            columnNumber: 11
          }, this),
          /* @__PURE__ */ jsxDEV(
            Button,
            {
              onClick: handleVoiceInterpret,
              disabled: assistantLoading || !isSupabaseConfigured || !voiceSupport.recognition,
              variant: "outline",
              fullWidth: true,
              children: voiceListening ? "Parar Escuta" : "Falar Comando"
            },
            void 0,
            false,
            {
              fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
              lineNumber: 1482,
              columnNumber: 11
            },
            this
          ),
          lastInterpretation?.requiresConfirmation && /* @__PURE__ */ jsxDEV(
            AssistantConfirmationPanel,
            {
              intent: lastInterpretation.intent,
              editableConfirmationText,
              onEditableConfirmationTextChange: setEditableConfirmationText,
              editableSlots,
              categories: categories.map((category) => ({ id: category.id, name: category.name })),
              incomeCategories: incomeCategories.map((category) => ({ id: category.id, name: category.name })),
              creditCards: creditCards.map((c) => ({ id: c.id, name: c.name })),
              disabled: assistantLoading || !isSupabaseConfigured,
              fallbackMonth: currentMonth,
              onUpdateSlots: updateEditableSlots,
              touchConfirmationEnabled,
              voiceConfirmationEnabled,
              actionColumnsClass,
              onConfirm: () => handleConfirmAssistant(true),
              onDeny: () => handleConfirmAssistant(false),
              onVoiceConfirm: handleVoiceConfirm,
              voiceConfirmDisabled: assistantLoading || !isSupabaseConfigured || !voiceSupport.recognition || voiceListening,
              voiceListening,
              containerClassName: "space-y-3"
            },
            void 0,
            false,
            {
              fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
              lineNumber: 1492,
              columnNumber: 11
            },
            this
          ),
          assistantError && /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-[var(--color-danger)]", children: assistantError }, void 0, false, {
            fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
            lineNumber: 1515,
            columnNumber: 30
          }, this),
          hasAssistantOfflinePending && /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-secondary", children: assistantOfflinePendingCount === 1 ? "1 comando do assistente pendente de sincronização." : `${assistantOfflinePendingCount} comandos do assistente pendentes de sincronização.` }, void 0, false, {
            fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
            lineNumber: 1517,
            columnNumber: 11
          }, this)
        ] }, void 0, true, {
          fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
          lineNumber: 1465,
          columnNumber: 9
        }, this)
      },
      void 0,
      false,
      {
        fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
        lineNumber: 1460,
        columnNumber: 7
      },
      this
    )
  ] }, void 0, true, {
    fileName: "C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx",
    lineNumber: 942,
    columnNumber: 5
  }, this);
}
_s(Dashboard, "7SjDWn85HFPQxkkkQOmKBA4txhg=", false, function() {
  return [useAppSettings, useAssistantTurn, useAssistantOfflineQueueStatus, useNetworkStatus, useVoiceAdapter, usePaletteColors, useCategories, useIncomeCategories, useCreditCards, useExpenses, useExpenses, useIncomes, useInvestments, useExpenseCategoryLimits, useExpenseCategoryLimits];
});
_c = Dashboard;
var _c;
$RefreshReg$(_c, "Dashboard");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("C:/Users/gabri/OneDrive/Documentos/Finanças/minhas_financas/src/pages/Dashboard.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}

//# sourceMappingURL=data:application/json;base64,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QUFBLFVBSWpDekIsa0JBQWtCLHVCQUFDLE9BQUUsV0FBVSxzQ0FBc0NBLDRCQUFuRDtBQUFBO0FBQUE7QUFBQTtBQUFBLGlCQUFrRTtBQUFBLFVBQ3BGZSw4QkFDQyx1QkFBQyxPQUFFLFdBQVUsMEJBQ1ZGLDJDQUFpQyxJQUM5Qix1REFDQSxHQUFHQSw0QkFBNEIseURBSHJDO0FBQUE7QUFBQTtBQUFBO0FBQUEsaUJBSUE7QUFBQSxhQXhESjtBQUFBO0FBQUE7QUFBQTtBQUFBLGVBMERBO0FBQUE7QUFBQSxNQS9ERjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFnRUE7QUFBQSxPQXRrQkY7QUFBQTtBQUFBO0FBQUE7QUFBQSxTQXVrQkE7QUFFSjtBQUFDekIsR0FuN0N1QkQsV0FBUztBQUFBLFVBYTNCbkIsZ0JBYUFGLGtCQUsyRkMsZ0NBSzFFRSxrQkFZakJDLGlCQXNEcUIzQixrQkFDRkosZUFDTUMscUJBQ0xDLGdCQUN1REwsYUFFbkNBLGFBQytCQyxZQUNnQkMsZ0JBQ2RJLDBCQUNTQSx3QkFBd0I7QUFBQTtBQUFBLEtBaEh4RjZDO0FBQVMsSUFBQWlXO0FBQUEsYUFBQUEsSUFBQSIsIm5hbWVzIjpbInVzZUVmZmVjdCIsInVzZU1lbW8iLCJ1c2VTdGF0ZSIsInVzZVJlZiIsImZvcm1hdCIsIlBhZ2VIZWFkZXIiLCJDYXJkIiwiTW9udGhTZWxlY3RvciIsIlBBR0VfSEVBREVSUyIsInVzZUV4cGVuc2VzIiwidXNlSW5jb21lcyIsInVzZUludmVzdG1lbnRzIiwidXNlQ2F0ZWdvcmllcyIsInVzZUluY29tZUNhdGVnb3JpZXMiLCJ1c2VDcmVkaXRDYXJkcyIsInVzZUV4cGVuc2VDYXRlZ29yeUxpbWl0cyIsInVzZVBhbGV0dGVDb2xvcnMiLCJnZXRDYXRlZ29yeUNvbG9yRm9yUGFsZXR0ZSIsIkFQUF9TVEFSVF9EQVRFIiwiYWRkTW9udGhzIiwiZm9ybWF0Q3VycmVuY3kiLCJmb3JtYXREYXRlIiwiZm9ybWF0TW9uZXlJbnB1dCIsImZvcm1hdE1vbnRoIiwiZm9ybWF0TnVtYmVyQlIiLCJnZXRDdXJyZW50TW9udGhTdHJpbmciLCJwYXJzZU1vbmV5SW5wdXQiLCJUcmVuZGluZ1VwIiwiVHJlbmRpbmdEb3duIiwiUGlnZ3lCYW5rIiwiUGx1cyIsIlNwYXJrbGVzIiwiUmVmcmVzaEN3IiwiQnV0dG9uIiwiTW9kYWwiLCJNb2RhbEFjdGlvbkZvb3RlciIsIklucHV0IiwiU2VsZWN0IiwiQXNzaXN0YW50Q29uZmlybWF0aW9uUGFuZWwiLCJ1c2VBc3Npc3RhbnRUdXJuIiwidXNlQXNzaXN0YW50T2ZmbGluZVF1ZXVlU3RhdHVzIiwidXNlQXBwU2V0dGluZ3MiLCJ1c2VOZXR3b3JrU3RhdHVzIiwidXNlVm9pY2VBZGFwdGVyIiwiaXNTdXBhYmFzZUNvbmZpZ3VyZWQiLCJnZXRBc3Npc3RhbnRNb250aGx5SW5zaWdodHMiLCJCYXIiLCJCYXJDaGFydCIsIkNhcnRlc2lhbkdyaWQiLCJDZWxsIiwiTGVnZW5kIiwiTGluZSIsIkxpbmVDaGFydCIsIlBpZSIsIlBpZUNoYXJ0IiwiUmVzcG9uc2l2ZUNvbnRhaW5lciIsIlRvb2x0aXAiLCJYQXhpcyIsIllBeGlzIiwiRVhQRU5TRV9MSU1JVF9XQVJOSU5HX1RIUkVTSE9MRCIsIkRhc2hib2FyZCIsIl9zIiwibW9udGhseUluc2lnaHRzRW5hYmxlZCIsImFzc2lzdGFudENvbmZpcm1hdGlvbk1vZGUiLCJhc3Npc3RhbnRDb25maXJtYXRpb25Qb2xpY3lNb2RlIiwiYXNzaXN0YW50TG9jYWxlIiwiYXNzaXN0YW50T2ZmbGluZUJlaGF2aW9yIiwiYXNzaXN0YW50UmVzcG9uc2VEZXB0aCIsImFzc2lzdGFudEF1dG9TcGVhayIsImFzc2lzdGFudFNwZWVjaFJhdGUiLCJhc3Npc3RhbnRTcGVlY2hQaXRjaCIsImFzc2lzdGFudERvdWJsZUNvbmZpcm1hdGlvbkVuYWJsZWQiLCJhc3Npc3RhbnRMb2FkaW5nIiwiYXNzaXN0YW50RXJyb3IiLCJsYXN0SW50ZXJwcmV0YXRpb24iLCJlZGl0YWJsZUNvbmZpcm1hdGlvblRleHQiLCJzZXRFZGl0YWJsZUNvbmZpcm1hdGlvblRleHQiLCJlZGl0YWJsZVNsb3RzIiwidXBkYXRlRWRpdGFibGVTbG90cyIsImludGVycHJldENvbW1hbmQiLCJjb25maXJtTGFzdEludGVycHJldGF0aW9uIiwicmVzZXRBc3Npc3RhbnRUdXJuIiwibG9jYWxlIiwib2ZmbGluZUJlaGF2aW9yIiwicmVzcG9uc2VEZXB0aCIsInBlbmRpbmdDb3VudCIsImFzc2lzdGFudE9mZmxpbmVQZW5kaW5nQ291bnQiLCJoYXNQZW5kaW5nIiwiaGFzQXNzaXN0YW50T2ZmbGluZVBlbmRpbmciLCJjdXJyZW50TW9udGgiLCJzZXRDdXJyZW50TW9udGgiLCJpc1F1aWNrQWRkT3BlbiIsInNldElzUXVpY2tBZGRPcGVuIiwiaXNBc3Npc3RhbnRPcGVuIiwic2V0SXNBc3Npc3RhbnRPcGVuIiwiaXNPbmxpbmUiLCJ2b2ljZVN1cHBvcnQiLCJzZXRWb2ljZVN0YXR1cyIsInZvaWNlTGlzdGVuaW5nIiwidm9pY2VQaGFzZSIsImxhc3RIZWFyZENvbW1hbmQiLCJjbGVhclZvaWNlRmVlZGJhY2siLCJjYXB0dXJlU3BlZWNoIiwic3RvcEFjdGl2ZUxpc3RlbmluZyIsInJlc29sdmVWb2ljZUNvbmZpcm1hdGlvbiIsInN0b3BTcGVha2luZyIsIm5ldHdvcmtFcnJvck1lc3NhZ2UiLCJhdXRvU3BlYWtFbmFibGVkIiwic3BlZWNoUmF0ZSIsInNwZWVjaFBpdGNoIiwicXVpY2tBZGRUeXBlIiwic2V0UXVpY2tBZGRUeXBlIiwiaGlkZGVuRGFpbHlGbG93U2VyaWVzIiwic2V0SGlkZGVuRGFpbHlGbG93U2VyaWVzIiwic2VsZWN0ZWRFeHBlbnNlQ2F0ZWdvcnkiLCJzZXRTZWxlY3RlZEV4cGVuc2VDYXRlZ29yeSIsImZvcm1EYXRhIiwic2V0Rm9ybURhdGEiLCJhbW91bnQiLCJyZXBvcnRfYW1vdW50IiwiZGF0ZSIsIkRhdGUiLCJpbnN0YWxsbWVudF90b3RhbCIsInBheW1lbnRfbWV0aG9kIiwiY3JlZGl0X2NhcmRfaWQiLCJtb250aCIsImNhdGVnb3J5X2lkIiwiaW5jb21lX2NhdGVnb3J5X2lkIiwiZGVzY3JpcHRpb24iLCJtb250aGx5SW5zaWdodHMiLCJzZXRNb250aGx5SW5zaWdodHMiLCJpbnNpZ2h0c0xvYWRpbmciLCJzZXRJbnNpZ2h0c0xvYWRpbmciLCJsYXN0RmV0Y2hlZE1vbnRoUmVmIiwiaXNNb250aFRyYW5zaXRpb25pbmciLCJzZXRJc01vbnRoVHJhbnNpdGlvbmluZyIsImlzTW9iaWxlVmlld3BvcnQiLCJzZXRJc01vYmlsZVZpZXdwb3J0IiwiZm9ybWF0QXhpc0N1cnJlbmN5VGljayIsInZhbHVlIiwibWF4aW11bUZyYWN0aW9uRGlnaXRzIiwiaGFuZGxlQW1vdW50Q2hhbmdlIiwibmV4dEFtb3VudCIsInByZXYiLCJwcmV2QW1vdW50IiwicHJldlJlcG9ydEFtb3VudCIsInNob3VsZFN5bmNSZXBvcnRBbW91bnQiLCJOdW1iZXIiLCJpc05hTiIsIk1hdGgiLCJhYnMiLCJjb2xvclBhbGV0dGUiLCJjYXRlZ29yaWVzIiwiaW5jb21lQ2F0ZWdvcmllcyIsImNyZWRpdENhcmRzIiwiZXhwZW5zZXMiLCJsb2FkaW5nIiwiZXhwZW5zZXNMb2FkaW5nIiwicmVmcmVzaEV4cGVuc2VzIiwiY3JlYXRlRXhwZW5zZSIsInByZXZpb3VzTW9udGgiLCJwcmV2aW91c01vbnRoRXhwZW5zZXMiLCJpbmNvbWVzIiwiaW5jb21lc0xvYWRpbmciLCJyZWZyZXNoSW5jb21lcyIsImNyZWF0ZUluY29tZSIsImludmVzdG1lbnRzIiwiaW52ZXN0bWVudHNMb2FkaW5nIiwicmVmcmVzaEludmVzdG1lbnRzIiwiY3JlYXRlSW52ZXN0bWVudCIsImxpbWl0cyIsImN1cnJlbnRNb250aEV4cGVuc2VMaW1pdHMiLCJleHBlbnNlTGltaXRzTG9hZGluZyIsInByZXZpb3VzTW9udGhFeHBlbnNlTGltaXRzIiwicHJldmlvdXNFeHBlbnNlTGltaXRzTG9hZGluZyIsImV4cGVuc2VBbW91bnRGb3JEYXNoYm9hcmQiLCJyZXBvcnRXZWlnaHQiLCJpbmNvbWVBbW91bnRGb3JEYXNoYm9hcmQiLCJ0b3RhbEV4cGVuc2VzIiwicmVkdWNlIiwic3VtIiwiZXhwIiwicmVwb3J0X3dlaWdodCIsInRvdGFsSW5jb21lcyIsImluYyIsInRvdGFsSW52ZXN0bWVudHMiLCJpbnYiLCJiYWxhbmNlIiwiaGFzTW9udGhseURhdGEiLCJsZW5ndGgiLCJtb250aGx5T3ZlcnZpZXdEYXRhIiwibmFtZSIsImNvbG9yIiwiZXhwZW5zZUJ5Q2F0ZWdvcnkiLCJtYXAiLCJNYXAiLCJmb3JFYWNoIiwiZXhwZW5zZSIsImNhdGVnb3J5IiwiY2F0ZWdvcnlJZCIsImlkIiwia2V5IiwiY3VycmVudCIsImdldCIsInNldCIsIkFycmF5IiwiZnJvbSIsInZhbHVlcyIsInNvcnQiLCJhIiwiYiIsImN1cnJlbnRNb250aEV4cGVuc2VMaW1pdE1hcCIsIml0ZW0iLCJsaW1pdF9hbW91bnQiLCJwcmV2aW91c01vbnRoRXhwZW5zZUxpbWl0TWFwIiwiZXhwZW5zZUxpbWl0TWFwIiwiY3VycmVudFZhbHVlIiwidW5kZWZpbmVkIiwicHJldmlvdXNWYWx1ZSIsImV4cGVuc2VMaW1pdEFsZXJ0cyIsImxpbWl0QW1vdW50IiwiaGFzTGltaXQiLCJleGNlZWRlZEFtb3VudCIsImV4Y2VlZGVkUGVyY2VudGFnZSIsInVzYWdlUGVyY2VudGFnZSIsImZpbHRlciIsIkJvb2xlYW4iLCJleHBlbnNlQ2F0ZWdvcmllc1BpZURhdGEiLCJ0b3AiLCJzbGljZSIsIm90aGVyc1ZhbHVlIiwiZXhwZW5zZUF0dGVudGlvbkNhdGVnb3JpZXMiLCJpc05lYXJMaW1pdCIsImxldmVsIiwicmVtYWluaW5nQW1vdW50Iiwid2luZG93IiwibWVkaWFRdWVyeSIsIm1hdGNoTWVkaWEiLCJ1cGRhdGVWaWV3cG9ydCIsIm1hdGNoZXMiLCJhZGRFdmVudExpc3RlbmVyIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsImluc2lnaHRUb2FzdEVycm9yIiwic2V0SW5zaWdodFRvYXN0RXJyb3IiLCJoYW5kbGVSZWZyZXNoSW5zaWdodHMiLCJyZXN1bHQiLCJtZXJnZWRJbnNpZ2h0cyIsImhpZ2hsaWdodHMiLCJyZWNvbW1lbmRhdGlvbnMiLCJ0cmltIiwiZXJyb3IiLCJFcnJvciIsIm1lc3NhZ2UiLCJpc0NhbmNlbGxlZCIsImZhZGVUaW1lciIsInNldFRpbWVvdXQiLCJjbGVhclRpbWVvdXQiLCJsb2FkSW5zaWdodHMiLCJuYXZpZ2F0b3IiLCJvbkxpbmUiLCJ0aW1lb3V0SWQiLCJwcmlvcml0aXplZEV4cGVuc2VDYXRlZ29yeUl0ZW1zIiwiZXhjZWVkZWQiLCJmaW5kIiwiYWxlcnQiLCJhbGVydFByaW9yaXR5IiwiYWxlcnRTdGF0dXNMYWJlbCIsImFsZXJ0U3RhdHVzQ2xhc3MiLCJuZWFyTGltaXQiLCJkYWlseUZsb3dEYXRhIiwieWVhciIsInNwbGl0IiwiZGF5c0luTW9udGgiLCJnZXREYXRlIiwic2VyaWVzIiwiXyIsImluZGV4IiwiZGF5IiwiU3RyaW5nIiwicGFkU3RhcnQiLCJSZW5kYXMiLCJEZXNwZXNhcyIsIkludmVzdGltZW50b3MiLCJpbmNvbWUiLCJpbnZlc3RtZW50IiwiaW52ZXN0bWVudERheSIsImNoYXJ0VG9vbHRpcCIsImFjdGl2ZSIsInBheWxvYWQiLCJsYWJlbCIsImlzRGF5TGFiZWwiLCJ0ZXN0IiwiZW50cnkiLCJvcGVuRXhwZW5zZUNhdGVnb3J5RGV0YWlscyIsImNhdGVnb3J5TmFtZSIsInNlbGVjdGVkRXhwZW5zZUNhdGVnb3J5RGV0YWlscyIsImN1cnJlbnRJdGVtcyIsInByZXZpb3VzSXRlbXMiLCJjdXJyZW50VG90YWwiLCJwcmV2aW91c1RvdGFsIiwic2VsZWN0ZWRFeHBlbnNlQ2F0ZWdvcnlMaW1pdERldGFpbHMiLCJyYXdMaW1pdCIsIm1heCIsImlzRXhjZWVkZWQiLCJ0b2dnbGVEYWlseUZsb3dTZXJpZXMiLCJkYXRhS2V5IiwiaW5jbHVkZXMiLCJyZW5kZXJJbnRlcmFjdGl2ZUxlZ2VuZCIsImlzSGlkZGVuIiwiYmFja2dyb3VuZENvbG9yIiwiaW50ZXJhY3RpdmVSb3dCdXR0b25DbGFzc2VzIiwiaW5zaWdodE5hcnJhdGl2ZU1vbWVudCIsIm5vdyIsImN1cnJlbnRNb250aEtleSIsImlzQ2xvc2VkTW9udGgiLCJpc0ZpbmFsaXplZCIsImlzTGFzdERheSIsIm1vbnRobHlJbnNpZ2h0c05hcnJhdGl2ZSIsIm5vcm1hbGl6ZWQiLCJyZXBsYWNlIiwic2luZ2xlIiwid2l0aG91dFRyYWlsaW5nRG90IiwiZmlyc3RTZW50ZW5jZSIsInRvQ2xhdXNlQWZ0ZXJDb25uZWN0b3IiLCJ0ZXh0IiwiZmlyc3RDaGFyIiwicmVzdENoYXJzIiwicmVzdCIsImpvaW4iLCJ0b0xvd2VyQ2FzZSIsInNpbXBsaWZ5Rm9yTW9iaWxlIiwiY29tcGFjdCIsImZpcnN0Q2xhdXNlIiwiZmlyc3RNb2JpbGVTZW50ZW5jZSIsInNlY29uZE1vYmlsZVNlbnRlbmNlIiwic2hvdWxkU2hvd01vbnRobHlJbnNpZ2h0c0NhcmQiLCJvcGVuUXVpY2tBZGQiLCJ0eXBlIiwiY2xvc2VRdWlja0FkZCIsInF1aWNrQWRkVGl0bGUiLCJwbGF5QXNzaXN0YW50QmVlcCIsIkF1ZGlvQ29udGV4dEN0b3IiLCJBdWRpb0NvbnRleHQiLCJ3ZWJraXRBdWRpb0NvbnRleHQiLCJjb250ZXh0Iiwib3NjaWxsYXRvciIsImNyZWF0ZU9zY2lsbGF0b3IiLCJnYWluIiwiY3JlYXRlR2FpbiIsInRvbmVNYXAiLCJzdGFydCIsImVuZCIsImhlYXJkIiwiZXhlY3V0ZWQiLCJzdGFydEZyZXF1ZW5jeSIsImVuZEZyZXF1ZW5jeSIsImZyZXF1ZW5jeSIsInNldFZhbHVlQXRUaW1lIiwiY3VycmVudFRpbWUiLCJleHBvbmVudGlhbFJhbXBUb1ZhbHVlQXRUaW1lIiwiY29ubmVjdCIsImRlc3RpbmF0aW9uIiwic3RvcCIsIm9uZW5kZWQiLCJjbG9zZSIsImNhdGNoIiwib3BlbkFzc2lzdGFudCIsImhhbmRsZVZvaWNlSW50ZXJwcmV0IiwiY2xvc2VBc3Npc3RhbnQiLCJpc0V4cGVuc2VJbnRlbnQiLCJpbnRlbnQiLCJ0b3VjaENvbmZpcm1hdGlvbkVuYWJsZWQiLCJ2b2ljZUNvbmZpcm1hdGlvbkVuYWJsZWQiLCJhY3Rpb25Db2x1bW5zQ2xhc3MiLCJoYW5kbGVDb25maXJtQXNzaXN0YW50IiwiY29uZmlybWVkIiwic3RhdHVzIiwiY29uc29sZSIsInRyYW5zY3JpcHQiLCJjb25maXJtYXRpb25Nb2RlIiwiZm9yY2VDb25maXJtYXRpb24iLCJyZXF1aXJlc0NvbmZpcm1hdGlvbiIsImhhbmRsZVZvaWNlQ29uZmlybSIsImNvbW1hbmQiLCJzcG9rZW5UZXh0IiwiaW5jbHVkZUVkaXRhYmxlIiwiaGFuZGxlUXVpY2tBZGRTdWJtaXQiLCJldmVudCIsInByZXZlbnREZWZhdWx0IiwicmVwb3J0QW1vdW50IiwidG9GaXhlZCIsInJhd0luc3RhbGxtZW50cyIsImluc3RhbGxtZW50VG90YWwiLCJtaW4iLCJpc0ludGVnZXIiLCJzZWxlY3RlZERhdGUiLCJzdWJzdHJpbmciLCJkYXNoYm9hcmQiLCJ0aXRsZSIsIm9wYWNpdHkiLCJ0cmFuc2l0aW9uIiwid2lsbENoYW5nZSIsImZpbGwiLCJwZXJjZW50YWdlIiwibWluaW11bUZyYWN0aW9uRGlnaXRzIiwid2lkdGgiLCJ0YXJnZXQiLCJwYXJzZWQiLCJjYXJkIiwiaXNfYWN0aXZlIiwic2hvd09yaWdpbmFsIiwicmVjb2duaXRpb24iLCJjIiwiX2MiXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZXMiOlsiRGFzaGJvYXJkLnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgUmVhY3QsIHsgdXNlRWZmZWN0LCB1c2VNZW1vLCB1c2VTdGF0ZSwgdXNlUmVmIH0gZnJvbSAncmVhY3QnXHJcbmltcG9ydCB7IGZvcm1hdCB9IGZyb20gJ2RhdGUtZm5zJ1xyXG5pbXBvcnQgUGFnZUhlYWRlciBmcm9tICdAL2NvbXBvbmVudHMvUGFnZUhlYWRlcidcclxuaW1wb3J0IENhcmQgZnJvbSAnQC9jb21wb25lbnRzL0NhcmQnXHJcbmltcG9ydCBNb250aFNlbGVjdG9yIGZyb20gJ0AvY29tcG9uZW50cy9Nb250aFNlbGVjdG9yJ1xyXG5pbXBvcnQgeyBQQUdFX0hFQURFUlMgfSBmcm9tICdAL2NvbnN0YW50cy9wYWdlcydcclxuaW1wb3J0IHsgdXNlRXhwZW5zZXMgfSBmcm9tICdAL2hvb2tzL3VzZUV4cGVuc2VzJ1xyXG5pbXBvcnQgeyB1c2VJbmNvbWVzIH0gZnJvbSAnQC9ob29rcy91c2VJbmNvbWVzJ1xyXG5pbXBvcnQgeyB1c2VJbnZlc3RtZW50cyB9IGZyb20gJ0AvaG9va3MvdXNlSW52ZXN0bWVudHMnXHJcbmltcG9ydCB7IHVzZUNhdGVnb3JpZXMgfSBmcm9tICdAL2hvb2tzL3VzZUNhdGVnb3JpZXMnXHJcbmltcG9ydCB7IHVzZUluY29tZUNhdGVnb3JpZXMgfSBmcm9tICdAL2hvb2tzL3VzZUluY29tZUNhdGVnb3JpZXMnXHJcbmltcG9ydCB7IHVzZUNyZWRpdENhcmRzIH0gZnJvbSAnQC9ob29rcy91c2VDcmVkaXRDYXJkcydcclxuaW1wb3J0IHsgdXNlRXhwZW5zZUNhdGVnb3J5TGltaXRzIH0gZnJvbSAnQC9ob29rcy91c2VFeHBlbnNlQ2F0ZWdvcnlMaW1pdHMnXHJcbmltcG9ydCB7IHVzZVBhbGV0dGVDb2xvcnMgfSBmcm9tICdAL2hvb2tzL3VzZVBhbGV0dGVDb2xvcnMnXHJcbmltcG9ydCB7IGdldENhdGVnb3J5Q29sb3JGb3JQYWxldHRlIH0gZnJvbSAnQC91dGlscy9jYXRlZ29yeUNvbG9ycydcclxuaW1wb3J0IHsgQVBQX1NUQVJUX0RBVEUsIGFkZE1vbnRocywgZm9ybWF0Q3VycmVuY3ksIGZvcm1hdERhdGUsIGZvcm1hdE1vbmV5SW5wdXQsIGZvcm1hdE1vbnRoLCBmb3JtYXROdW1iZXJCUiwgZ2V0Q3VycmVudE1vbnRoU3RyaW5nLCBwYXJzZU1vbmV5SW5wdXQgfSBmcm9tICdAL3V0aWxzL2Zvcm1hdCdcclxuaW1wb3J0IHsgVHJlbmRpbmdVcCwgVHJlbmRpbmdEb3duLCBQaWdneUJhbmssIFBsdXMsIFNwYXJrbGVzLCBSZWZyZXNoQ3cgfSBmcm9tICdsdWNpZGUtcmVhY3QnXHJcbmltcG9ydCBCdXR0b24gZnJvbSAnQC9jb21wb25lbnRzL0J1dHRvbidcclxuaW1wb3J0IE1vZGFsIGZyb20gJ0AvY29tcG9uZW50cy9Nb2RhbCdcclxuaW1wb3J0IE1vZGFsQWN0aW9uRm9vdGVyIGZyb20gJ0AvY29tcG9uZW50cy9Nb2RhbEFjdGlvbkZvb3RlcidcclxuaW1wb3J0IElucHV0IGZyb20gJ0AvY29tcG9uZW50cy9JbnB1dCdcclxuaW1wb3J0IFNlbGVjdCBmcm9tICdAL2NvbXBvbmVudHMvU2VsZWN0J1xyXG5pbXBvcnQgQXNzaXN0YW50Q29uZmlybWF0aW9uUGFuZWwgZnJvbSAnQC9jb21wb25lbnRzL0Fzc2lzdGFudENvbmZpcm1hdGlvblBhbmVsJ1xyXG5pbXBvcnQgeyB1c2VBc3Npc3RhbnRUdXJuIH0gZnJvbSAnQC9ob29rcy91c2VBc3Npc3RhbnRUdXJuJ1xyXG5pbXBvcnQgeyB1c2VBc3Npc3RhbnRPZmZsaW5lUXVldWVTdGF0dXMgfSBmcm9tICdAL2hvb2tzL3VzZUFzc2lzdGFudE9mZmxpbmVRdWV1ZVN0YXR1cydcclxuaW1wb3J0IHsgdXNlQXBwU2V0dGluZ3MgfSBmcm9tICdAL2hvb2tzL3VzZUFwcFNldHRpbmdzJ1xyXG5pbXBvcnQgeyB1c2VOZXR3b3JrU3RhdHVzIH0gZnJvbSAnQC9ob29rcy91c2VOZXR3b3JrU3RhdHVzJ1xyXG5pbXBvcnQgeyB1c2VWb2ljZUFkYXB0ZXIgfSBmcm9tICdAL2hvb2tzL3VzZVZvaWNlQWRhcHRlcidcclxuaW1wb3J0IHsgaXNTdXBhYmFzZUNvbmZpZ3VyZWQgfSBmcm9tICdAL2xpYi9zdXBhYmFzZSdcclxuaW1wb3J0IHsgZ2V0QXNzaXN0YW50TW9udGhseUluc2lnaHRzIH0gZnJvbSAnQC9zZXJ2aWNlcy9hc3Npc3RhbnRTZXJ2aWNlJ1xyXG5pbXBvcnQge1xyXG4gIEJhcixcclxuICBCYXJDaGFydCxcclxuICBDYXJ0ZXNpYW5HcmlkLFxyXG4gIENlbGwsXHJcbiAgTGVnZW5kLFxyXG4gIExpbmUsXHJcbiAgTGluZUNoYXJ0LFxyXG4gIFBpZSxcclxuICBQaWVDaGFydCxcclxuICBSZXNwb25zaXZlQ29udGFpbmVyLFxyXG4gIFRvb2x0aXAsXHJcbiAgWEF4aXMsXHJcbiAgWUF4aXMsXHJcbn0gZnJvbSAncmVjaGFydHMnXHJcblxyXG5jb25zdCBFWFBFTlNFX0xJTUlUX1dBUk5JTkdfVEhSRVNIT0xEID0gODU7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBEYXNoYm9hcmQoKSB7XHJcbiAgLy8gR292ZXJuYW7Dp2E6IHRva2Vucy9jb250ZXh0b1xyXG4gIGNvbnN0IHtcclxuICAgIG1vbnRobHlJbnNpZ2h0c0VuYWJsZWQsXHJcbiAgICBhc3Npc3RhbnRDb25maXJtYXRpb25Nb2RlLFxyXG4gICAgYXNzaXN0YW50Q29uZmlybWF0aW9uUG9saWN5TW9kZSxcclxuICAgIGFzc2lzdGFudExvY2FsZSxcclxuICAgIGFzc2lzdGFudE9mZmxpbmVCZWhhdmlvcixcclxuICAgIGFzc2lzdGFudFJlc3BvbnNlRGVwdGgsXHJcbiAgICBhc3Npc3RhbnRBdXRvU3BlYWssXHJcbiAgICBhc3Npc3RhbnRTcGVlY2hSYXRlLFxyXG4gICAgYXNzaXN0YW50U3BlZWNoUGl0Y2gsXHJcbiAgICBhc3Npc3RhbnREb3VibGVDb25maXJtYXRpb25FbmFibGVkLFxyXG4gIH0gPSB1c2VBcHBTZXR0aW5ncygpO1xyXG5cclxuICBjb25zdCB7XHJcbiAgICBhc3Npc3RhbnRMb2FkaW5nLFxyXG4gICAgYXNzaXN0YW50RXJyb3IsXHJcbiAgICBsYXN0SW50ZXJwcmV0YXRpb24sXHJcbiAgICBlZGl0YWJsZUNvbmZpcm1hdGlvblRleHQsXHJcbiAgICBzZXRFZGl0YWJsZUNvbmZpcm1hdGlvblRleHQsXHJcbiAgICBlZGl0YWJsZVNsb3RzLFxyXG4gICAgdXBkYXRlRWRpdGFibGVTbG90cyxcclxuICAgIGludGVycHJldENvbW1hbmQsXHJcbiAgICBjb25maXJtTGFzdEludGVycHJldGF0aW9uLFxyXG4gICAgcmVzZXRBc3Npc3RhbnRUdXJuLFxyXG4gIH0gPSB1c2VBc3Npc3RhbnRUdXJuKCd3ZWItZGFzaGJvYXJkLWRldmljZScsIHtcclxuICAgIGxvY2FsZTogYXNzaXN0YW50TG9jYWxlLFxyXG4gICAgb2ZmbGluZUJlaGF2aW9yOiBhc3Npc3RhbnRPZmZsaW5lQmVoYXZpb3IsXHJcbiAgICByZXNwb25zZURlcHRoOiBhc3Npc3RhbnRSZXNwb25zZURlcHRoLFxyXG4gIH0pXHJcbiAgY29uc3QgeyBwZW5kaW5nQ291bnQ6IGFzc2lzdGFudE9mZmxpbmVQZW5kaW5nQ291bnQsIGhhc1BlbmRpbmc6IGhhc0Fzc2lzdGFudE9mZmxpbmVQZW5kaW5nIH0gPSB1c2VBc3Npc3RhbnRPZmZsaW5lUXVldWVTdGF0dXMoKVxyXG5cclxuICBjb25zdCBbY3VycmVudE1vbnRoLCBzZXRDdXJyZW50TW9udGhdID0gdXNlU3RhdGUoZ2V0Q3VycmVudE1vbnRoU3RyaW5nKVxyXG4gIGNvbnN0IFtpc1F1aWNrQWRkT3Blbiwgc2V0SXNRdWlja0FkZE9wZW5dID0gdXNlU3RhdGUoZmFsc2UpXHJcbiAgY29uc3QgW2lzQXNzaXN0YW50T3Blbiwgc2V0SXNBc3Npc3RhbnRPcGVuXSA9IHVzZVN0YXRlKGZhbHNlKVxyXG4gIGNvbnN0IHsgaXNPbmxpbmUgfSA9IHVzZU5ldHdvcmtTdGF0dXMoKVxyXG4gIGNvbnN0IHtcclxuICAgIHZvaWNlU3VwcG9ydCxcclxuICAgIHNldFZvaWNlU3RhdHVzLFxyXG4gICAgdm9pY2VMaXN0ZW5pbmcsXHJcbiAgICB2b2ljZVBoYXNlLFxyXG4gICAgbGFzdEhlYXJkQ29tbWFuZCxcclxuICAgIGNsZWFyVm9pY2VGZWVkYmFjayxcclxuICAgIGNhcHR1cmVTcGVlY2gsXHJcbiAgICBzdG9wQWN0aXZlTGlzdGVuaW5nLFxyXG4gICAgcmVzb2x2ZVZvaWNlQ29uZmlybWF0aW9uLFxyXG4gICAgc3RvcFNwZWFraW5nLFxyXG4gIH0gPSB1c2VWb2ljZUFkYXB0ZXIoe1xyXG4gICAgbG9jYWxlOiBhc3Npc3RhbnRMb2NhbGUsXHJcbiAgICBuZXR3b3JrRXJyb3JNZXNzYWdlOiAnRmFsaGEgZGUgcmVkZSBubyByZWNvbmhlY2ltZW50byBkZSB2b3ouIFVzZSBvIGNvbWFuZG8gZW0gdGV4dG8gZSB0b3F1ZSBlbSBJbnRlcnByZXRhci4nLFxyXG4gICAgYXV0b1NwZWFrRW5hYmxlZDogYXNzaXN0YW50QXV0b1NwZWFrLFxyXG4gICAgc3BlZWNoUmF0ZTogYXNzaXN0YW50U3BlZWNoUmF0ZSxcclxuICAgIHNwZWVjaFBpdGNoOiBhc3Npc3RhbnRTcGVlY2hQaXRjaCxcclxuICB9KVxyXG4gIGNvbnN0IFtxdWlja0FkZFR5cGUsIHNldFF1aWNrQWRkVHlwZV0gPSB1c2VTdGF0ZTxRdWlja0FkZFR5cGU+KCdleHBlbnNlJylcclxuICB0eXBlIFF1aWNrQWRkVHlwZSA9ICdleHBlbnNlJyB8ICdpbmNvbWUnIHwgJ2ludmVzdG1lbnQnO1xyXG4gIGNvbnN0IFtoaWRkZW5EYWlseUZsb3dTZXJpZXMsIHNldEhpZGRlbkRhaWx5Rmxvd1Nlcmllc10gPSB1c2VTdGF0ZTxzdHJpbmdbXT4oW10pXHJcbiAgY29uc3QgW3NlbGVjdGVkRXhwZW5zZUNhdGVnb3J5LCBzZXRTZWxlY3RlZEV4cGVuc2VDYXRlZ29yeV0gPSB1c2VTdGF0ZTx7IGlkOiBzdHJpbmc7IG5hbWU6IHN0cmluZyB9IHwgbnVsbD4obnVsbClcclxuICBjb25zdCBbZm9ybURhdGEsIHNldEZvcm1EYXRhXSA9IHVzZVN0YXRlKHtcclxuICAgIGFtb3VudDogJycsXHJcbiAgICByZXBvcnRfYW1vdW50OiAnJyxcclxuICAgIGRhdGU6IGZvcm1hdChuZXcgRGF0ZSgpLCAneXl5eS1NTS1kZCcpLFxyXG4gICAgaW5zdGFsbG1lbnRfdG90YWw6ICcxJyxcclxuICAgIHBheW1lbnRfbWV0aG9kOiAnb3RoZXInLFxyXG4gICAgY3JlZGl0X2NhcmRfaWQ6ICcnLFxyXG4gICAgbW9udGg6IGdldEN1cnJlbnRNb250aFN0cmluZygpLFxyXG4gICAgY2F0ZWdvcnlfaWQ6ICcnLFxyXG4gICAgaW5jb21lX2NhdGVnb3J5X2lkOiAnJyxcclxuICAgIGRlc2NyaXB0aW9uOiAnJyxcclxuICB9KVxyXG4gIGNvbnN0IFttb250aGx5SW5zaWdodHMsIHNldE1vbnRobHlJbnNpZ2h0c10gPSB1c2VTdGF0ZTxzdHJpbmdbXT4oW10pXHJcbiAgY29uc3QgW2luc2lnaHRzTG9hZGluZywgc2V0SW5zaWdodHNMb2FkaW5nXSA9IHVzZVN0YXRlKGZhbHNlKVxyXG4gIGNvbnN0IGxhc3RGZXRjaGVkTW9udGhSZWYgPSB1c2VSZWY8c3RyaW5nIHwgbnVsbD4obnVsbClcclxuICBjb25zdCBbaXNNb250aFRyYW5zaXRpb25pbmcsIHNldElzTW9udGhUcmFuc2l0aW9uaW5nXSA9IHVzZVN0YXRlKGZhbHNlKVxyXG4gIGNvbnN0IFtpc01vYmlsZVZpZXdwb3J0LCBzZXRJc01vYmlsZVZpZXdwb3J0XSA9IHVzZVN0YXRlKGZhbHNlKVxyXG5cclxuICBjb25zdCBmb3JtYXRBeGlzQ3VycmVuY3lUaWNrID0gKHZhbHVlOiBudW1iZXIpID0+IHtcclxuICAgIGlmICh2YWx1ZSA+PSAxMDAwKSB7XHJcbiAgICAgIHJldHVybiBgUiQgJHtmb3JtYXROdW1iZXJCUih2YWx1ZSAvIDEwMDAsIHsgbWF4aW11bUZyYWN0aW9uRGlnaXRzOiAwIH0pfWtgXHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGBSJCAke2Zvcm1hdE51bWJlckJSKHZhbHVlLCB7IG1heGltdW1GcmFjdGlvbkRpZ2l0czogMCB9KX1gXHJcbiAgfVxyXG5cclxuICBjb25zdCBoYW5kbGVBbW91bnRDaGFuZ2UgPSAobmV4dEFtb3VudDogc3RyaW5nKSA9PiB7XHJcbiAgICBzZXRGb3JtRGF0YSgocHJldikgPT4ge1xyXG4gICAgICBjb25zdCBwcmV2QW1vdW50ID0gcGFyc2VNb25leUlucHV0KHByZXYuYW1vdW50KVxyXG4gICAgICBjb25zdCBwcmV2UmVwb3J0QW1vdW50ID0gcGFyc2VNb25leUlucHV0KHByZXYucmVwb3J0X2Ftb3VudClcclxuICAgICAgY29uc3Qgc2hvdWxkU3luY1JlcG9ydEFtb3VudCA9XHJcbiAgICAgICAgIXByZXYucmVwb3J0X2Ftb3VudCB8fFxyXG4gICAgICAgICghTnVtYmVyLmlzTmFOKHByZXZBbW91bnQpICYmXHJcbiAgICAgICAgICAhTnVtYmVyLmlzTmFOKHByZXZSZXBvcnRBbW91bnQpICYmXHJcbiAgICAgICAgICBNYXRoLmFicyhwcmV2UmVwb3J0QW1vdW50IC0gcHJldkFtb3VudCkgPCAwLjAwOSlcclxuXHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgLi4ucHJldixcclxuICAgICAgICBhbW91bnQ6IG5leHRBbW91bnQsXHJcbiAgICAgICAgcmVwb3J0X2Ftb3VudDogc2hvdWxkU3luY1JlcG9ydEFtb3VudCA/IG5leHRBbW91bnQgOiBwcmV2LnJlcG9ydF9hbW91bnQsXHJcbiAgICAgIH1cclxuICAgIH0pXHJcbiAgfVxyXG4gIGNvbnN0IHsgY29sb3JQYWxldHRlIH0gPSB1c2VQYWxldHRlQ29sb3JzKClcclxuICBjb25zdCB7IGNhdGVnb3JpZXMgfSA9IHVzZUNhdGVnb3JpZXMoKVxyXG4gIGNvbnN0IHsgaW5jb21lQ2F0ZWdvcmllcyB9ID0gdXNlSW5jb21lQ2F0ZWdvcmllcygpXHJcbiAgY29uc3QgeyBjcmVkaXRDYXJkcyB9ID0gdXNlQ3JlZGl0Q2FyZHMoKVxyXG4gIGNvbnN0IHsgZXhwZW5zZXMsIGxvYWRpbmc6IGV4cGVuc2VzTG9hZGluZywgcmVmcmVzaEV4cGVuc2VzLCBjcmVhdGVFeHBlbnNlIH0gPSB1c2VFeHBlbnNlcyhjdXJyZW50TW9udGgpXHJcbiAgY29uc3QgcHJldmlvdXNNb250aCA9IHVzZU1lbW8oKCkgPT4gYWRkTW9udGhzKGN1cnJlbnRNb250aCwgLTEpLCBbY3VycmVudE1vbnRoXSlcclxuICBjb25zdCB7IGV4cGVuc2VzOiBwcmV2aW91c01vbnRoRXhwZW5zZXMgfSA9IHVzZUV4cGVuc2VzKHByZXZpb3VzTW9udGgpXHJcbiAgY29uc3QgeyBpbmNvbWVzLCBsb2FkaW5nOiBpbmNvbWVzTG9hZGluZywgcmVmcmVzaEluY29tZXMsIGNyZWF0ZUluY29tZSB9ID0gdXNlSW5jb21lcyhjdXJyZW50TW9udGgpXHJcbiAgY29uc3QgeyBpbnZlc3RtZW50cywgbG9hZGluZzogaW52ZXN0bWVudHNMb2FkaW5nLCByZWZyZXNoSW52ZXN0bWVudHMsIGNyZWF0ZUludmVzdG1lbnQgfSA9IHVzZUludmVzdG1lbnRzKGN1cnJlbnRNb250aClcclxuICBjb25zdCB7IGxpbWl0czogY3VycmVudE1vbnRoRXhwZW5zZUxpbWl0cywgbG9hZGluZzogZXhwZW5zZUxpbWl0c0xvYWRpbmcgfSA9IHVzZUV4cGVuc2VDYXRlZ29yeUxpbWl0cyhjdXJyZW50TW9udGgpXHJcbiAgY29uc3QgeyBsaW1pdHM6IHByZXZpb3VzTW9udGhFeHBlbnNlTGltaXRzLCBsb2FkaW5nOiBwcmV2aW91c0V4cGVuc2VMaW1pdHNMb2FkaW5nIH0gPSB1c2VFeHBlbnNlQ2F0ZWdvcnlMaW1pdHMocHJldmlvdXNNb250aClcclxuXHJcbiAgY29uc3QgZXhwZW5zZUFtb3VudEZvckRhc2hib2FyZCA9IChhbW91bnQ6IG51bWJlciwgcmVwb3J0V2VpZ2h0PzogbnVtYmVyIHwgbnVsbCkgPT5cclxuICAgIGFtb3VudCAqIChyZXBvcnRXZWlnaHQgPz8gMSlcclxuXHJcbiAgY29uc3QgaW5jb21lQW1vdW50Rm9yRGFzaGJvYXJkID0gKGFtb3VudDogbnVtYmVyLCByZXBvcnRXZWlnaHQ/OiBudW1iZXIgfCBudWxsKSA9PlxyXG4gICAgYW1vdW50ICogKHJlcG9ydFdlaWdodCA/PyAxKVxyXG5cclxuICBjb25zdCB0b3RhbEV4cGVuc2VzID0gZXhwZW5zZXMucmVkdWNlKChzdW0sIGV4cCkgPT4gc3VtICsgZXhwZW5zZUFtb3VudEZvckRhc2hib2FyZChleHAuYW1vdW50LCBleHAucmVwb3J0X3dlaWdodCksIDApXHJcbiAgY29uc3QgdG90YWxJbmNvbWVzID0gaW5jb21lcy5yZWR1Y2UoKHN1bSwgaW5jKSA9PiBzdW0gKyBpbmNvbWVBbW91bnRGb3JEYXNoYm9hcmQoaW5jLmFtb3VudCwgaW5jLnJlcG9ydF93ZWlnaHQpLCAwKVxyXG4gIGNvbnN0IHRvdGFsSW52ZXN0bWVudHMgPSBpbnZlc3RtZW50cy5yZWR1Y2UoKHN1bSwgaW52KSA9PiBzdW0gKyBpbnYuYW1vdW50LCAwKVxyXG4gIGNvbnN0IGJhbGFuY2UgPSB0b3RhbEluY29tZXMgLSB0b3RhbEV4cGVuc2VzIC0gdG90YWxJbnZlc3RtZW50c1xyXG4gIGNvbnN0IGhhc01vbnRobHlEYXRhID0gZXhwZW5zZXMubGVuZ3RoID4gMCB8fCBpbmNvbWVzLmxlbmd0aCA+IDAgfHwgaW52ZXN0bWVudHMubGVuZ3RoID4gMFxyXG4gIGNvbnN0IGxvYWRpbmcgPVxyXG4gICAgZXhwZW5zZXNMb2FkaW5nIHx8XHJcbiAgICBpbmNvbWVzTG9hZGluZyB8fFxyXG4gICAgaW52ZXN0bWVudHNMb2FkaW5nIHx8XHJcbiAgICBleHBlbnNlTGltaXRzTG9hZGluZyB8fFxyXG4gICAgcHJldmlvdXNFeHBlbnNlTGltaXRzTG9hZGluZ1xyXG5cclxuICBjb25zdCBtb250aGx5T3ZlcnZpZXdEYXRhID0gdXNlTWVtbyhcclxuICAgICgpID0+IFtcclxuICAgICAgeyBuYW1lOiAnUmVuZGFzJywgdmFsdWU6IHRvdGFsSW5jb21lcywgY29sb3I6ICd2YXIoLS1jb2xvci1pbmNvbWUpJyB9LFxyXG4gICAgICB7IG5hbWU6ICdEZXNwZXNhcycsIHZhbHVlOiB0b3RhbEV4cGVuc2VzLCBjb2xvcjogJ3ZhcigtLWNvbG9yLWV4cGVuc2UpJyB9LFxyXG4gICAgICB7IG5hbWU6ICdJbnZlc3RpbWVudG9zJywgdmFsdWU6IHRvdGFsSW52ZXN0bWVudHMsIGNvbG9yOiAndmFyKC0tY29sb3ItYmFsYW5jZSknIH0sXHJcbiAgICBdLFxyXG4gICAgW3RvdGFsRXhwZW5zZXMsIHRvdGFsSW5jb21lcywgdG90YWxJbnZlc3RtZW50c11cclxuICApXHJcblxyXG4gIGNvbnN0IGV4cGVuc2VCeUNhdGVnb3J5ID0gdXNlTWVtbygoKSA9PiB7XHJcbiAgICBjb25zdCBtYXAgPSBuZXcgTWFwPHN0cmluZywgeyBjYXRlZ29yeUlkOiBzdHJpbmc7IG5hbWU6IHN0cmluZzsgY29sb3I6IHN0cmluZzsgdmFsdWU6IG51bWJlciB9PigpXHJcblxyXG4gICAgZXhwZW5zZXMuZm9yRWFjaCgoZXhwZW5zZSkgPT4ge1xyXG4gICAgICBjb25zdCBuYW1lID0gZXhwZW5zZS5jYXRlZ29yeT8ubmFtZSB8fCAnU2VtIGNhdGVnb3JpYSdcclxuICAgICAgY29uc3QgY2F0ZWdvcnlJZCA9IGV4cGVuc2UuY2F0ZWdvcnk/LmlkIHx8IGV4cGVuc2UuY2F0ZWdvcnlfaWQgfHwgJydcclxuICAgICAgY29uc3Qga2V5ID0gY2F0ZWdvcnlJZCB8fCBuYW1lXHJcbiAgICAgIGNvbnN0IGNvbG9yID0gZ2V0Q2F0ZWdvcnlDb2xvckZvclBhbGV0dGUoZXhwZW5zZS5jYXRlZ29yeT8uY29sb3IgfHwgJ3ZhcigtLWNvbG9yLXByaW1hcnkpJywgY29sb3JQYWxldHRlKVxyXG4gICAgICBjb25zdCBjdXJyZW50ID0gbWFwLmdldChrZXkpXHJcblxyXG4gICAgICBpZiAoY3VycmVudCkge1xyXG4gICAgICAgIGN1cnJlbnQudmFsdWUgKz0gZXhwZW5zZUFtb3VudEZvckRhc2hib2FyZChleHBlbnNlLmFtb3VudCwgZXhwZW5zZS5yZXBvcnRfd2VpZ2h0KVxyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIG1hcC5zZXQoa2V5LCB7IGNhdGVnb3J5SWQsIG5hbWUsIGNvbG9yLCB2YWx1ZTogZXhwZW5zZUFtb3VudEZvckRhc2hib2FyZChleHBlbnNlLmFtb3VudCwgZXhwZW5zZS5yZXBvcnRfd2VpZ2h0KSB9KVxyXG4gICAgICB9XHJcbiAgICB9KVxyXG5cclxuICAgIHJldHVybiBBcnJheS5mcm9tKG1hcC52YWx1ZXMoKSkuc29ydCgoYSwgYikgPT4gYi52YWx1ZSAtIGEudmFsdWUpXHJcbiAgfSwgW2V4cGVuc2VzLCBjb2xvclBhbGV0dGVdKVxyXG5cclxuICBjb25zdCBjdXJyZW50TW9udGhFeHBlbnNlTGltaXRNYXAgPSB1c2VNZW1vKCgpID0+IHtcclxuICAgIGNvbnN0IG1hcCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXIgfCBudWxsPigpXHJcbiAgICBjdXJyZW50TW9udGhFeHBlbnNlTGltaXRzLmZvckVhY2goKGl0ZW0pID0+IG1hcC5zZXQoaXRlbS5jYXRlZ29yeV9pZCwgaXRlbS5saW1pdF9hbW91bnQpKVxyXG4gICAgcmV0dXJuIG1hcFxyXG4gIH0sIFtjdXJyZW50TW9udGhFeHBlbnNlTGltaXRzXSlcclxuXHJcbiAgY29uc3QgcHJldmlvdXNNb250aEV4cGVuc2VMaW1pdE1hcCA9IHVzZU1lbW8oKCkgPT4ge1xyXG4gICAgY29uc3QgbWFwID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlciB8IG51bGw+KClcclxuICAgIHByZXZpb3VzTW9udGhFeHBlbnNlTGltaXRzLmZvckVhY2goKGl0ZW0pID0+IG1hcC5zZXQoaXRlbS5jYXRlZ29yeV9pZCwgaXRlbS5saW1pdF9hbW91bnQpKVxyXG4gICAgcmV0dXJuIG1hcFxyXG4gIH0sIFtwcmV2aW91c01vbnRoRXhwZW5zZUxpbWl0c10pXHJcblxyXG4gIGNvbnN0IGV4cGVuc2VMaW1pdE1hcCA9IHVzZU1lbW8oKCkgPT4ge1xyXG4gICAgY29uc3QgbWFwID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlciB8IG51bGw+KClcclxuXHJcbiAgICBjYXRlZ29yaWVzLmZvckVhY2goKGNhdGVnb3J5KSA9PiB7XHJcbiAgICAgIGNvbnN0IGN1cnJlbnRWYWx1ZSA9IGN1cnJlbnRNb250aEV4cGVuc2VMaW1pdE1hcC5nZXQoY2F0ZWdvcnkuaWQpXHJcbiAgICAgIGlmIChjdXJyZW50VmFsdWUgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgIG1hcC5zZXQoY2F0ZWdvcnkuaWQsIGN1cnJlbnRWYWx1ZSlcclxuICAgICAgICByZXR1cm5cclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgcHJldmlvdXNWYWx1ZSA9IHByZXZpb3VzTW9udGhFeHBlbnNlTGltaXRNYXAuZ2V0KGNhdGVnb3J5LmlkKVxyXG4gICAgICBpZiAocHJldmlvdXNWYWx1ZSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgbWFwLnNldChjYXRlZ29yeS5pZCwgcHJldmlvdXNWYWx1ZSlcclxuICAgICAgfVxyXG4gICAgfSlcclxuXHJcbiAgICByZXR1cm4gbWFwXHJcbiAgfSwgW2NhdGVnb3JpZXMsIGN1cnJlbnRNb250aEV4cGVuc2VMaW1pdE1hcCwgcHJldmlvdXNNb250aEV4cGVuc2VMaW1pdE1hcF0pXHJcblxyXG4gIGNvbnN0IGV4cGVuc2VMaW1pdEFsZXJ0cyA9IHVzZU1lbW8oKCkgPT4ge1xyXG4gICAgcmV0dXJuIGV4cGVuc2VCeUNhdGVnb3J5XHJcbiAgICAgIC5tYXAoKGl0ZW0pID0+IHtcclxuICAgICAgICBjb25zdCBsaW1pdEFtb3VudCA9IGl0ZW0uY2F0ZWdvcnlJZCA/IGV4cGVuc2VMaW1pdE1hcC5nZXQoaXRlbS5jYXRlZ29yeUlkKSA6IHVuZGVmaW5lZFxyXG4gICAgICAgIGNvbnN0IGhhc0xpbWl0ID0gbGltaXRBbW91bnQgIT09IG51bGwgJiYgbGltaXRBbW91bnQgIT09IHVuZGVmaW5lZFxyXG5cclxuICAgICAgICBpZiAoIWhhc0xpbWl0KSByZXR1cm4gbnVsbFxyXG5cclxuICAgICAgICBjb25zdCBleGNlZWRlZEFtb3VudCA9IGl0ZW0udmFsdWUgLSAobGltaXRBbW91bnQgfHwgMClcclxuICAgICAgICBpZiAoZXhjZWVkZWRBbW91bnQgPD0gMCkgcmV0dXJuIG51bGxcclxuXHJcbiAgICAgICAgY29uc3QgZXhjZWVkZWRQZXJjZW50YWdlID0gKGxpbWl0QW1vdW50IHx8IDApID4gMCA/IChleGNlZWRlZEFtb3VudCAvIChsaW1pdEFtb3VudCB8fCAxKSkgKiAxMDAgOiAxMDBcclxuICAgICAgICBjb25zdCB1c2FnZVBlcmNlbnRhZ2UgPSAobGltaXRBbW91bnQgfHwgMCkgPiAwID8gKGl0ZW0udmFsdWUgLyAobGltaXRBbW91bnQgfHwgMSkpICogMTAwIDogMTAwXHJcblxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAuLi5pdGVtLFxyXG4gICAgICAgICAgbGltaXRBbW91bnQ6IGxpbWl0QW1vdW50IHx8IDAsXHJcbiAgICAgICAgICBleGNlZWRlZEFtb3VudCxcclxuICAgICAgICAgIGV4Y2VlZGVkUGVyY2VudGFnZSxcclxuICAgICAgICAgIHVzYWdlUGVyY2VudGFnZSxcclxuICAgICAgICB9XHJcbiAgICAgIH0pXHJcbiAgICAgIC5maWx0ZXIoKGl0ZW0pOiBpdGVtIGlzIE5vbk51bGxhYmxlPHR5cGVvZiBpdGVtPiA9PiBCb29sZWFuKGl0ZW0pKVxyXG4gICAgICAuc29ydCgoYSwgYikgPT4gYi5leGNlZWRlZEFtb3VudCAtIGEuZXhjZWVkZWRBbW91bnQpXHJcbiAgfSwgW2V4cGVuc2VCeUNhdGVnb3J5LCBleHBlbnNlTGltaXRNYXBdKVxyXG5cclxuICBjb25zdCBleHBlbnNlQ2F0ZWdvcmllc1BpZURhdGEgPSB1c2VNZW1vKCgpID0+IHtcclxuICAgIGlmIChleHBlbnNlQnlDYXRlZ29yeS5sZW5ndGggPD0gNSkgcmV0dXJuIGV4cGVuc2VCeUNhdGVnb3J5XHJcblxyXG4gICAgY29uc3QgdG9wID0gZXhwZW5zZUJ5Q2F0ZWdvcnkuc2xpY2UoMCwgNSlcclxuICAgIGNvbnN0IG90aGVyc1ZhbHVlID0gZXhwZW5zZUJ5Q2F0ZWdvcnkuc2xpY2UoNSkucmVkdWNlKChzdW0sIGl0ZW0pID0+IHN1bSArIGl0ZW0udmFsdWUsIDApXHJcblxyXG4gICAgcmV0dXJuIFsuLi50b3AsIHsgY2F0ZWdvcnlJZDogJycsIG5hbWU6ICdPdXRyYXMnLCBjb2xvcjogJ3ZhcigtLWNvbG9yLXRleHQtc2Vjb25kYXJ5KScsIHZhbHVlOiBvdGhlcnNWYWx1ZSB9XVxyXG4gIH0sIFtleHBlbnNlQnlDYXRlZ29yeV0pXHJcblxyXG4gIGNvbnN0IGV4cGVuc2VBdHRlbnRpb25DYXRlZ29yaWVzID0gdXNlTWVtbygoKSA9PiB7XHJcbiAgICByZXR1cm4gZXhwZW5zZUJ5Q2F0ZWdvcnlcclxuICAgICAgLm1hcCgoaXRlbSkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGxpbWl0QW1vdW50ID0gaXRlbS5jYXRlZ29yeUlkID8gZXhwZW5zZUxpbWl0TWFwLmdldChpdGVtLmNhdGVnb3J5SWQpIDogdW5kZWZpbmVkXHJcbiAgICAgICAgY29uc3QgaGFzTGltaXQgPSBsaW1pdEFtb3VudCAhPT0gbnVsbCAmJiBsaW1pdEFtb3VudCAhPT0gdW5kZWZpbmVkXHJcblxyXG4gICAgICAgIGlmICghaGFzTGltaXQgfHwgKGxpbWl0QW1vdW50IHx8IDApIDw9IDApIHJldHVybiBudWxsXHJcblxyXG4gICAgICAgIGNvbnN0IHVzYWdlUGVyY2VudGFnZSA9IChpdGVtLnZhbHVlIC8gKGxpbWl0QW1vdW50IHx8IDEpKSAqIDEwMFxyXG4gICAgICAgIGNvbnN0IGlzTmVhckxpbWl0ID0gdXNhZ2VQZXJjZW50YWdlID49IEVYUEVOU0VfTElNSVRfV0FSTklOR19USFJFU0hPTEQgJiYgdXNhZ2VQZXJjZW50YWdlIDwgMTAwXHJcblxyXG4gICAgICAgIGlmICghaXNOZWFyTGltaXQpIHJldHVybiBudWxsXHJcblxyXG4gICAgICAgIGNvbnN0IGxldmVsID0gdXNhZ2VQZXJjZW50YWdlID49IDk1ID8gJ0Nyw610aWNhJyA6IHVzYWdlUGVyY2VudGFnZSA+PSA5MCA/ICdBbHRhJyA6ICdNw6lkaWEnXHJcblxyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAuLi5pdGVtLFxyXG4gICAgICAgICAgbGV2ZWwsXHJcbiAgICAgICAgICB1c2FnZVBlcmNlbnRhZ2UsXHJcbiAgICAgICAgICBsaW1pdEFtb3VudDogbGltaXRBbW91bnQgfHwgMCxcclxuICAgICAgICAgIHJlbWFpbmluZ0Ftb3VudDogKGxpbWl0QW1vdW50IHx8IDApIC0gaXRlbS52YWx1ZSxcclxuICAgICAgICB9XHJcbiAgICAgIH0pXHJcbiAgICAgIC5maWx0ZXIoKGl0ZW0pOiBpdGVtIGlzIE5vbk51bGxhYmxlPHR5cGVvZiBpdGVtPiA9PiBCb29sZWFuKGl0ZW0pKVxyXG4gICAgICAuc29ydCgoYSwgYikgPT4gYi51c2FnZVBlcmNlbnRhZ2UgLSBhLnVzYWdlUGVyY2VudGFnZSlcclxuICB9LCBbZXhwZW5zZUJ5Q2F0ZWdvcnksIGV4cGVuc2VMaW1pdE1hcF0pXHJcblxyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICBpZiAodHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcpIHJldHVyblxyXG5cclxuICAgIGNvbnN0IG1lZGlhUXVlcnkgPSB3aW5kb3cubWF0Y2hNZWRpYSgnKG1heC13aWR0aDogNjQwcHgpJylcclxuICAgIGNvbnN0IHVwZGF0ZVZpZXdwb3J0ID0gKCkgPT4gc2V0SXNNb2JpbGVWaWV3cG9ydChtZWRpYVF1ZXJ5Lm1hdGNoZXMpXHJcblxyXG4gICAgdXBkYXRlVmlld3BvcnQoKVxyXG4gICAgbWVkaWFRdWVyeS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCB1cGRhdGVWaWV3cG9ydClcclxuXHJcbiAgICByZXR1cm4gKCkgPT4ge1xyXG4gICAgICBtZWRpYVF1ZXJ5LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIHVwZGF0ZVZpZXdwb3J0KVxyXG4gICAgfVxyXG4gIH0sIFtdKVxyXG5cclxuICBjb25zdCBbaW5zaWdodFRvYXN0RXJyb3IsIHNldEluc2lnaHRUb2FzdEVycm9yXSA9IHVzZVN0YXRlPHN0cmluZyB8IG51bGw+KG51bGwpXHJcblxyXG4gIGNvbnN0IGhhbmRsZVJlZnJlc2hJbnNpZ2h0cyA9IGFzeW5jICgpID0+IHtcclxuICAgIGlmIChpbnNpZ2h0c0xvYWRpbmcpIHJldHVyblxyXG4gICAgc2V0SW5zaWdodHNMb2FkaW5nKHRydWUpXHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBnZXRBc3Npc3RhbnRNb250aGx5SW5zaWdodHMoY3VycmVudE1vbnRoLCB0cnVlKVxyXG4gICAgICBpZiAocmVzdWx0KSB7XHJcbiAgICAgICAgY29uc3QgbWVyZ2VkSW5zaWdodHMgPSBbLi4ucmVzdWx0LmhpZ2hsaWdodHMsIC4uLnJlc3VsdC5yZWNvbW1lbmRhdGlvbnNdXHJcbiAgICAgICAgICAubWFwKChpdGVtKSA9PiBpdGVtLnRyaW0oKSlcclxuICAgICAgICAgIC5maWx0ZXIoQm9vbGVhbilcclxuICAgICAgICBzZXRNb250aGx5SW5zaWdodHMobWVyZ2VkSW5zaWdodHMuc2xpY2UoMCwgMykpXHJcbiAgICAgICAgc2V0SW5zaWdodFRvYXN0RXJyb3IobnVsbClcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBzZXRJbnNpZ2h0VG9hc3RFcnJvcignTsOjbyBmb2kgcG9zc8OtdmVsIGdlcmFyIG9zIGluc2lnaHRzIG5vIG1vbWVudG8uIFRlbnRlIG5vdmFtZW50ZSBtYWlzIHRhcmRlLicpXHJcbiAgICAgIH1cclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIHNldEluc2lnaHRUb2FzdEVycm9yKGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogJ0ZhbGhhIGFvIGF0dWFsaXphciBpbnNpZ2h0cy4nKVxyXG4gICAgfSBmaW5hbGx5IHtcclxuICAgICAgc2V0SW5zaWdodHNMb2FkaW5nKGZhbHNlKVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGxldCBpc0NhbmNlbGxlZCA9IGZhbHNlXHJcblxyXG4gICAgLy8gT25seSBtYXAgdGhlIHRyYW5zaXRpb24gYW5kIHdpcGUgaW5zaWdodHMgaWYgdGhlIHVzZXIgYWN0dWFsbHkgbmF2aWdhdGVkIHRvIGEgZGlmZmVyZW50IG1vbnRoLlxyXG4gICAgLy8gSWYgaXQncyB0aGUgc2FtZSBtb250aCBhbmQganVzdCBhIGRlcGVuZGVuY3kgbGlrZSBgdG90YWxFeHBlbnNlc2AgdXBkYXRlZCBsb2NhbGx5LCBwcmVzZXJ2ZSB0aGUgdmlzdWFsIGJsb2Nrcy5cclxuICAgIGlmIChsYXN0RmV0Y2hlZE1vbnRoUmVmLmN1cnJlbnQgIT09IGN1cnJlbnRNb250aCkge1xyXG4gICAgICBzZXRNb250aGx5SW5zaWdodHMoW10pXHJcbiAgICAgIHNldElzTW9udGhUcmFuc2l0aW9uaW5nKHRydWUpXHJcbiAgICAgIGxhc3RGZXRjaGVkTW9udGhSZWYuY3VycmVudCA9IGN1cnJlbnRNb250aFxyXG4gICAgfVxyXG5cclxuICAgIGlmICghbW9udGhseUluc2lnaHRzRW5hYmxlZCkge1xyXG4gICAgICBzZXRJbnNpZ2h0c0xvYWRpbmcoZmFsc2UpXHJcbiAgICAgIHNldElzTW9udGhUcmFuc2l0aW9uaW5nKGZhbHNlKVxyXG4gICAgICByZXR1cm5cclxuICAgIH1cclxuXHJcbiAgICBpZiAoIWhhc01vbnRobHlEYXRhKSB7XHJcbiAgICAgIHNldEluc2lnaHRzTG9hZGluZyhmYWxzZSlcclxuICAgICAgLy8gR2l2ZSBvdGhlciBlbGVtZW50cyBhIG1vbWVudCB0byBmYWRlIGluIGNsZWFubHkgYmVmb3JlIHJlc29sdmluZyB0cmFuc2l0aW9uXHJcbiAgICAgIGNvbnN0IGZhZGVUaW1lciA9IHNldFRpbWVvdXQoKCkgPT4gc2V0SXNNb250aFRyYW5zaXRpb25pbmcoZmFsc2UpLCAxNTApXHJcbiAgICAgIHJldHVybiAoKSA9PiBjbGVhclRpbWVvdXQoZmFkZVRpbWVyKVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGxvYWRJbnNpZ2h0cyA9IGFzeW5jICgpID0+IHtcclxuICAgICAgc2V0SW5zaWdodHNMb2FkaW5nKHRydWUpXHJcblxyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGdldEFzc2lzdGFudE1vbnRobHlJbnNpZ2h0cyhjdXJyZW50TW9udGgpXHJcbiAgICAgICAgaWYgKGlzQ2FuY2VsbGVkKSByZXR1cm5cclxuXHJcbiAgICAgICAgaWYgKHJlc3VsdCkge1xyXG4gICAgICAgICAgY29uc3QgbWVyZ2VkSW5zaWdodHMgPSBbLi4ucmVzdWx0LmhpZ2hsaWdodHMsIC4uLnJlc3VsdC5yZWNvbW1lbmRhdGlvbnNdXHJcbiAgICAgICAgICAgIC5tYXAoKGl0ZW0pID0+IGl0ZW0udHJpbSgpKVxyXG4gICAgICAgICAgICAuZmlsdGVyKEJvb2xlYW4pXHJcbiAgICAgICAgICBzZXRNb250aGx5SW5zaWdodHMobWVyZ2VkSW5zaWdodHMuc2xpY2UoMCwgMykpXHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIGlmICh0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJyAmJiAhbmF2aWdhdG9yLm9uTGluZSkge1xyXG4gICAgICAgICAgICByZXR1cm5cclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHNldE1vbnRobHlJbnNpZ2h0cyhbXSlcclxuICAgICAgICB9XHJcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgaWYgKGlzQ2FuY2VsbGVkKSByZXR1cm5cclxuXHJcbiAgICAgICAgLy8gU2UgZXN0aXZlcm1vcyBvZmZsaW5lIGUgZGV1IGVycm8sIHNpbXBsZXNtZW50ZSBldml0ZSBsaW1wYXIgZSBtYW50ZXIgbyBxdWUgasOhIGVzdGF2YSBvdSBuw6NvIGZhemVyIG5hZGEgZmF0YWxcclxuICAgICAgICBpZiAodHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgJiYgIW5hdmlnYXRvci5vbkxpbmUpIHtcclxuICAgICAgICAgIHJldHVyblxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgc2V0SW5zaWdodFRvYXN0RXJyb3IoZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiAnRmFsaGEgYW8gY2FycmVnYXIgaW5zaWdodHMgZG8gbcOqcy4nKVxyXG4gICAgICAgIHNldE1vbnRobHlJbnNpZ2h0cyhbXSlcclxuICAgICAgfSBmaW5hbGx5IHtcclxuICAgICAgICBpZiAoIWlzQ2FuY2VsbGVkKSB7XHJcbiAgICAgICAgICBzZXRJbnNpZ2h0c0xvYWRpbmcoZmFsc2UpXHJcbiAgICAgICAgICBzZXRJc01vbnRoVHJhbnNpdGlvbmluZyhmYWxzZSlcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBTaG9ydCBkZWxheSBmb3IgdGhlIGZhZGUtb3V0IHRvIGNvbXBsZXRlIGJlZm9yZSBmZXRjaGluZyBuZXcgY29udGVudFxyXG4gICAgY29uc3QgdGltZW91dElkID0gc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgIHZvaWQgbG9hZEluc2lnaHRzKClcclxuICAgIH0sIDE1MClcclxuXHJcbiAgICByZXR1cm4gKCkgPT4ge1xyXG4gICAgICBpc0NhbmNlbGxlZCA9IHRydWVcclxuICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRJZClcclxuICAgIH1cclxuICB9LCBbXHJcbiAgICBjdXJyZW50TW9udGgsXHJcbiAgICBtb250aGx5SW5zaWdodHNFbmFibGVkLFxyXG4gICAgaGFzTW9udGhseURhdGEsXHJcbiAgICB0b3RhbEV4cGVuc2VzLFxyXG4gICAgdG90YWxJbmNvbWVzLFxyXG4gICAgdG90YWxJbnZlc3RtZW50cyxcclxuICBdKVxyXG5cclxuICBjb25zdCBwcmlvcml0aXplZEV4cGVuc2VDYXRlZ29yeUl0ZW1zID0gdXNlTWVtbygoKSA9PiB7XHJcbiAgICByZXR1cm4gZXhwZW5zZUJ5Q2F0ZWdvcnlcclxuICAgICAgLm1hcCgoaXRlbSkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGV4Y2VlZGVkID0gZXhwZW5zZUxpbWl0QWxlcnRzLmZpbmQoKGFsZXJ0KSA9PiBhbGVydC5jYXRlZ29yeUlkID09PSBpdGVtLmNhdGVnb3J5SWQpXHJcbiAgICAgICAgaWYgKGV4Y2VlZGVkKSB7XHJcbiAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAuLi5pdGVtLFxyXG4gICAgICAgICAgICBhbGVydFByaW9yaXR5OiAyLFxyXG4gICAgICAgICAgICBhbGVydFN0YXR1c0xhYmVsOiAnVWx0cmFwYXNzb3UnLFxyXG4gICAgICAgICAgICBhbGVydFN0YXR1c0NsYXNzOiAndGV4dC1zZWNvbmRhcnknLFxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgbmVhckxpbWl0ID0gZXhwZW5zZUF0dGVudGlvbkNhdGVnb3JpZXMuZmluZCgoYWxlcnQpID0+IGFsZXJ0LmNhdGVnb3J5SWQgPT09IGl0ZW0uY2F0ZWdvcnlJZClcclxuICAgICAgICBpZiAobmVhckxpbWl0KSB7XHJcbiAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAuLi5pdGVtLFxyXG4gICAgICAgICAgICBhbGVydFByaW9yaXR5OiAxLFxyXG4gICAgICAgICAgICBhbGVydFN0YXR1c0xhYmVsOiBuZWFyTGltaXQubGV2ZWwsXHJcbiAgICAgICAgICAgIGFsZXJ0U3RhdHVzQ2xhc3M6ICd0ZXh0LXNlY29uZGFyeScsXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgLi4uaXRlbSxcclxuICAgICAgICAgIGFsZXJ0UHJpb3JpdHk6IDAsXHJcbiAgICAgICAgICBhbGVydFN0YXR1c0xhYmVsOiAnJyxcclxuICAgICAgICAgIGFsZXJ0U3RhdHVzQ2xhc3M6ICd0ZXh0LXNlY29uZGFyeScsXHJcbiAgICAgICAgfVxyXG4gICAgICB9KVxyXG4gICAgICAuc29ydCgoYSwgYikgPT4ge1xyXG4gICAgICAgIGlmIChiLmFsZXJ0UHJpb3JpdHkgIT09IGEuYWxlcnRQcmlvcml0eSkgcmV0dXJuIGIuYWxlcnRQcmlvcml0eSAtIGEuYWxlcnRQcmlvcml0eVxyXG4gICAgICAgIHJldHVybiBiLnZhbHVlIC0gYS52YWx1ZVxyXG4gICAgICB9KVxyXG4gIH0sIFtleHBlbnNlQnlDYXRlZ29yeSwgZXhwZW5zZUxpbWl0QWxlcnRzLCBleHBlbnNlQXR0ZW50aW9uQ2F0ZWdvcmllc10pXHJcblxyXG4gIGNvbnN0IGRhaWx5Rmxvd0RhdGEgPSB1c2VNZW1vKCgpID0+IHtcclxuICAgIGNvbnN0IFt5ZWFyLCBtb250aF0gPSBjdXJyZW50TW9udGguc3BsaXQoJy0nKS5tYXAoTnVtYmVyKVxyXG4gICAgY29uc3QgZGF5c0luTW9udGggPSBuZXcgRGF0ZSh5ZWFyLCBtb250aCwgMCkuZ2V0RGF0ZSgpXHJcbiAgICBjb25zdCBzZXJpZXMgPSBBcnJheS5mcm9tKHsgbGVuZ3RoOiBkYXlzSW5Nb250aCB9LCAoXywgaW5kZXgpID0+ICh7XHJcbiAgICAgIGRheTogU3RyaW5nKGluZGV4ICsgMSkucGFkU3RhcnQoMiwgJzAnKSxcclxuICAgICAgUmVuZGFzOiAwLFxyXG4gICAgICBEZXNwZXNhczogMCxcclxuICAgICAgSW52ZXN0aW1lbnRvczogMCxcclxuICAgIH0pKVxyXG5cclxuICAgIGluY29tZXMuZm9yRWFjaCgoaW5jb21lKSA9PiB7XHJcbiAgICAgIGNvbnN0IGRheSA9IG5ldyBEYXRlKGAke2luY29tZS5kYXRlfVQwMDowMDowMGApLmdldERhdGUoKVxyXG4gICAgICBpZiAoZGF5ID49IDEgJiYgZGF5IDw9IGRheXNJbk1vbnRoKSBzZXJpZXNbZGF5IC0gMV0uUmVuZGFzICs9IGluY29tZUFtb3VudEZvckRhc2hib2FyZChpbmNvbWUuYW1vdW50LCBpbmNvbWUucmVwb3J0X3dlaWdodClcclxuICAgIH0pXHJcblxyXG4gICAgZXhwZW5zZXMuZm9yRWFjaCgoZXhwZW5zZSkgPT4ge1xyXG4gICAgICBjb25zdCBkYXkgPSBuZXcgRGF0ZShgJHtleHBlbnNlLmRhdGV9VDAwOjAwOjAwYCkuZ2V0RGF0ZSgpXHJcbiAgICAgIGlmIChkYXkgPj0gMSAmJiBkYXkgPD0gZGF5c0luTW9udGgpIHNlcmllc1tkYXkgLSAxXS5EZXNwZXNhcyArPSBleHBlbnNlQW1vdW50Rm9yRGFzaGJvYXJkKGV4cGVuc2UuYW1vdW50LCBleHBlbnNlLnJlcG9ydF93ZWlnaHQpXHJcbiAgICB9KVxyXG5cclxuICAgIGludmVzdG1lbnRzLmZvckVhY2goKGludmVzdG1lbnQpID0+IHtcclxuICAgICAgY29uc3QgaW52ZXN0bWVudERheSA9IDFcclxuICAgICAgaWYgKGludmVzdG1lbnREYXkgPj0gMSAmJiBpbnZlc3RtZW50RGF5IDw9IGRheXNJbk1vbnRoKSB7XHJcbiAgICAgICAgc2VyaWVzW2ludmVzdG1lbnREYXkgLSAxXS5JbnZlc3RpbWVudG9zICs9IGludmVzdG1lbnQuYW1vdW50XHJcbiAgICAgIH1cclxuICAgIH0pXHJcblxyXG4gICAgcmV0dXJuIHNlcmllc1xyXG4gIH0sIFtjdXJyZW50TW9udGgsIGluY29tZXMsIGV4cGVuc2VzLCBpbnZlc3RtZW50c10pXHJcblxyXG4gIGNvbnN0IGNoYXJ0VG9vbHRpcCA9ICh7IGFjdGl2ZSwgcGF5bG9hZCwgbGFiZWwgfTogeyBhY3RpdmU/OiBib29sZWFuOyBwYXlsb2FkPzogQXJyYXk8eyBuYW1lPzogc3RyaW5nOyB2YWx1ZT86IG51bWJlciB9PjsgbGFiZWw/OiBzdHJpbmcgfSkgPT4ge1xyXG4gICAgaWYgKCFhY3RpdmUgfHwgIXBheWxvYWQgfHwgcGF5bG9hZC5sZW5ndGggPT09IDApIHJldHVybiBudWxsXHJcblxyXG4gICAgY29uc3QgaXNEYXlMYWJlbCA9IHR5cGVvZiBsYWJlbCA9PT0gJ3N0cmluZycgJiYgL15cXGR7MSwyfSQvLnRlc3QobGFiZWwpXHJcblxyXG4gICAgcmV0dXJuIChcclxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJyb3VuZGVkLWxnIGJvcmRlciBib3JkZXItcHJpbWFyeSBiZy1wcmltYXJ5IHB4LTMgcHktMiBzaGFkb3ctc21cIj5cclxuICAgICAgICB7bGFiZWwgJiYgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LXNlY29uZGFyeSBtYi0xXCI+e2lzRGF5TGFiZWwgPyBgRGlhICR7bGFiZWx9YCA6IGxhYmVsfTwvcD59XHJcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTFcIj5cclxuICAgICAgICAgIHtwYXlsb2FkLm1hcCgoZW50cnksIGluZGV4KSA9PiAoXHJcbiAgICAgICAgICAgIDxwIGtleT17YCR7ZW50cnkubmFtZX0tJHtpbmRleH1gfSBjbGFzc05hbWU9XCJ0ZXh0LXNtIHRleHQtcHJpbWFyeVwiPlxyXG4gICAgICAgICAgICAgIHtlbnRyeS5uYW1lfToge2Zvcm1hdEN1cnJlbmN5KE51bWJlcihlbnRyeS52YWx1ZSB8fCAwKSl9XHJcbiAgICAgICAgICAgIDwvcD5cclxuICAgICAgICAgICkpfVxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICA8L2Rpdj5cclxuICAgIClcclxuICB9XHJcblxyXG4gIGNvbnN0IG9wZW5FeHBlbnNlQ2F0ZWdvcnlEZXRhaWxzID0gKGNhdGVnb3J5SWQ6IHN0cmluZywgY2F0ZWdvcnlOYW1lOiBzdHJpbmcpID0+IHtcclxuICAgIGlmICghY2F0ZWdvcnlJZCkgcmV0dXJuXHJcblxyXG4gICAgc2V0U2VsZWN0ZWRFeHBlbnNlQ2F0ZWdvcnkoeyBpZDogY2F0ZWdvcnlJZCwgbmFtZTogY2F0ZWdvcnlOYW1lIH0pXHJcbiAgfVxyXG5cclxuICBjb25zdCBzZWxlY3RlZEV4cGVuc2VDYXRlZ29yeURldGFpbHMgPSB1c2VNZW1vKCgpID0+IHtcclxuICAgIGlmICghc2VsZWN0ZWRFeHBlbnNlQ2F0ZWdvcnkpIHJldHVybiBudWxsXHJcblxyXG4gICAgY29uc3QgY3VycmVudEl0ZW1zID0gZXhwZW5zZXMuZmlsdGVyKChleHBlbnNlKSA9PiAoZXhwZW5zZS5jYXRlZ29yeT8uaWQgfHwgZXhwZW5zZS5jYXRlZ29yeV9pZCB8fCAnJykgPT09IHNlbGVjdGVkRXhwZW5zZUNhdGVnb3J5LmlkKVxyXG4gICAgY29uc3QgcHJldmlvdXNJdGVtcyA9IHByZXZpb3VzTW9udGhFeHBlbnNlcy5maWx0ZXIoKGV4cGVuc2UpID0+IChleHBlbnNlLmNhdGVnb3J5Py5pZCB8fCBleHBlbnNlLmNhdGVnb3J5X2lkIHx8ICcnKSA9PT0gc2VsZWN0ZWRFeHBlbnNlQ2F0ZWdvcnkuaWQpXHJcblxyXG4gICAgY29uc3QgY3VycmVudFRvdGFsID0gY3VycmVudEl0ZW1zLnJlZHVjZSgoc3VtLCBpdGVtKSA9PiBzdW0gKyBleHBlbnNlQW1vdW50Rm9yRGFzaGJvYXJkKGl0ZW0uYW1vdW50LCBpdGVtLnJlcG9ydF93ZWlnaHQpLCAwKVxyXG4gICAgY29uc3QgcHJldmlvdXNUb3RhbCA9IHByZXZpb3VzSXRlbXMucmVkdWNlKChzdW0sIGl0ZW0pID0+IHN1bSArIGV4cGVuc2VBbW91bnRGb3JEYXNoYm9hcmQoaXRlbS5hbW91bnQsIGl0ZW0ucmVwb3J0X3dlaWdodCksIDApXHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgY3VycmVudEl0ZW1zLFxyXG4gICAgICBjdXJyZW50VG90YWwsXHJcbiAgICAgIHByZXZpb3VzVG90YWwsXHJcbiAgICB9XHJcbiAgfSwgW3NlbGVjdGVkRXhwZW5zZUNhdGVnb3J5LCBleHBlbnNlcywgcHJldmlvdXNNb250aEV4cGVuc2VzXSlcclxuXHJcbiAgY29uc3Qgc2VsZWN0ZWRFeHBlbnNlQ2F0ZWdvcnlMaW1pdERldGFpbHMgPSB1c2VNZW1vKCgpID0+IHtcclxuICAgIGlmICghc2VsZWN0ZWRFeHBlbnNlQ2F0ZWdvcnkgfHwgIXNlbGVjdGVkRXhwZW5zZUNhdGVnb3J5RGV0YWlscykgcmV0dXJuIG51bGxcclxuXHJcbiAgICBjb25zdCByYXdMaW1pdCA9IGV4cGVuc2VMaW1pdE1hcC5nZXQoc2VsZWN0ZWRFeHBlbnNlQ2F0ZWdvcnkuaWQpXHJcbiAgICBjb25zdCBoYXNMaW1pdCA9IHJhd0xpbWl0ICE9PSBudWxsICYmIHJhd0xpbWl0ICE9PSB1bmRlZmluZWRcclxuXHJcbiAgICBpZiAoIWhhc0xpbWl0KSByZXR1cm4gbnVsbFxyXG5cclxuICAgIGNvbnN0IGxpbWl0QW1vdW50ID0gcmF3TGltaXQgfHwgMFxyXG4gICAgY29uc3QgY3VycmVudFRvdGFsID0gc2VsZWN0ZWRFeHBlbnNlQ2F0ZWdvcnlEZXRhaWxzLmN1cnJlbnRUb3RhbFxyXG4gICAgY29uc3QgZXhjZWVkZWRBbW91bnQgPSBNYXRoLm1heChjdXJyZW50VG90YWwgLSBsaW1pdEFtb3VudCwgMClcclxuICAgIGNvbnN0IHJlbWFpbmluZ0Ftb3VudCA9IE1hdGgubWF4KGxpbWl0QW1vdW50IC0gY3VycmVudFRvdGFsLCAwKVxyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgIGxpbWl0QW1vdW50LFxyXG4gICAgICBjdXJyZW50VG90YWwsXHJcbiAgICAgIGV4Y2VlZGVkQW1vdW50LFxyXG4gICAgICByZW1haW5pbmdBbW91bnQsXHJcbiAgICAgIGlzRXhjZWVkZWQ6IGN1cnJlbnRUb3RhbCA+IGxpbWl0QW1vdW50LFxyXG4gICAgfVxyXG4gIH0sIFtzZWxlY3RlZEV4cGVuc2VDYXRlZ29yeSwgc2VsZWN0ZWRFeHBlbnNlQ2F0ZWdvcnlEZXRhaWxzLCBleHBlbnNlTGltaXRNYXBdKVxyXG5cclxuICBjb25zdCB0b2dnbGVEYWlseUZsb3dTZXJpZXMgPSAoZGF0YUtleTogc3RyaW5nKSA9PiB7XHJcbiAgICBzZXRIaWRkZW5EYWlseUZsb3dTZXJpZXMoKHByZXYpID0+XHJcbiAgICAgIHByZXYuaW5jbHVkZXMoZGF0YUtleSkgPyBwcmV2LmZpbHRlcigoa2V5KSA9PiBrZXkgIT09IGRhdGFLZXkpIDogWy4uLnByZXYsIGRhdGFLZXldXHJcbiAgICApXHJcbiAgfVxyXG5cclxuICBjb25zdCByZW5kZXJJbnRlcmFjdGl2ZUxlZ2VuZCA9ICh7IHBheWxvYWQgfTogeyBwYXlsb2FkPzogYW55W10gfSkgPT4ge1xyXG4gICAgaWYgKCFwYXlsb2FkPy5sZW5ndGgpIHJldHVybiBudWxsXHJcblxyXG4gICAgcmV0dXJuIChcclxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGZsZXgtd3JhcCBnYXAtMiBwdC0yXCI+XHJcbiAgICAgICAge3BheWxvYWQubWFwKChlbnRyeTogYW55KSA9PiB7XHJcbiAgICAgICAgICBjb25zdCBkYXRhS2V5ID0gU3RyaW5nKGVudHJ5LmRhdGFLZXkgPz8gZW50cnkudmFsdWUgPz8gJycpXHJcbiAgICAgICAgICBjb25zdCBpc0hpZGRlbiA9IGhpZGRlbkRhaWx5Rmxvd1Nlcmllcy5pbmNsdWRlcyhkYXRhS2V5KVxyXG5cclxuICAgICAgICAgIHJldHVybiAoXHJcbiAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICBrZXk9e2RhdGFLZXl9XHJcbiAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gdG9nZ2xlRGFpbHlGbG93U2VyaWVzKGRhdGFLZXkpfVxyXG4gICAgICAgICAgICAgIGNsYXNzTmFtZT17YHB4LTIgcHktMSByb3VuZGVkLW1kIGJvcmRlciBib3JkZXItcHJpbWFyeSB0ZXh0LXhzIGZsZXggaXRlbXMtY2VudGVyIGdhcC0yIG1vdGlvbi1zdGFuZGFyZCBob3Zlci1saWZ0LXN1YnRsZSBwcmVzcy1zdWJ0bGUgZm9jdXM6b3V0bGluZS1ub25lIGZvY3VzOnJpbmctMiBmb2N1czpyaW5nLVt2YXIoLS1jb2xvci1mb2N1cyldICR7aXNIaWRkZW4gPyAnb3BhY2l0eS01MCBiZy1zZWNvbmRhcnkgdGV4dC1zZWNvbmRhcnknIDogJ2JnLXByaW1hcnkgdGV4dC1wcmltYXJ5J1xyXG4gICAgICAgICAgICAgICAgfWB9XHJcbiAgICAgICAgICAgICAgYXJpYS1wcmVzc2VkPXshaXNIaWRkZW59XHJcbiAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ3LTIuNSBoLTIuNSByb3VuZGVkLWZ1bGxcIiBzdHlsZT17eyBiYWNrZ3JvdW5kQ29sb3I6IGVudHJ5LmNvbG9yIH19IC8+XHJcbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1wcmltYXJ5XCI+e2VudHJ5LnZhbHVlfTwvc3Bhbj5cclxuICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICApXHJcbiAgICAgICAgfSl9XHJcbiAgICAgIDwvZGl2PlxyXG4gICAgKVxyXG4gIH1cclxuXHJcbiAgY29uc3QgaW50ZXJhY3RpdmVSb3dCdXR0b25DbGFzc2VzID1cclxuICAgICd3LWZ1bGwgcm91bmRlZC1sZyBib3JkZXIgYm9yZGVyLXByaW1hcnkgYmctc2Vjb25kYXJ5IHRleHQtcHJpbWFyeSBweC0zIHB5LTMgdGV4dC1sZWZ0IG1vdGlvbi1zdGFuZGFyZCBob3Zlci1saWZ0LXN1YnRsZSBwcmVzcy1zdWJ0bGUgaG92ZXI6YmctdGVydGlhcnkgZm9jdXM6b3V0bGluZS1ub25lIGZvY3VzOnJpbmctMiBmb2N1czpyaW5nLVt2YXIoLS1jb2xvci1mb2N1cyldJ1xyXG5cclxuICBjb25zdCBpbnNpZ2h0TmFycmF0aXZlTW9tZW50ID0gdXNlTWVtbygoKSA9PiB7XHJcbiAgICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpXHJcbiAgICBjb25zdCBjdXJyZW50TW9udGhLZXkgPSBmb3JtYXQobm93LCAneXl5eS1NTScpXHJcbiAgICBjb25zdCBpc0Nsb3NlZE1vbnRoID0gY3VycmVudE1vbnRoIDwgY3VycmVudE1vbnRoS2V5XHJcblxyXG4gICAgaWYgKGlzQ2xvc2VkTW9udGgpIHtcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBpc0ZpbmFsaXplZDogdHJ1ZSxcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChjdXJyZW50TW9udGggIT09IGN1cnJlbnRNb250aEtleSkge1xyXG4gICAgICByZXR1cm4ge1xyXG4gICAgICAgIGlzRmluYWxpemVkOiBmYWxzZSxcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IFt5ZWFyLCBtb250aF0gPSBjdXJyZW50TW9udGguc3BsaXQoJy0nKS5tYXAoTnVtYmVyKVxyXG4gICAgY29uc3QgZGF5c0luTW9udGggPSBuZXcgRGF0ZSh5ZWFyLCBtb250aCwgMCkuZ2V0RGF0ZSgpXHJcbiAgICBjb25zdCBpc0xhc3REYXkgPSBub3cuZ2V0RGF0ZSgpID49IGRheXNJbk1vbnRoXHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgaXNGaW5hbGl6ZWQ6IGlzTGFzdERheSxcclxuICAgIH1cclxuICB9LCBbY3VycmVudE1vbnRoXSlcclxuXHJcbiAgY29uc3QgbW9udGhseUluc2lnaHRzTmFycmF0aXZlID0gdXNlTWVtbygoKSA9PiB7XHJcbiAgICBpZiAoIW1vbnRobHlJbnNpZ2h0cy5sZW5ndGgpIHJldHVybiAnJ1xyXG5cclxuICAgIGNvbnN0IG5vcm1hbGl6ZWQgPSBtb250aGx5SW5zaWdodHNcclxuICAgICAgLm1hcCgoaXRlbSkgPT4gaXRlbS5yZXBsYWNlKC9cXHMrL2csICcgJykudHJpbSgpKVxyXG4gICAgICAuZmlsdGVyKEJvb2xlYW4pXHJcbiAgICAgIC5tYXAoKGl0ZW0pID0+ICgvWy4hP10kLy50ZXN0KGl0ZW0pID8gaXRlbSA6IGAke2l0ZW19LmApKVxyXG5cclxuICAgIGlmIChub3JtYWxpemVkLmxlbmd0aCA9PT0gMSkge1xyXG4gICAgICBjb25zdCBzaW5nbGUgPSBub3JtYWxpemVkWzBdLnJlcGxhY2UoL1suIT9dKyQvLCAnJylcclxuICAgICAgcmV0dXJuIGAke3NpbmdsZX0uYFxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHdpdGhvdXRUcmFpbGluZ0RvdCA9IG5vcm1hbGl6ZWQubWFwKChpdGVtKSA9PiBpdGVtLnJlcGxhY2UoL1suIT9dKyQvLCAnJykpXHJcbiAgICBjb25zdCBmaXJzdFNlbnRlbmNlID0gYCR7d2l0aG91dFRyYWlsaW5nRG90WzBdfS5gXHJcblxyXG4gICAgY29uc3QgdG9DbGF1c2VBZnRlckNvbm5lY3RvciA9ICh2YWx1ZTogc3RyaW5nKSA9PiB7XHJcbiAgICAgIGNvbnN0IHRleHQgPSB2YWx1ZS50cmltKClcclxuICAgICAgaWYgKCF0ZXh0KSByZXR1cm4gdGV4dFxyXG5cclxuICAgICAgY29uc3QgW2ZpcnN0Q2hhciwgLi4ucmVzdENoYXJzXSA9IHRleHRcclxuICAgICAgY29uc3QgcmVzdCA9IHJlc3RDaGFycy5qb2luKCcnKVxyXG4gICAgICByZXR1cm4gYCR7Zmlyc3RDaGFyLnRvTG93ZXJDYXNlKCl9JHtyZXN0fWBcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBzaW1wbGlmeUZvck1vYmlsZSA9ICh2YWx1ZTogc3RyaW5nKSA9PiB7XHJcbiAgICAgIGNvbnN0IGNvbXBhY3QgPSB2YWx1ZVxyXG4gICAgICAgIC5yZXBsYWNlKC9eQ29tIGJhc2Ugbm8gYW5kYW1lbnRvIGF0dWFsIGRvIG3DqnMsXFxzKi9pLCAnJylcclxuICAgICAgICAucmVwbGFjZSgvXk5vIG3DqnMgYW5hbGlzYWRvLFxccyovaSwgJycpXHJcbiAgICAgICAgLnJlcGxhY2UoL152YWxlIHJldmlzYXIgZXN0ZSBwb250bzpcXHMqL2ksICcnKVxyXG4gICAgICAgIC5yZXBsYWNlKC9cXHMrYXTDqSBvIG1vbWVudG8kL2ksICcnKVxyXG4gICAgICAgIC5yZXBsYWNlKC9cXHMrYXTDqSBhcXVpJC9pLCAnJylcclxuICAgICAgICAudHJpbSgpXHJcblxyXG4gICAgICBjb25zdCBmaXJzdENsYXVzZSA9IGNvbXBhY3Quc3BsaXQoL1s7Ol0vKVswXT8udHJpbSgpIHx8IGNvbXBhY3RcclxuICAgICAgcmV0dXJuIGZpcnN0Q2xhdXNlIHx8IGNvbXBhY3RcclxuICAgIH1cclxuXHJcbiAgICBpZiAoaXNNb2JpbGVWaWV3cG9ydCkge1xyXG4gICAgICBjb25zdCBmaXJzdE1vYmlsZVNlbnRlbmNlID0gc2ltcGxpZnlGb3JNb2JpbGUod2l0aG91dFRyYWlsaW5nRG90WzBdKVxyXG5cclxuICAgICAgaWYgKHdpdGhvdXRUcmFpbGluZ0RvdC5sZW5ndGggPT09IDEpIHtcclxuICAgICAgICByZXR1cm4gYCR7Zmlyc3RNb2JpbGVTZW50ZW5jZX0uYFxyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCBzZWNvbmRNb2JpbGVTZW50ZW5jZSA9IHNpbXBsaWZ5Rm9yTW9iaWxlKHdpdGhvdXRUcmFpbGluZ0RvdFsxXSlcclxuICAgICAgcmV0dXJuIGAke2ZpcnN0TW9iaWxlU2VudGVuY2V9LiAke3NlY29uZE1vYmlsZVNlbnRlbmNlfS5gXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHdpdGhvdXRUcmFpbGluZ0RvdC5sZW5ndGggPT09IDIpIHtcclxuICAgICAgcmV0dXJuIGluc2lnaHROYXJyYXRpdmVNb21lbnQuaXNGaW5hbGl6ZWRcclxuICAgICAgICA/IGAke2ZpcnN0U2VudGVuY2V9IEFsw6ltIGRpc3NvLCAke3RvQ2xhdXNlQWZ0ZXJDb25uZWN0b3Iod2l0aG91dFRyYWlsaW5nRG90WzFdKX0uYFxyXG4gICAgICAgIDogYCR7Zmlyc3RTZW50ZW5jZX0gQXTDqSBhcXVpLCAke3RvQ2xhdXNlQWZ0ZXJDb25uZWN0b3Iod2l0aG91dFRyYWlsaW5nRG90WzFdKX0uYFxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBpbnNpZ2h0TmFycmF0aXZlTW9tZW50LmlzRmluYWxpemVkXHJcbiAgICAgID8gYCR7Zmlyc3RTZW50ZW5jZX0gJHt3aXRob3V0VHJhaWxpbmdEb3RbMV19LiAke3dpdGhvdXRUcmFpbGluZ0RvdFsyXX0uYFxyXG4gICAgICA6IGAke2ZpcnN0U2VudGVuY2V9ICR7d2l0aG91dFRyYWlsaW5nRG90WzFdfS4gUGFyYSBvcyBwcsOzeGltb3MgZGlhcywgJHt0b0NsYXVzZUFmdGVyQ29ubmVjdG9yKHdpdGhvdXRUcmFpbGluZ0RvdFsyXSl9LmBcclxuICB9LCBbbW9udGhseUluc2lnaHRzLCBpbnNpZ2h0TmFycmF0aXZlTW9tZW50LmlzRmluYWxpemVkLCBpc01vYmlsZVZpZXdwb3J0XSlcclxuXHJcbiAgY29uc3Qgc2hvdWxkU2hvd01vbnRobHlJbnNpZ2h0c0NhcmQgPSBtb250aGx5SW5zaWdodHNFbmFibGVkICYmIGhhc01vbnRobHlEYXRhICYmIGlzT25saW5lXHJcblxyXG4gIGNvbnN0IG9wZW5RdWlja0FkZCA9ICh0eXBlOiBRdWlja0FkZFR5cGUpID0+IHtcclxuICAgIHNldFF1aWNrQWRkVHlwZSh0eXBlKVxyXG4gICAgc2V0Rm9ybURhdGEoe1xyXG4gICAgICBhbW91bnQ6ICcnLFxyXG4gICAgICByZXBvcnRfYW1vdW50OiAnJyxcclxuICAgICAgZGF0ZTogZm9ybWF0KG5ldyBEYXRlKCksICd5eXl5LU1NLWRkJyksXHJcbiAgICAgIGluc3RhbGxtZW50X3RvdGFsOiAnMScsXHJcbiAgICAgIHBheW1lbnRfbWV0aG9kOiAnb3RoZXInLFxyXG4gICAgICBjcmVkaXRfY2FyZF9pZDogJycsXHJcbiAgICAgIG1vbnRoOiBjdXJyZW50TW9udGgsXHJcbiAgICAgIGNhdGVnb3J5X2lkOiBjYXRlZ29yaWVzWzBdPy5pZCB8fCAnJyxcclxuICAgICAgaW5jb21lX2NhdGVnb3J5X2lkOiBpbmNvbWVDYXRlZ29yaWVzWzBdPy5pZCB8fCAnJyxcclxuICAgICAgZGVzY3JpcHRpb246ICcnLFxyXG4gICAgfSlcclxuICAgIHNldElzUXVpY2tBZGRPcGVuKHRydWUpXHJcbiAgfVxyXG5cclxuICBjb25zdCBjbG9zZVF1aWNrQWRkID0gKCkgPT4ge1xyXG4gICAgc2V0SXNRdWlja0FkZE9wZW4oZmFsc2UpXHJcbiAgfVxyXG5cclxuICBjb25zdCBxdWlja0FkZFRpdGxlID0gcXVpY2tBZGRUeXBlID09PSAnZXhwZW5zZSdcclxuICAgID8gJ05vdmEgZGVzcGVzYSdcclxuICAgIDogcXVpY2tBZGRUeXBlID09PSAnaW5jb21lJ1xyXG4gICAgICA/ICdOb3ZhIHJlbmRhJ1xyXG4gICAgICA6ICdOb3ZvIGludmVzdGltZW50bydcclxuXHJcbiAgY29uc3QgcGxheUFzc2lzdGFudEJlZXAgPSAodHlwZTogJ3N0YXJ0JyB8ICdlbmQnIHwgJ2hlYXJkJyB8ICdleGVjdXRlZCcgPSAnc3RhcnQnKSA9PiB7XHJcbiAgICBpZiAodHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcpIHJldHVyblxyXG5cclxuICAgIGNvbnN0IEF1ZGlvQ29udGV4dEN0b3IgPSAod2luZG93IGFzIGFueSkuQXVkaW9Db250ZXh0IHx8ICh3aW5kb3cgYXMgYW55KS53ZWJraXRBdWRpb0NvbnRleHRcclxuICAgIGlmICghQXVkaW9Db250ZXh0Q3RvcikgcmV0dXJuXHJcblxyXG4gICAgY29uc3QgY29udGV4dCA9IG5ldyBBdWRpb0NvbnRleHRDdG9yKClcclxuICAgIGNvbnN0IG9zY2lsbGF0b3IgPSBjb250ZXh0LmNyZWF0ZU9zY2lsbGF0b3IoKVxyXG4gICAgY29uc3QgZ2FpbiA9IGNvbnRleHQuY3JlYXRlR2FpbigpXHJcblxyXG4gICAgb3NjaWxsYXRvci50eXBlID0gJ3NpbmUnXHJcbiAgICBjb25zdCB0b25lTWFwOiBSZWNvcmQ8J3N0YXJ0JyB8ICdlbmQnIHwgJ2hlYXJkJyB8ICdleGVjdXRlZCcsIHsgc3RhcnQ6IG51bWJlcjsgZW5kOiBudW1iZXIgfT4gPSB7XHJcbiAgICAgIHN0YXJ0OiB7IHN0YXJ0OiA4ODAsIGVuZDogMTA0MCB9LFxyXG4gICAgICBlbmQ6IHsgc3RhcnQ6IDUyMCwgZW5kOiA0MjAgfSxcclxuICAgICAgaGVhcmQ6IHsgc3RhcnQ6IDcwMCwgZW5kOiA3NjAgfSxcclxuICAgICAgZXhlY3V0ZWQ6IHsgc3RhcnQ6IDk4MCwgZW5kOiAxMTgwIH0sXHJcbiAgICB9XHJcblxyXG4gICAgY29uc3Qgc3RhcnRGcmVxdWVuY3kgPSB0b25lTWFwW3R5cGVdLnN0YXJ0XHJcbiAgICBjb25zdCBlbmRGcmVxdWVuY3kgPSB0b25lTWFwW3R5cGVdLmVuZFxyXG4gICAgb3NjaWxsYXRvci5mcmVxdWVuY3kuc2V0VmFsdWVBdFRpbWUoc3RhcnRGcmVxdWVuY3ksIGNvbnRleHQuY3VycmVudFRpbWUpXHJcbiAgICBvc2NpbGxhdG9yLmZyZXF1ZW5jeS5leHBvbmVudGlhbFJhbXBUb1ZhbHVlQXRUaW1lKGVuZEZyZXF1ZW5jeSwgY29udGV4dC5jdXJyZW50VGltZSArIDAuMTQpXHJcbiAgICBnYWluLmdhaW4uc2V0VmFsdWVBdFRpbWUoMC4wMDEsIGNvbnRleHQuY3VycmVudFRpbWUpXHJcbiAgICBnYWluLmdhaW4uZXhwb25lbnRpYWxSYW1wVG9WYWx1ZUF0VGltZSgwLjEyLCBjb250ZXh0LmN1cnJlbnRUaW1lICsgMC4wMSlcclxuICAgIGdhaW4uZ2Fpbi5leHBvbmVudGlhbFJhbXBUb1ZhbHVlQXRUaW1lKDAuMDAxLCBjb250ZXh0LmN1cnJlbnRUaW1lICsgMC4xNClcclxuXHJcbiAgICBvc2NpbGxhdG9yLmNvbm5lY3QoZ2FpbilcclxuICAgIGdhaW4uY29ubmVjdChjb250ZXh0LmRlc3RpbmF0aW9uKVxyXG4gICAgb3NjaWxsYXRvci5zdGFydCgpXHJcbiAgICBvc2NpbGxhdG9yLnN0b3AoY29udGV4dC5jdXJyZW50VGltZSArIDAuMTQpXHJcblxyXG4gICAgb3NjaWxsYXRvci5vbmVuZGVkID0gKCkgPT4ge1xyXG4gICAgICBjb250ZXh0LmNsb3NlKCkuY2F0Y2goKCkgPT4gdW5kZWZpbmVkKVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgY29uc3Qgb3BlbkFzc2lzdGFudCA9ICgpID0+IHtcclxuICAgIHJlc2V0QXNzaXN0YW50VHVybigpXHJcbiAgICBzZXRJc0Fzc2lzdGFudE9wZW4odHJ1ZSlcclxuICAgIGNsZWFyVm9pY2VGZWVkYmFjaygpXHJcbiAgICB2b2lkIGhhbmRsZVZvaWNlSW50ZXJwcmV0KClcclxuICB9XHJcblxyXG4gIGNvbnN0IGNsb3NlQXNzaXN0YW50ID0gKCkgPT4ge1xyXG4gICAgc3RvcEFjdGl2ZUxpc3RlbmluZygpXHJcbiAgICBzdG9wU3BlYWtpbmcoKVxyXG4gICAgc2V0SXNBc3Npc3RhbnRPcGVuKGZhbHNlKVxyXG4gICAgY2xlYXJWb2ljZUZlZWRiYWNrKClcclxuICAgIHJlc2V0QXNzaXN0YW50VHVybigpXHJcbiAgfVxyXG5cclxuICBjb25zdCBpc0V4cGVuc2VJbnRlbnQgPSBsYXN0SW50ZXJwcmV0YXRpb24/LmludGVudCA9PT0gJ2FkZF9leHBlbnNlJ1xyXG4gIGNvbnN0IHRvdWNoQ29uZmlybWF0aW9uRW5hYmxlZCA9IGFzc2lzdGFudENvbmZpcm1hdGlvbk1vZGUgIT09ICd2b2ljZScgfHwgaXNFeHBlbnNlSW50ZW50XHJcbiAgY29uc3Qgdm9pY2VDb25maXJtYXRpb25FbmFibGVkID0gYXNzaXN0YW50Q29uZmlybWF0aW9uTW9kZSAhPT0gJ3RvdWNoJyAmJiAhaXNFeHBlbnNlSW50ZW50XHJcbiAgY29uc3QgYWN0aW9uQ29sdW1uc0NsYXNzID0gdG91Y2hDb25maXJtYXRpb25FbmFibGVkICYmIHZvaWNlQ29uZmlybWF0aW9uRW5hYmxlZFxyXG4gICAgPyAnc206Z3JpZC1jb2xzLTMnXHJcbiAgICA6ICdzbTpncmlkLWNvbHMtMidcclxuXHJcbiAgY29uc3QgaGFuZGxlQ29uZmlybUFzc2lzdGFudCA9IGFzeW5jIChjb25maXJtZWQ6IGJvb2xlYW4pID0+IHtcclxuICAgIGlmICghaXNTdXBhYmFzZUNvbmZpZ3VyZWQpIHJldHVyblxyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY29uZmlybUxhc3RJbnRlcnByZXRhdGlvbih7IGNvbmZpcm1lZCB9KVxyXG4gICAgICBpZiAoIXJlc3VsdCkgcmV0dXJuXHJcblxyXG4gICAgICAvLyBTw7MgZmVjaGEgc2UgZm9pIGV4ZWN1dGFkbyBjb20gc3VjZXNzbyBvdSBzZSBvIHVzdcOhcmlvIG5lZ291IGV4cGxpY2l0YW1lbnRlXHJcbiAgICAgIGlmIChyZXN1bHQuc3RhdHVzID09PSAnZXhlY3V0ZWQnIHx8IHJlc3VsdC5zdGF0dXMgPT09ICdkZW5pZWQnKSB7XHJcbiAgICAgICAgaWYgKHJlc3VsdC5zdGF0dXMgPT09ICdleGVjdXRlZCcpIHtcclxuICAgICAgICAgIHBsYXlBc3Npc3RhbnRCZWVwKCdleGVjdXRlZCcpXHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNsb3NlQXNzaXN0YW50KClcclxuICAgICAgfVxyXG4gICAgICAvLyBTZSBzdGF0dXMgZm9yICdmYWlsZWQnIHBvciBleGVtcGxvLCBtYW50ZW1vcyBhYmVydG8gcGFyYSBvIGVycm8gc2VyIHZpc8OtdmVsXHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKCdbRGFzaGJvYXJkXSBFcnJvciBjb25maXJtaW5nIGFzc2lzdGFudDonLCBlcnJvcilcclxuICAgICAgLy8gTyBlcnJvIGrDoSBkZXZlIHNlciBjYXB0dXJhZG8gcGVsbyB1c2VBc3Npc3RhbnQgZSBleGliaWRvIG5vIGFzc2lzdGVudGVcclxuICAgICAgLy8gbWFzIGdhcmFudGltb3MgcXVlIGEgVUkgbsOjbyB0cmF2ZVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgY29uc3QgaGFuZGxlVm9pY2VJbnRlcnByZXQgPSBhc3luYyAoKSA9PiB7XHJcbiAgICBpZiAoIWlzU3VwYWJhc2VDb25maWd1cmVkIHx8IGFzc2lzdGFudExvYWRpbmcpIHJldHVyblxyXG5cclxuICAgIGlmICh2b2ljZUxpc3RlbmluZykge1xyXG4gICAgICBzdG9wQWN0aXZlTGlzdGVuaW5nKClcclxuICAgICAgcmV0dXJuXHJcbiAgICB9XHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgcGxheUFzc2lzdGFudEJlZXAoKVxyXG4gICAgICBjb25zdCB0cmFuc2NyaXB0ID0gYXdhaXQgY2FwdHVyZVNwZWVjaCgnRmFsZSBzZXUgY29tYW5kbycpXHJcbiAgICAgIGlmICghdHJhbnNjcmlwdCkgcmV0dXJuXHJcblxyXG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBpbnRlcnByZXRDb21tYW5kKHRyYW5zY3JpcHQsIHtcclxuICAgICAgICBjb25maXJtYXRpb25Nb2RlOiBhc3Npc3RhbnRDb25maXJtYXRpb25Qb2xpY3lNb2RlLFxyXG4gICAgICAgIGZvcmNlQ29uZmlybWF0aW9uOiBhc3Npc3RhbnREb3VibGVDb25maXJtYXRpb25FbmFibGVkLFxyXG4gICAgICB9KVxyXG4gICAgICBpZiAoIXJlc3VsdCkgcmV0dXJuXHJcbiAgICAgIGlmICghcmVzdWx0LnJlcXVpcmVzQ29uZmlybWF0aW9uKSB7XHJcbiAgICAgICAgcGxheUFzc2lzdGFudEJlZXAoJ2V4ZWN1dGVkJylcclxuICAgICAgfVxyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgc2V0Vm9pY2VTdGF0dXMoZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiAnRXJybyBhbyBpbnRlcnByZXRhciBjb21hbmRvIHBvciB2b3ouJylcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGNvbnN0IGhhbmRsZVZvaWNlQ29uZmlybSA9IGFzeW5jICgpID0+IHtcclxuICAgIGlmICghaXNTdXBhYmFzZUNvbmZpZ3VyZWQgfHwgYXNzaXN0YW50TG9hZGluZyB8fCAhbGFzdEludGVycHJldGF0aW9uPy5jb21tYW5kLmlkKSByZXR1cm5cclxuICAgIGlmICghdm9pY2VDb25maXJtYXRpb25FbmFibGVkKSB7XHJcbiAgICAgIHNldFZvaWNlU3RhdHVzKCdDb25maXJtYcOnw6NvIHBvciB2b3ogZXN0w6EgZGVzYXRpdmFkYSBuYXMgc3VhcyBjb25maWd1cmHDp8O1ZXMuJylcclxuICAgICAgcmV0dXJuXHJcbiAgICB9XHJcbiAgICAvLyBQZXJtaXRlIGNvbmZpcm1hw6fDo28gcG9yIHZveiBwYXJhIHRvZG9zIG9zIHRpcG9zIGFnb3JhLCBwYXJhIG1haW9yIGZsZXhpYmlsaWRhZGVcclxuXHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCB0cmFuc2NyaXB0ID0gYXdhaXQgY2FwdHVyZVNwZWVjaCgnQ29uZmlybWUgcG9yIHZveicpXHJcbiAgICAgIGlmICghdHJhbnNjcmlwdCkgcmV0dXJuXHJcblxyXG4gICAgICBjb25zdCBjb25maXJtZWQgPSByZXNvbHZlVm9pY2VDb25maXJtYXRpb24odHJhbnNjcmlwdClcclxuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY29uZmlybUxhc3RJbnRlcnByZXRhdGlvbih7XHJcbiAgICAgICAgY29uZmlybWVkLFxyXG4gICAgICAgIHNwb2tlblRleHQ6IHRyYW5zY3JpcHQsXHJcbiAgICAgICAgaW5jbHVkZUVkaXRhYmxlOiBmYWxzZSxcclxuICAgICAgfSlcclxuICAgICAgaWYgKCFyZXN1bHQpIHJldHVyblxyXG4gICAgICBpZiAocmVzdWx0LnN0YXR1cyA9PT0gJ2V4ZWN1dGVkJykge1xyXG4gICAgICAgIHBsYXlBc3Npc3RhbnRCZWVwKCdleGVjdXRlZCcpXHJcbiAgICAgIH1cclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIHNldFZvaWNlU3RhdHVzKGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogJ0Vycm8gYW8gY29uZmlybWFyIHBvciB2b3ouJylcclxuICAgIH1cclxuICB9XHJcblxyXG4gIGNvbnN0IGhhbmRsZVF1aWNrQWRkU3VibWl0ID0gYXN5bmMgKGV2ZW50OiBSZWFjdC5Gb3JtRXZlbnQpID0+IHtcclxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KClcclxuXHJcbiAgICBjb25zdCBhbW91bnQgPSBwYXJzZU1vbmV5SW5wdXQoZm9ybURhdGEuYW1vdW50KVxyXG4gICAgaWYgKCFhbW91bnQgfHwgYW1vdW50IDw9IDApIHtcclxuICAgICAgYWxlcnQoJ0luc2lyYSB1bSB2YWxvciB2w6FsaWRvIG1haW9yIHF1ZSB6ZXJvLicpXHJcbiAgICAgIHJldHVyblxyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHJlcG9ydEFtb3VudCA9IGZvcm1EYXRhLnJlcG9ydF9hbW91bnQgPyBwYXJzZU1vbmV5SW5wdXQoZm9ybURhdGEucmVwb3J0X2Ftb3VudCkgOiBhbW91bnRcclxuICAgIGlmIChxdWlja0FkZFR5cGUgIT09ICdpbnZlc3RtZW50JyAmJiAoTnVtYmVyLmlzTmFOKHJlcG9ydEFtb3VudCkgfHwgcmVwb3J0QW1vdW50IDwgMCB8fCByZXBvcnRBbW91bnQgPiBhbW91bnQpKSB7XHJcbiAgICAgIGFsZXJ0KCdPIHZhbG9yIG5vIHJlbGF0w7NyaW8gZGV2ZSBlc3RhciBlbnRyZSAwIGUgbyB2YWxvciB0b3RhbC4nKVxyXG4gICAgICByZXR1cm5cclxuICAgIH1cclxuXHJcbiAgICBjb25zdCByZXBvcnRXZWlnaHQgPSBhbW91bnQgPiAwID8gTnVtYmVyKChyZXBvcnRBbW91bnQgLyBhbW91bnQpLnRvRml4ZWQoNCkpIDogMVxyXG4gICAgY29uc3QgcmF3SW5zdGFsbG1lbnRzID0gTnVtYmVyKGZvcm1EYXRhLmluc3RhbGxtZW50X3RvdGFsIHx8ICcxJylcclxuICAgIGNvbnN0IGluc3RhbGxtZW50VG90YWwgPSBNYXRoLm1heCgxLCBNYXRoLm1pbig2MCwgcmF3SW5zdGFsbG1lbnRzKSlcclxuXHJcbiAgICBpZiAocXVpY2tBZGRUeXBlID09PSAnZXhwZW5zZScgJiYgKCFOdW1iZXIuaXNJbnRlZ2VyKHJhd0luc3RhbGxtZW50cykgfHwgcmF3SW5zdGFsbG1lbnRzIDwgMSkpIHtcclxuICAgICAgYWxlcnQoJ0luZm9ybWUgdW0gbsO6bWVybyB2w6FsaWRvIGRlIHBhcmNlbGFzIChtw61uaW1vIDEpLicpXHJcbiAgICAgIHJldHVyblxyXG4gICAgfVxyXG5cclxuICAgIGlmIChxdWlja0FkZFR5cGUgPT09ICdleHBlbnNlJyAmJiBmb3JtRGF0YS5wYXltZW50X21ldGhvZCA9PT0gJ2NyZWRpdF9jYXJkJyAmJiAhZm9ybURhdGEuY3JlZGl0X2NhcmRfaWQpIHtcclxuICAgICAgYWxlcnQoJ1NlbGVjaW9uZSB1bSBjYXJ0w6NvIGRlIGNyw6lkaXRvIHBhcmEgY29tcHJhcyBubyBjcsOpZGl0by4nKVxyXG4gICAgICByZXR1cm5cclxuICAgIH1cclxuXHJcbiAgICBpZiAocXVpY2tBZGRUeXBlID09PSAnZXhwZW5zZScpIHtcclxuICAgICAgaWYgKCFmb3JtRGF0YS5jYXRlZ29yeV9pZCkge1xyXG4gICAgICAgIGFsZXJ0KCdTZWxlY2lvbmUgdW1hIGNhdGVnb3JpYSBkZSBkZXNwZXNhLicpXHJcbiAgICAgICAgcmV0dXJuXHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IHsgZXJyb3IgfSA9IGF3YWl0IGNyZWF0ZUV4cGVuc2Uoe1xyXG4gICAgICAgIGFtb3VudCxcclxuICAgICAgICByZXBvcnRfd2VpZ2h0OiByZXBvcnRXZWlnaHQsXHJcbiAgICAgICAgZGF0ZTogZm9ybURhdGEuZGF0ZSxcclxuICAgICAgICBpbnN0YWxsbWVudF90b3RhbDogaW5zdGFsbG1lbnRUb3RhbCxcclxuICAgICAgICBwYXltZW50X21ldGhvZDogZm9ybURhdGEucGF5bWVudF9tZXRob2QgYXMgJ2Nhc2gnIHwgJ2RlYml0JyB8ICdjcmVkaXRfY2FyZCcgfCAncGl4JyB8ICd0cmFuc2ZlcicgfCAnb3RoZXInLFxyXG4gICAgICAgIGNyZWRpdF9jYXJkX2lkOiBmb3JtRGF0YS5wYXltZW50X21ldGhvZCA9PT0gJ2NyZWRpdF9jYXJkJyA/IGZvcm1EYXRhLmNyZWRpdF9jYXJkX2lkIDogbnVsbCxcclxuICAgICAgICBjYXRlZ29yeV9pZDogZm9ybURhdGEuY2F0ZWdvcnlfaWQsXHJcbiAgICAgICAgLi4uKGZvcm1EYXRhLmRlc2NyaXB0aW9uICYmIHsgZGVzY3JpcHRpb246IGZvcm1EYXRhLmRlc2NyaXB0aW9uIH0pLFxyXG4gICAgICB9KVxyXG5cclxuICAgICAgaWYgKGVycm9yKSB7XHJcbiAgICAgICAgYWxlcnQoYEVycm8gYW8gY3JpYXIgZGVzcGVzYTogJHtlcnJvcn1gKVxyXG4gICAgICAgIHJldHVyblxyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHF1aWNrQWRkVHlwZSA9PT0gJ2luY29tZScpIHtcclxuICAgICAgaWYgKCFmb3JtRGF0YS5pbmNvbWVfY2F0ZWdvcnlfaWQpIHtcclxuICAgICAgICBhbGVydCgnU2VsZWNpb25lIHVtYSBjYXRlZ29yaWEgZGUgcmVuZGEuJylcclxuICAgICAgICByZXR1cm5cclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgeyBlcnJvciB9ID0gYXdhaXQgY3JlYXRlSW5jb21lKHtcclxuICAgICAgICBhbW91bnQsXHJcbiAgICAgICAgcmVwb3J0X3dlaWdodDogcmVwb3J0V2VpZ2h0LFxyXG4gICAgICAgIGRhdGU6IGZvcm1EYXRhLmRhdGUsXHJcbiAgICAgICAgaW5jb21lX2NhdGVnb3J5X2lkOiBmb3JtRGF0YS5pbmNvbWVfY2F0ZWdvcnlfaWQsXHJcbiAgICAgICAgLi4uKGZvcm1EYXRhLmRlc2NyaXB0aW9uICYmIHsgZGVzY3JpcHRpb246IGZvcm1EYXRhLmRlc2NyaXB0aW9uIH0pLFxyXG4gICAgICB9KVxyXG5cclxuICAgICAgaWYgKGVycm9yKSB7XHJcbiAgICAgICAgYWxlcnQoYEVycm8gYW8gY3JpYXIgcmVuZGE6ICR7ZXJyb3J9YClcclxuICAgICAgICByZXR1cm5cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChxdWlja0FkZFR5cGUgPT09ICdpbnZlc3RtZW50Jykge1xyXG4gICAgICBjb25zdCBzZWxlY3RlZERhdGUgPSBmb3JtRGF0YS5kYXRlIHx8IGZvcm1hdChuZXcgRGF0ZSgpLCAneXl5eS1NTS1kZCcpXHJcbiAgICAgIGNvbnN0IHsgZXJyb3IgfSA9IGF3YWl0IGNyZWF0ZUludmVzdG1lbnQoe1xyXG4gICAgICAgIGFtb3VudCxcclxuICAgICAgICBtb250aDogc2VsZWN0ZWREYXRlLnN1YnN0cmluZygwLCA3KSxcclxuICAgICAgICAuLi4oZm9ybURhdGEuZGVzY3JpcHRpb24gJiYgeyBkZXNjcmlwdGlvbjogZm9ybURhdGEuZGVzY3JpcHRpb24gfSksXHJcbiAgICAgIH0pXHJcblxyXG4gICAgICBpZiAoZXJyb3IpIHtcclxuICAgICAgICBhbGVydChgRXJybyBhbyBjcmlhciBpbnZlc3RpbWVudG86ICR7ZXJyb3J9YClcclxuICAgICAgICByZXR1cm5cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGNsb3NlUXVpY2tBZGQoKVxyXG4gICAgcmVmcmVzaEV4cGVuc2VzKClcclxuICAgIHJlZnJlc2hJbmNvbWVzKClcclxuICAgIHJlZnJlc2hJbnZlc3RtZW50cygpXHJcbiAgfVxyXG5cclxuICByZXR1cm4gKFxyXG4gICAgPGRpdj5cclxuICAgICAgey8qIEFQSSBlcnJvciB0b2FzdCDigJMgc3VidGxlLCBib3R0b20tcmlnaHQsIGF1dG8tZGlzbWlzc2FibGUgKi99XHJcbiAgICAgIHtpbnNpZ2h0VG9hc3RFcnJvciAmJiAoXHJcbiAgICAgICAgPGRpdlxyXG4gICAgICAgICAgcm9sZT1cImFsZXJ0XCJcclxuICAgICAgICAgIGNsYXNzTmFtZT1cImZpeGVkIGJvdHRvbS00IHJpZ2h0LTQgei01MCBtYXgtdy14cyB3LWZ1bGwgYmctc2Vjb25kYXJ5IGJvcmRlciBib3JkZXItcHJpbWFyeSByb3VuZGVkLXhsIHNoYWRvdy1sZyBweC00IHB5LTMgZmxleCBpdGVtcy1zdGFydCBnYXAtMyBhbmltYXRlLWZhZGUtaW5cIlxyXG4gICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0SW5zaWdodFRvYXN0RXJyb3IobnVsbCl9XHJcbiAgICAgICAgPlxyXG4gICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LXNlY29uZGFyeSBsZWFkaW5nLXJlbGF4ZWQgZmxleC0xIGN1cnNvci1wb2ludGVyXCI+XHJcbiAgICAgICAgICAgIOKaoO+4jyB7aW5zaWdodFRvYXN0RXJyb3J9XHJcbiAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICA8YnV0dG9uXHJcbiAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgICBjbGFzc05hbWU9XCJ0ZXh0LXNlY29uZGFyeSBob3Zlcjp0ZXh0LXByaW1hcnkgZmxleC1zaHJpbmstMCBtdC0wLjVcIlxyXG4gICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRJbnNpZ2h0VG9hc3RFcnJvcihudWxsKX1cclxuICAgICAgICAgICAgYXJpYS1sYWJlbD1cIkZlY2hhciBub3RpZmljYcOnw6NvXCJcclxuICAgICAgICAgID5cclxuICAgICAgICAgICAg4pyVXHJcbiAgICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgKX1cclxuXHJcbiAgICAgIDxQYWdlSGVhZGVyXHJcbiAgICAgICAgdGl0bGU9e1BBR0VfSEVBREVSUy5kYXNoYm9hcmQudGl0bGV9XHJcbiAgICAgICAgc3VidGl0bGU9e1BBR0VfSEVBREVSUy5kYXNoYm9hcmQuZGVzY3JpcHRpb259XHJcbiAgICAgICAgYWN0aW9uPXtcclxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIj5cclxuICAgICAgICAgICAge2lzT25saW5lICYmIChcclxuICAgICAgICAgICAgICA8QnV0dG9uXHJcbiAgICAgICAgICAgICAgICBzaXplPVwic21cIlxyXG4gICAgICAgICAgICAgICAgdmFyaWFudD1cIm91dGxpbmVcIlxyXG4gICAgICAgICAgICAgICAgb25DbGljaz17b3BlbkFzc2lzdGFudH1cclxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0yXCJcclxuICAgICAgICAgICAgICAgIGFyaWEtbGFiZWw9XCJBc3Npc3RlbnRlXCJcclxuICAgICAgICAgICAgICAgIHRpdGxlPVwiQXNzaXN0ZW50ZVwiXHJcbiAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgPFNwYXJrbGVzIHNpemU9ezE2fSAvPlxyXG4gICAgICAgICAgICAgIDwvQnV0dG9uPlxyXG4gICAgICAgICAgICApfVxyXG4gICAgICAgICAgICA8QnV0dG9uXHJcbiAgICAgICAgICAgICAgc2l6ZT1cInNtXCJcclxuICAgICAgICAgICAgICB2YXJpYW50PVwib3V0bGluZVwiXHJcbiAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gb3BlblF1aWNrQWRkKCdleHBlbnNlJyl9XHJcbiAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTJcIlxyXG4gICAgICAgICAgICAgIGRpc2FibGVkPXtjYXRlZ29yaWVzLmxlbmd0aCA9PT0gMCAmJiBpbmNvbWVDYXRlZ29yaWVzLmxlbmd0aCA9PT0gMH1cclxuICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgIDxQbHVzIHNpemU9ezE2fSAvPlxyXG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImhpZGRlbiBzbTppbmxpbmVcIj5MYW7Dp2FtZW50bzwvc3Bhbj5cclxuICAgICAgICAgICAgPC9CdXR0b24+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICB9XHJcbiAgICAgIC8+XHJcblxyXG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cInAtNCBsZzpwLTZcIj5cclxuICAgICAgICA8TW9udGhTZWxlY3RvciB2YWx1ZT17Y3VycmVudE1vbnRofSBvbkNoYW5nZT17c2V0Q3VycmVudE1vbnRofSAvPlxyXG5cclxuICAgICAgICB7LyogQ29udGVudCBhcmVhOiBmYWRlcyBpbi9vdXQgYXRvbWljYWxseSB3aGVuIG1vbnRoIGNoYW5nZXMgKi99XHJcbiAgICAgICAgPGRpdlxyXG4gICAgICAgICAgc3R5bGU9e3tcclxuICAgICAgICAgICAgb3BhY2l0eTogaXNNb250aFRyYW5zaXRpb25pbmcgPyAwIDogMSxcclxuICAgICAgICAgICAgdHJhbnNpdGlvbjogJ29wYWNpdHkgMTUwbXMgZWFzZS1pbi1vdXQnLFxyXG4gICAgICAgICAgICB3aWxsQ2hhbmdlOiAnb3BhY2l0eScsXHJcbiAgICAgICAgICB9fVxyXG4gICAgICAgID5cclxuXHJcbiAgICAgICAgICB7c2hvdWxkU2hvd01vbnRobHlJbnNpZ2h0c0NhcmQgJiYgKFxyXG4gICAgICAgICAgICA8Q2FyZCBjbGFzc05hbWU9XCJtdC00IGxnOm10LTYgYW5pbWF0ZS1pbnNpZ2h0LWVudGVyXCI+XHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTRcIj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIGdhcC00XCI+XHJcbiAgICAgICAgICAgICAgICAgIDxoMyBjbGFzc05hbWU9XCJ0ZXh0LWxnIGZvbnQtc2VtaWJvbGQgdGV4dC1wcmltYXJ5XCI+SW5zaWdodHMgcGVyc29uYWxpemFkb3MgZG8gbcOqczwvaDM+XHJcbiAgICAgICAgICAgICAgICAgIDxidXR0b25cclxuICAgICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXtoYW5kbGVSZWZyZXNoSW5zaWdodHN9XHJcbiAgICAgICAgICAgICAgICAgICAgZGlzYWJsZWQ9e2luc2lnaHRzTG9hZGluZ31cclxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2BwLTIgcm91bmRlZC1sZyBib3JkZXIgYm9yZGVyLXByaW1hcnkgYmctc2Vjb25kYXJ5IHRleHQtcHJpbWFyeSBtb3Rpb24tc3RhbmRhcmQgaG92ZXItbGlmdC1zdWJ0bGUgcHJlc3Mtc3VidGxlIGhvdmVyOmJnLXRlcnRpYXJ5IGZvY3VzOm91dGxpbmUtbm9uZSBmb2N1czpyaW5nLTIgZm9jdXM6cmluZy1bdmFyKC0tY29sb3ItZm9jdXMpXSBkaXNhYmxlZDpvcGFjaXR5LTUwICR7aW5zaWdodHNMb2FkaW5nID8gJ2FuaW1hdGUtc3BpbicgOiAnJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgfWB9XHJcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU9XCJGb3LDp2FyIGF0dWFsaXphw6fDo28gZG9zIGluc2lnaHRzXCJcclxuICAgICAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgICAgIDxSZWZyZXNoQ3cgc2l6ZT17MTZ9IC8+XHJcbiAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0cmFuc2l0aW9uLW9wYWNpdHkgZHVyYXRpb24tMzAwXCIgc3R5bGU9e3sgb3BhY2l0eTogaW5zaWdodHNMb2FkaW5nID8gMC40IDogMSB9fT5cclxuICAgICAgICAgICAgICAgICAgeyhpbnNpZ2h0c0xvYWRpbmcgfHwgaXNNb250aFRyYW5zaXRpb25pbmcpID8gKFxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTMgcHktMiBhbmltYXRlLXB1bHNlXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInctMS41IGgtMTAgcm91bmRlZC1mdWxsIGJnLXRlcnRpYXJ5XCIgLz5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleC0xIHNwYWNlLXktMlwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImgtNCBiZy10ZXJ0aWFyeSByb3VuZGVkIHctMy80XCIgLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJoLTMgYmctdGVydGlhcnkgcm91bmRlZCB3LTEvMlwiIC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgKSA6IG1vbnRobHlJbnNpZ2h0c05hcnJhdGl2ZS5sZW5ndGggPiAwID8gKFxyXG4gICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtc20gdGV4dC1wcmltYXJ5IGxlYWRpbmctcmVsYXhlZFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAge21vbnRobHlJbnNpZ2h0c05hcnJhdGl2ZX1cclxuICAgICAgICAgICAgICAgICAgICA8L3A+XHJcbiAgICAgICAgICAgICAgICAgICkgOiAoXHJcbiAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1zbSB0ZXh0LXNlY29uZGFyeSBsZWFkaW5nLXJlbGF4ZWQgaXRhbGljXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICBOZW5odW0gaW5zaWdodCBnZXJhZG8gcGFyYSBlc3RlIG3DqnMuIENsaXF1ZSBlbSDihrsgcGFyYSBnZXJhciBhZ29yYS5cclxuICAgICAgICAgICAgICAgICAgICA8L3A+XHJcbiAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPC9DYXJkPlxyXG4gICAgICAgICAgKX1cclxuXHJcbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT17c2hvdWxkU2hvd01vbnRobHlJbnNpZ2h0c0NhcmQgPyAnbXQtNCBsZzptdC02JyA6ICdtdC0zIGxnOm10LTQnfT5cclxuXHJcbiAgICAgICAgICAgIHtsb2FkaW5nID8gKFxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1jZW50ZXIgcHktOCB0ZXh0LXNlY29uZGFyeVwiPkNhcnJlZ2FuZG8uLi48L2Rpdj5cclxuICAgICAgICAgICAgKSA6ICFoYXNNb250aGx5RGF0YSA/IChcclxuICAgICAgICAgICAgICA8Q2FyZD5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1jZW50ZXIgcHktOFwiPlxyXG4gICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LWJhc2UgdGV4dC1wcmltYXJ5IGZvbnQtbWVkaXVtXCI+QWRpY2lvbmUgbyBwcmltZWlybyBsYW7Dp2FtZW50byBkbyBtw6pzLjwvcD5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDwvQ2FyZD5cclxuICAgICAgICAgICAgKSA6IChcclxuICAgICAgICAgICAgICA8PlxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJncmlkIGdyaWQtY29scy0xIHNtOmdyaWQtY29scy0yIGxnOmdyaWQtY29scy00IGdhcC00IGl0ZW1zLXN0cmV0Y2hcIj5cclxuICAgICAgICAgICAgICAgICAgPENhcmQgY2xhc3NOYW1lPVwiaC1mdWxsXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW5cIj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleC0xXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtc20gdGV4dC1zZWNvbmRhcnlcIj5SZW5kYXM8L3A+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtMnhsIGZvbnQtYm9sZCBtdC0xXCIgc3R5bGU9e3sgY29sb3I6ICd2YXIoLS1jb2xvci1pbmNvbWUpJyB9fT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICB7Zm9ybWF0Q3VycmVuY3kodG90YWxJbmNvbWVzKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9wPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8VHJlbmRpbmdVcCBjbGFzc05hbWU9XCJmbGV4LXNocmluay0wIG1sLTJcIiBzaXplPXsyNH0gc3R5bGU9e3sgY29sb3I6ICd2YXIoLS1jb2xvci1pbmNvbWUpJyB9fSAvPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8L0NhcmQ+XHJcblxyXG4gICAgICAgICAgICAgICAgICA8Q2FyZCBjbGFzc05hbWU9XCJoLWZ1bGxcIj5cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlblwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4LTFcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1zbSB0ZXh0LXNlY29uZGFyeVwiPkRlc3Blc2FzPC9wPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LTJ4bCBmb250LWJvbGQgbXQtMVwiIHN0eWxlPXt7IGNvbG9yOiAndmFyKC0tY29sb3ItZXhwZW5zZSknIH19PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHtmb3JtYXRDdXJyZW5jeSh0b3RhbEV4cGVuc2VzKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9wPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8VHJlbmRpbmdEb3duIGNsYXNzTmFtZT1cImZsZXgtc2hyaW5rLTAgbWwtMlwiIHNpemU9ezI0fSBzdHlsZT17eyBjb2xvcjogJ3ZhcigtLWNvbG9yLWV4cGVuc2UpJyB9fSAvPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICA8L0NhcmQ+XHJcblxyXG4gICAgICAgICAgICAgICAgICA8Q2FyZCBjbGFzc05hbWU9XCJoLWZ1bGxcIj5cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlblwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4LTFcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1zbSB0ZXh0LXNlY29uZGFyeVwiPkludmVzdGltZW50b3M8L3A+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtMnhsIGZvbnQtYm9sZCBtdC0xXCIgc3R5bGU9e3sgY29sb3I6ICd2YXIoLS1jb2xvci1iYWxhbmNlKScgfX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAge2Zvcm1hdEN1cnJlbmN5KHRvdGFsSW52ZXN0bWVudHMpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L3A+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxQaWdneUJhbmsgY2xhc3NOYW1lPVwiZmxleC1zaHJpbmstMCBtbC0yXCIgc2l6ZT17MjR9IHN0eWxlPXt7IGNvbG9yOiAndmFyKC0tY29sb3ItYmFsYW5jZSknIH19IC8+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDwvQ2FyZD5cclxuXHJcbiAgICAgICAgICAgICAgICAgIDxDYXJkIGNsYXNzTmFtZT1cImgtZnVsbFwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgtMVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXNtIHRleHQtc2Vjb25kYXJ5XCI+U2FsZG88L3A+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxwXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidGV4dC0yeGwgZm9udC1ib2xkIG10LTFcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlPXt7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xvcjogYmFsYW5jZSA+PSAwID8gJ3ZhcigtLWNvbG9yLWluY29tZSknIDogJ3ZhcigtLWNvbG9yLWV4cGVuc2UpJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICB9fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAge2Zvcm1hdEN1cnJlbmN5KGJhbGFuY2UpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L3A+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgPC9DYXJkPlxyXG4gICAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtdC00IHNwYWNlLXktNFwiPlxyXG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImdyaWQgZ3JpZC1jb2xzLTEgeGw6Z3JpZC1jb2xzLTIgZ2FwLTQgaXRlbXMtc3RyZXRjaFwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxDYXJkIGNsYXNzTmFtZT1cImgtZnVsbCBmbGV4IGZsZXgtY29sXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8aDMgY2xhc3NOYW1lPVwidGV4dC1sZyBmb250LXNlbWlib2xkIHRleHQtcHJpbWFyeSBtYi00XCI+UGFub3JhbWEgZG8gbcOqczwvaDM+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8UmVzcG9uc2l2ZUNvbnRhaW5lciB3aWR0aD1cIjEwMCVcIiBoZWlnaHQ9ezI4MH0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxCYXJDaGFydCBkYXRhPXttb250aGx5T3ZlcnZpZXdEYXRhfT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8Q2FydGVzaWFuR3JpZCBzdHJva2VEYXNoYXJyYXk9XCIzIDNcIiBzdHJva2U9XCJ2YXIoLS1jb2xvci1ib3JkZXIpXCIgLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8WEF4aXMgZGF0YUtleT1cIm5hbWVcIiBzdHJva2U9XCJ2YXIoLS1jb2xvci10ZXh0LXNlY29uZGFyeSlcIiBmb250U2l6ZT17MTJ9IHRpY2s9e3sgZmlsbDogJ3ZhcigtLWNvbG9yLXRleHQtc2Vjb25kYXJ5KScgfX0gLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8WUF4aXNcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0cm9rZT1cInZhcigtLWNvbG9yLXRleHQtc2Vjb25kYXJ5KVwiXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb250U2l6ZT17MTJ9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aWNrPXt7IGZpbGw6ICd2YXIoLS1jb2xvci10ZXh0LXNlY29uZGFyeSknIH19XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aWNrRm9ybWF0dGVyPXsodmFsdWUpID0+IGZvcm1hdEF4aXNDdXJyZW5jeVRpY2soTnVtYmVyKHZhbHVlKSl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8VG9vbHRpcCBjb250ZW50PXtjaGFydFRvb2x0aXB9IC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPEJhciBkYXRhS2V5PVwidmFsdWVcIiByYWRpdXM9e1s2LCA2LCAwLCAwXX0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7bW9udGhseU92ZXJ2aWV3RGF0YS5tYXAoKGl0ZW0pID0+IChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPENlbGwga2V5PXtpdGVtLm5hbWV9IGZpbGw9e2l0ZW0uY29sb3J9IC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICApKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L0Jhcj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPC9CYXJDaGFydD5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvUmVzcG9uc2l2ZUNvbnRhaW5lcj5cclxuICAgICAgICAgICAgICAgICAgICA8L0NhcmQ+XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIDxDYXJkIGNsYXNzTmFtZT1cImgtZnVsbCBmbGV4IGZsZXgtY29sXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8aDMgY2xhc3NOYW1lPVwidGV4dC1sZyBmb250LXNlbWlib2xkIHRleHQtcHJpbWFyeSBtYi00XCI+Rmx1eG8gZGnDoXJpbyAobcOqcyk8L2gzPlxyXG4gICAgICAgICAgICAgICAgICAgICAgPFJlc3BvbnNpdmVDb250YWluZXIgd2lkdGg9XCIxMDAlXCIgaGVpZ2h0PXsyODB9PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8TGluZUNoYXJ0IGRhdGE9e2RhaWx5Rmxvd0RhdGF9PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxDYXJ0ZXNpYW5HcmlkIHN0cm9rZURhc2hhcnJheT1cIjMgM1wiIHN0cm9rZT1cInZhcigtLWNvbG9yLWJvcmRlcilcIiAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxYQXhpcyBkYXRhS2V5PVwiZGF5XCIgc3Ryb2tlPVwidmFyKC0tY29sb3ItdGV4dC1zZWNvbmRhcnkpXCIgZm9udFNpemU9ezEyfSB0aWNrPXt7IGZpbGw6ICd2YXIoLS1jb2xvci10ZXh0LXNlY29uZGFyeSknIH19IG1pblRpY2tHYXA9ezE0fSAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxZQXhpc1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3Ryb2tlPVwidmFyKC0tY29sb3ItdGV4dC1zZWNvbmRhcnkpXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvbnRTaXplPXsxMn1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpY2s9e3sgZmlsbDogJ3ZhcigtLWNvbG9yLXRleHQtc2Vjb25kYXJ5KScgfX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpY2tGb3JtYXR0ZXI9eyh2YWx1ZSkgPT4gZm9ybWF0QXhpc0N1cnJlbmN5VGljayhOdW1iZXIodmFsdWUpKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxUb29sdGlwIGNvbnRlbnQ9e2NoYXJ0VG9vbHRpcH0gLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8TGVnZW5kIGNvbnRlbnQ9e3JlbmRlckludGVyYWN0aXZlTGVnZW5kfSAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxMaW5lIHR5cGU9XCJtb25vdG9uZVwiIGRhdGFLZXk9XCJSZW5kYXNcIiBzdHJva2U9XCJ2YXIoLS1jb2xvci1pbmNvbWUpXCIgc3Ryb2tlV2lkdGg9ezJ9IGRvdD17ZmFsc2V9IGhpZGU9e2hpZGRlbkRhaWx5Rmxvd1Nlcmllcy5pbmNsdWRlcygnUmVuZGFzJyl9IC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPExpbmUgdHlwZT1cIm1vbm90b25lXCIgZGF0YUtleT1cIkRlc3Blc2FzXCIgc3Ryb2tlPVwidmFyKC0tY29sb3ItZXhwZW5zZSlcIiBzdHJva2VXaWR0aD17Mn0gZG90PXtmYWxzZX0gaGlkZT17aGlkZGVuRGFpbHlGbG93U2VyaWVzLmluY2x1ZGVzKCdEZXNwZXNhcycpfSAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxMaW5lIHR5cGU9XCJtb25vdG9uZVwiIGRhdGFLZXk9XCJJbnZlc3RpbWVudG9zXCIgc3Ryb2tlPVwidmFyKC0tY29sb3ItYmFsYW5jZSlcIiBzdHJva2VXaWR0aD17Mn0gZG90PXtmYWxzZX0gaGlkZT17aGlkZGVuRGFpbHlGbG93U2VyaWVzLmluY2x1ZGVzKCdJbnZlc3RpbWVudG9zJyl9IC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvTGluZUNoYXJ0PlxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9SZXNwb25zaXZlQ29udGFpbmVyPlxyXG4gICAgICAgICAgICAgICAgICAgIDwvQ2FyZD5cclxuICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcblxyXG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImdyaWQgZ3JpZC1jb2xzLTEgZ2FwLTQgaXRlbXMtc3RyZXRjaFwiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxDYXJkIGNsYXNzTmFtZT1cImgtZnVsbCBmbGV4IGZsZXgtY29sXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1iLTQgc3BhY2UteS0xLjVcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGgzIGNsYXNzTmFtZT1cInRleHQtbGcgZm9udC1zZW1pYm9sZCB0ZXh0LXByaW1hcnlcIj5EZXNwZXNhcyBwb3IgY2F0ZWdvcmlhPC9oMz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LXNlY29uZGFyeVwiPkdyw6FmaWNvIHBvciBwb3JjZW50YWdlbSBlIGxpc3RhIHByaW9yaXphZGEgcG9yIGFsZXJ0YXMgZGUgbGltaXRlLjwvcD5cclxuICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAge2V4cGVuc2VDYXRlZ29yaWVzUGllRGF0YS5sZW5ndGggPT09IDAgPyAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtc20gdGV4dC1zZWNvbmRhcnkgdGV4dC1jZW50ZXJcIj5TZW0gZGVzcGVzYXMgbm8gbcOqcyBzZWxlY2lvbmFkby48L3A+XHJcbiAgICAgICAgICAgICAgICAgICAgICApIDogKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibXgtYXV0byB3LWZ1bGwgbWF4LXctMnhsXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8UmVzcG9uc2l2ZUNvbnRhaW5lciB3aWR0aD1cIjEwMCVcIiBoZWlnaHQ9ezI2MH0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxQaWVDaGFydD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8UGllXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhPXtleHBlbnNlQ2F0ZWdvcmllc1BpZURhdGF9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhS2V5PVwidmFsdWVcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZUtleT1cIm5hbWVcIlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3V0ZXJSYWRpdXM9ezg2fVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFiZWxMaW5lPXtmYWxzZX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhYmVsPXtmYWxzZX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eyhlbnRyeTogeyBjYXRlZ29yeUlkPzogc3RyaW5nOyBuYW1lPzogc3RyaW5nIH0pID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGVudHJ5Py5jYXRlZ29yeUlkICYmIGVudHJ5Py5uYW1lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3BlbkV4cGVuc2VDYXRlZ29yeURldGFpbHMoZW50cnkuY2F0ZWdvcnlJZCwgZW50cnkubmFtZSlcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7ZXhwZW5zZUNhdGVnb3JpZXNQaWVEYXRhLm1hcCgoZW50cnkpID0+IChcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPENlbGwga2V5PXtlbnRyeS5uYW1lfSBmaWxsPXtlbnRyeS5jb2xvcn0gLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICkpfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvUGllPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxUb29sdGlwIGNvbnRlbnQ9e2NoYXJ0VG9vbHRpcH0gLz5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9QaWVDaGFydD5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvUmVzcG9uc2l2ZUNvbnRhaW5lcj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtdC00IHNwYWNlLXktM1wiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge3ByaW9yaXRpemVkRXhwZW5zZUNhdGVnb3J5SXRlbXMubWFwKChpdGVtKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHBlcmNlbnRhZ2UgPSB0b3RhbEV4cGVuc2VzID4gMCA/IChpdGVtLnZhbHVlIC8gdG90YWxFeHBlbnNlcykgKiAxMDAgOiAwXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5PXtpdGVtLm5hbWV9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IG9wZW5FeHBlbnNlQ2F0ZWdvcnlEZXRhaWxzKGl0ZW0uY2F0ZWdvcnlJZCwgaXRlbS5uYW1lKX1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17aW50ZXJhY3RpdmVSb3dCdXR0b25DbGFzc2VzfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1iZXR3ZWVuIGdhcC0zXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTIuNSBtaW4tdy0wXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidy0zIGgtMyByb3VuZGVkLWZ1bGwgZmxleC1zaHJpbmstMFwiIHN0eWxlPXt7IGJhY2tncm91bmRDb2xvcjogaXRlbS5jb2xvciB9fSAvPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtcHJpbWFyeSB0cnVuY2F0ZVwiPntpdGVtLm5hbWV9PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWVuZCBnYXAtMi41IGZsZXgtc2hyaW5rLTBcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7aXRlbS5hbGVydFByaW9yaXR5ID4gMCAmJiAoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9e2B0ZXh0LXhzIHB4LTIgcHktMC41IHJvdW5kZWQtZnVsbCBib3JkZXIgYm9yZGVyLXByaW1hcnkgYmctc2Vjb25kYXJ5ICR7aXRlbS5hbGVydFN0YXR1c0NsYXNzfWB9PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7aXRlbS5hbGVydFN0YXR1c0xhYmVsfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC14cyBweC0yIHB5LTAuNSByb3VuZGVkLWZ1bGwgYm9yZGVyIGJvcmRlci1wcmltYXJ5IGJnLXNlY29uZGFyeSB0ZXh0LXNlY29uZGFyeVwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2Zvcm1hdE51bWJlckJSKHBlcmNlbnRhZ2UsIHsgbWluaW11bUZyYWN0aW9uRGlnaXRzOiAxLCBtYXhpbXVtRnJhY3Rpb25EaWdpdHM6IDEgfSl9JVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInctZnVsbCBoLTEuNSByb3VuZGVkLWZ1bGwgYmctc2Vjb25kYXJ5IG10LTNcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJoLTEuNSByb3VuZGVkLWZ1bGxcIiBzdHlsZT17eyB3aWR0aDogYCR7TWF0aC5taW4ocGVyY2VudGFnZSwgMTAwKX0lYCwgYmFja2dyb3VuZENvbG9yOiBpdGVtLmNvbG9yIH19IC8+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtc2Vjb25kYXJ5IG10LTIgdGV4dC1jZW50ZXIgc206dGV4dC1sZWZ0IHRydW5jYXRlXCI+VG90YWw6IHtmb3JtYXRDdXJyZW5jeShpdGVtLnZhbHVlKX08L3A+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIClcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8Lz5cclxuICAgICAgICAgICAgICAgICAgICAgICl9XHJcbiAgICAgICAgICAgICAgICAgICAgPC9DYXJkPlxyXG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgIDwvPlxyXG4gICAgICAgICAgICApfVxyXG4gICAgICAgICAgPC9kaXY+ey8qIGVuZCBpbm5lciBjb250ZW50IGFyZWEgKi99XHJcbiAgICAgICAgPC9kaXY+ey8qIGVuZCBtb250aC10cmFuc2l0aW9uIG9wYWNpdHkgd3JhcHBlciAqL31cclxuICAgICAgPC9kaXY+ey8qIGVuZCBwLTQgbGc6cC02IGNvbnRhaW5lciAqL31cclxuXHJcbiAgICAgIDxNb2RhbCBpc09wZW49e2lzUXVpY2tBZGRPcGVufSBvbkNsb3NlPXtjbG9zZVF1aWNrQWRkfSB0aXRsZT17cXVpY2tBZGRUaXRsZX0+XHJcbiAgICAgICAgPGZvcm0gb25TdWJtaXQ9e2hhbmRsZVF1aWNrQWRkU3VibWl0fSBjbGFzc05hbWU9XCJ3LWZ1bGwgbWF4LXctbWQgbXgtYXV0byBzcGFjZS15LTRcIj5cclxuICAgICAgICAgIDxkaXY+XHJcbiAgICAgICAgICAgIDxsYWJlbCBjbGFzc05hbWU9XCJibG9jayB0ZXh0LXNtIGZvbnQtbWVkaXVtIHRleHQtcHJpbWFyeSBtYi0yXCI+VGlwbyBkZSBsYW7Dp2FtZW50bzwvbGFiZWw+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZ3JpZCBncmlkLWNvbHMtMyBnYXAtMlwiPlxyXG4gICAgICAgICAgICAgIDxCdXR0b25cclxuICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgICAgICAgc2l6ZT1cInNtXCJcclxuICAgICAgICAgICAgICAgIHZhcmlhbnQ9e3F1aWNrQWRkVHlwZSA9PT0gJ2V4cGVuc2UnID8gJ3ByaW1hcnknIDogJ291dGxpbmUnfVxyXG4gICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0UXVpY2tBZGRUeXBlKCdleHBlbnNlJyl9XHJcbiAgICAgICAgICAgICAgICBkaXNhYmxlZD17Y2F0ZWdvcmllcy5sZW5ndGggPT09IDB9XHJcbiAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgRGVzcGVzYVxyXG4gICAgICAgICAgICAgIDwvQnV0dG9uPlxyXG4gICAgICAgICAgICAgIDxCdXR0b25cclxuICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxyXG4gICAgICAgICAgICAgICAgc2l6ZT1cInNtXCJcclxuICAgICAgICAgICAgICAgIHZhcmlhbnQ9e3F1aWNrQWRkVHlwZSA9PT0gJ2luY29tZScgPyAncHJpbWFyeScgOiAnb3V0bGluZSd9XHJcbiAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRRdWlja0FkZFR5cGUoJ2luY29tZScpfVxyXG4gICAgICAgICAgICAgICAgZGlzYWJsZWQ9e2luY29tZUNhdGVnb3JpZXMubGVuZ3RoID09PSAwfVxyXG4gICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgIFJlbmRhXHJcbiAgICAgICAgICAgICAgPC9CdXR0b24+XHJcbiAgICAgICAgICAgICAgPEJ1dHRvblxyXG4gICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgICAgICBzaXplPVwic21cIlxyXG4gICAgICAgICAgICAgICAgdmFyaWFudD17cXVpY2tBZGRUeXBlID09PSAnaW52ZXN0bWVudCcgPyAncHJpbWFyeScgOiAnb3V0bGluZSd9XHJcbiAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRRdWlja0FkZFR5cGUoJ2ludmVzdG1lbnQnKX1cclxuICAgICAgICAgICAgICA+XHJcbiAgICAgICAgICAgICAgICBJbnZlc3QuXHJcbiAgICAgICAgICAgICAgPC9CdXR0b24+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8SW5wdXRcclxuICAgICAgICAgICAgbGFiZWw9XCJWYWxvclwiXHJcbiAgICAgICAgICAgIHR5cGU9XCJ0ZXh0XCJcclxuICAgICAgICAgICAgaW5wdXRNb2RlPVwiZGVjaW1hbFwiXHJcbiAgICAgICAgICAgIHZhbHVlPXtmb3JtRGF0YS5hbW91bnR9XHJcbiAgICAgICAgICAgIG9uQ2hhbmdlPXsoZXZlbnQpID0+IGhhbmRsZUFtb3VudENoYW5nZShldmVudC50YXJnZXQudmFsdWUpfVxyXG4gICAgICAgICAgICBvbkJsdXI9eygpID0+IHtcclxuICAgICAgICAgICAgICBjb25zdCBwYXJzZWQgPSBwYXJzZU1vbmV5SW5wdXQoZm9ybURhdGEuYW1vdW50KVxyXG4gICAgICAgICAgICAgIGlmICghTnVtYmVyLmlzTmFOKHBhcnNlZCkgJiYgcGFyc2VkID49IDApIHtcclxuICAgICAgICAgICAgICAgIGhhbmRsZUFtb3VudENoYW5nZShmb3JtYXRNb25leUlucHV0KHBhcnNlZCkpXHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9fVxyXG4gICAgICAgICAgICBwbGFjZWhvbGRlcj1cIjAsMDBcIlxyXG4gICAgICAgICAgICByZXF1aXJlZFxyXG4gICAgICAgICAgLz5cclxuXHJcbiAgICAgICAgICB7cXVpY2tBZGRUeXBlICE9PSAnaW52ZXN0bWVudCcgJiYgKFxyXG4gICAgICAgICAgICA8SW5wdXRcclxuICAgICAgICAgICAgICBsYWJlbD1cIlZhbG9yIG5vIHJlbGF0w7NyaW8gKG9wY2lvbmFsKVwiXHJcbiAgICAgICAgICAgICAgdHlwZT1cInRleHRcIlxyXG4gICAgICAgICAgICAgIGlucHV0TW9kZT1cImRlY2ltYWxcIlxyXG4gICAgICAgICAgICAgIHZhbHVlPXtmb3JtRGF0YS5yZXBvcnRfYW1vdW50fVxyXG4gICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZXZlbnQpID0+IHNldEZvcm1EYXRhKChwcmV2KSA9PiAoeyAuLi5wcmV2LCByZXBvcnRfYW1vdW50OiBldmVudC50YXJnZXQudmFsdWUgfSkpfVxyXG4gICAgICAgICAgICAgIG9uQmx1cj17KCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFmb3JtRGF0YS5yZXBvcnRfYW1vdW50KSByZXR1cm5cclxuICAgICAgICAgICAgICAgIGNvbnN0IHBhcnNlZCA9IHBhcnNlTW9uZXlJbnB1dChmb3JtRGF0YS5yZXBvcnRfYW1vdW50KVxyXG4gICAgICAgICAgICAgICAgaWYgKCFOdW1iZXIuaXNOYU4ocGFyc2VkKSAmJiBwYXJzZWQgPj0gMCkge1xyXG4gICAgICAgICAgICAgICAgICBzZXRGb3JtRGF0YSgocHJldikgPT4gKHsgLi4ucHJldiwgcmVwb3J0X2Ftb3VudDogZm9ybWF0TW9uZXlJbnB1dChwYXJzZWQpIH0pKVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJTZSB2YXppbywgdXNhIG8gdmFsb3IgdG90YWxcIlxyXG4gICAgICAgICAgICAvPlxyXG4gICAgICAgICAgKX1cclxuXHJcbiAgICAgICAgICA8SW5wdXRcclxuICAgICAgICAgICAgbGFiZWw9XCJEYXRhXCJcclxuICAgICAgICAgICAgdHlwZT1cImRhdGVcIlxyXG4gICAgICAgICAgICB2YWx1ZT17Zm9ybURhdGEuZGF0ZX1cclxuICAgICAgICAgICAgb25DaGFuZ2U9eyhldmVudCkgPT4gc2V0Rm9ybURhdGEoKHByZXYpID0+ICh7IC4uLnByZXYsIGRhdGU6IGV2ZW50LnRhcmdldC52YWx1ZSB9KSl9XHJcbiAgICAgICAgICAgIG1pbj17QVBQX1NUQVJUX0RBVEV9XHJcbiAgICAgICAgICAgIHJlcXVpcmVkXHJcbiAgICAgICAgICAvPlxyXG5cclxuICAgICAgICAgIHtxdWlja0FkZFR5cGUgPT09ICdleHBlbnNlJyAmJiAoXHJcbiAgICAgICAgICAgIDxJbnB1dFxyXG4gICAgICAgICAgICAgIGxhYmVsPVwiUGFyY2VsYXNcIlxyXG4gICAgICAgICAgICAgIHR5cGU9XCJudW1iZXJcIlxyXG4gICAgICAgICAgICAgIG1pbj1cIjFcIlxyXG4gICAgICAgICAgICAgIG1heD1cIjYwXCJcclxuICAgICAgICAgICAgICB2YWx1ZT17Zm9ybURhdGEuaW5zdGFsbG1lbnRfdG90YWx9XHJcbiAgICAgICAgICAgICAgb25DaGFuZ2U9eyhldmVudCkgPT4gc2V0Rm9ybURhdGEoKHByZXYpID0+ICh7IC4uLnByZXYsIGluc3RhbGxtZW50X3RvdGFsOiBldmVudC50YXJnZXQudmFsdWUgfSkpfVxyXG4gICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiMVwiXHJcbiAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICApfVxyXG5cclxuICAgICAgICAgIHtxdWlja0FkZFR5cGUgPT09ICdleHBlbnNlJyAmJiAoXHJcbiAgICAgICAgICAgIDxTZWxlY3RcclxuICAgICAgICAgICAgICBsYWJlbD1cIkZvcm1hIGRlIHBhZ2FtZW50b1wiXHJcbiAgICAgICAgICAgICAgdmFsdWU9e2Zvcm1EYXRhLnBheW1lbnRfbWV0aG9kfVxyXG4gICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZXZlbnQpID0+IHNldEZvcm1EYXRhKChwcmV2KSA9PiAoe1xyXG4gICAgICAgICAgICAgICAgLi4ucHJldixcclxuICAgICAgICAgICAgICAgIHBheW1lbnRfbWV0aG9kOiBldmVudC50YXJnZXQudmFsdWUsXHJcbiAgICAgICAgICAgICAgICBjcmVkaXRfY2FyZF9pZDogZXZlbnQudGFyZ2V0LnZhbHVlID09PSAnY3JlZGl0X2NhcmQnID8gcHJldi5jcmVkaXRfY2FyZF9pZCA6ICcnLFxyXG4gICAgICAgICAgICAgIH0pKX1cclxuICAgICAgICAgICAgICBvcHRpb25zPXtbXHJcbiAgICAgICAgICAgICAgICB7IHZhbHVlOiAnb3RoZXInLCBsYWJlbDogJ091dHJvcycgfSxcclxuICAgICAgICAgICAgICAgIHsgdmFsdWU6ICdjYXNoJywgbGFiZWw6ICdEaW5oZWlybycgfSxcclxuICAgICAgICAgICAgICAgIHsgdmFsdWU6ICdkZWJpdCcsIGxhYmVsOiAnRMOpYml0bycgfSxcclxuICAgICAgICAgICAgICAgIHsgdmFsdWU6ICdjcmVkaXRfY2FyZCcsIGxhYmVsOiAnQ2FydMOjbyBkZSBjcsOpZGl0bycgfSxcclxuICAgICAgICAgICAgICAgIHsgdmFsdWU6ICdwaXgnLCBsYWJlbDogJ1BJWCcgfSxcclxuICAgICAgICAgICAgICAgIHsgdmFsdWU6ICd0cmFuc2ZlcicsIGxhYmVsOiAnVHJhbnNmZXLDqm5jaWEnIH0sXHJcbiAgICAgICAgICAgICAgXX1cclxuICAgICAgICAgICAgLz5cclxuICAgICAgICAgICl9XHJcblxyXG4gICAgICAgICAge3F1aWNrQWRkVHlwZSA9PT0gJ2V4cGVuc2UnICYmIGZvcm1EYXRhLnBheW1lbnRfbWV0aG9kID09PSAnY3JlZGl0X2NhcmQnICYmIChcclxuICAgICAgICAgICAgPFNlbGVjdFxyXG4gICAgICAgICAgICAgIGxhYmVsPVwiQ2FydMOjb1wiXHJcbiAgICAgICAgICAgICAgdmFsdWU9e2Zvcm1EYXRhLmNyZWRpdF9jYXJkX2lkfVxyXG4gICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZXZlbnQpID0+IHNldEZvcm1EYXRhKChwcmV2KSA9PiAoeyAuLi5wcmV2LCBjcmVkaXRfY2FyZF9pZDogZXZlbnQudGFyZ2V0LnZhbHVlIH0pKX1cclxuICAgICAgICAgICAgICBvcHRpb25zPXtbXHJcbiAgICAgICAgICAgICAgICB7IHZhbHVlOiAnJywgbGFiZWw6ICdTZWxlY2lvbmFyIGNhcnTDo28nIH0sXHJcbiAgICAgICAgICAgICAgICAuLi5jcmVkaXRDYXJkc1xyXG4gICAgICAgICAgICAgICAgICAuZmlsdGVyKChjYXJkKSA9PiBjYXJkLmlzX2FjdGl2ZSAhPT0gZmFsc2UgfHwgY2FyZC5pZCA9PT0gZm9ybURhdGEuY3JlZGl0X2NhcmRfaWQpXHJcbiAgICAgICAgICAgICAgICAgIC5tYXAoKGNhcmQpID0+ICh7IHZhbHVlOiBjYXJkLmlkLCBsYWJlbDogY2FyZC5uYW1lIH0pKSxcclxuICAgICAgICAgICAgICBdfVxyXG4gICAgICAgICAgICAgIHJlcXVpcmVkXHJcbiAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICApfVxyXG5cclxuICAgICAgICAgIHtxdWlja0FkZFR5cGUgPT09ICdleHBlbnNlJyAmJiAoXHJcbiAgICAgICAgICAgIDxTZWxlY3RcclxuICAgICAgICAgICAgICBsYWJlbD1cIkNhdGVnb3JpYVwiXHJcbiAgICAgICAgICAgICAgdmFsdWU9e2Zvcm1EYXRhLmNhdGVnb3J5X2lkfVxyXG4gICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZXZlbnQpID0+IHNldEZvcm1EYXRhKChwcmV2KSA9PiAoeyAuLi5wcmV2LCBjYXRlZ29yeV9pZDogZXZlbnQudGFyZ2V0LnZhbHVlIH0pKX1cclxuICAgICAgICAgICAgICBvcHRpb25zPXtjYXRlZ29yaWVzLm1hcCgoY2F0ZWdvcnkpID0+ICh7IHZhbHVlOiBjYXRlZ29yeS5pZCwgbGFiZWw6IGNhdGVnb3J5Lm5hbWUgfSkpfVxyXG4gICAgICAgICAgICAgIHJlcXVpcmVkXHJcbiAgICAgICAgICAgIC8+XHJcbiAgICAgICAgICApfVxyXG5cclxuICAgICAgICAgIHtxdWlja0FkZFR5cGUgPT09ICdpbmNvbWUnICYmIChcclxuICAgICAgICAgICAgPFNlbGVjdFxyXG4gICAgICAgICAgICAgIGxhYmVsPVwiQ2F0ZWdvcmlhIGRlIHJlbmRhXCJcclxuICAgICAgICAgICAgICB2YWx1ZT17Zm9ybURhdGEuaW5jb21lX2NhdGVnb3J5X2lkfVxyXG4gICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZXZlbnQpID0+IHNldEZvcm1EYXRhKChwcmV2KSA9PiAoeyAuLi5wcmV2LCBpbmNvbWVfY2F0ZWdvcnlfaWQ6IGV2ZW50LnRhcmdldC52YWx1ZSB9KSl9XHJcbiAgICAgICAgICAgICAgb3B0aW9ucz17aW5jb21lQ2F0ZWdvcmllcy5tYXAoKGNhdGVnb3J5KSA9PiAoeyB2YWx1ZTogY2F0ZWdvcnkuaWQsIGxhYmVsOiBjYXRlZ29yeS5uYW1lIH0pKX1cclxuICAgICAgICAgICAgICByZXF1aXJlZFxyXG4gICAgICAgICAgICAvPlxyXG4gICAgICAgICAgKX1cclxuXHJcbiAgICAgICAgICA8SW5wdXRcclxuICAgICAgICAgICAgbGFiZWw9XCJEZXNjcmnDp8OjbyAob3BjaW9uYWwpXCJcclxuICAgICAgICAgICAgdmFsdWU9e2Zvcm1EYXRhLmRlc2NyaXB0aW9ufVxyXG4gICAgICAgICAgICBvbkNoYW5nZT17KGV2ZW50KSA9PiBzZXRGb3JtRGF0YSgocHJldikgPT4gKHsgLi4ucHJldiwgZGVzY3JpcHRpb246IGV2ZW50LnRhcmdldC52YWx1ZSB9KSl9XHJcbiAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiRXg6IG1lcmNhZG8sIHNhbMOhcmlvLCByZXNlcnZhLi4uXCJcclxuICAgICAgICAgIC8+XHJcblxyXG4gICAgICAgICAgPE1vZGFsQWN0aW9uRm9vdGVyIG9uQ2FuY2VsPXtjbG9zZVF1aWNrQWRkfSBzdWJtaXRMYWJlbD1cIlNhbHZhclwiIC8+XHJcbiAgICAgICAgPC9mb3JtPlxyXG4gICAgICA8L01vZGFsPlxyXG5cclxuICAgICAgPE1vZGFsXHJcbiAgICAgICAgaXNPcGVuPXtCb29sZWFuKHNlbGVjdGVkRXhwZW5zZUNhdGVnb3J5KX1cclxuICAgICAgICBvbkNsb3NlPXsoKSA9PiBzZXRTZWxlY3RlZEV4cGVuc2VDYXRlZ29yeShudWxsKX1cclxuICAgICAgICB0aXRsZT17c2VsZWN0ZWRFeHBlbnNlQ2F0ZWdvcnkgPyBgRGV0YWxoYW1lbnRvOiAke3NlbGVjdGVkRXhwZW5zZUNhdGVnb3J5Lm5hbWV9YCA6ICdEZXRhbGhhbWVudG8nfVxyXG4gICAgICA+XHJcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTRcIj5cclxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS0yXCI+XHJcbiAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgZm9udC1tZWRpdW0gdXBwZXJjYXNlIHRyYWNraW5nLXdpZGUgdGV4dC1zZWNvbmRhcnlcIj5Db21wYXJhw6fDo28gbWVuc2FsPC9wPlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImdyaWQgZ3JpZC1jb2xzLTEgc206Z3JpZC1jb2xzLTIgZ2FwLTNcIj5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInJvdW5kZWQtbGcgYm9yZGVyIGJvcmRlci1wcmltYXJ5IGJnLXNlY29uZGFyeSBwLTNcIj5cclxuICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1zZWNvbmRhcnlcIj5Ub3RhbCBlbSB7Zm9ybWF0TW9udGgoY3VycmVudE1vbnRoKX08L3A+XHJcbiAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LWxnIGZvbnQtc2VtaWJvbGQgdGV4dC1wcmltYXJ5XCI+e2Zvcm1hdEN1cnJlbmN5KHNlbGVjdGVkRXhwZW5zZUNhdGVnb3J5RGV0YWlscz8uY3VycmVudFRvdGFsID8/IDApfTwvcD5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInJvdW5kZWQtbGcgYm9yZGVyIGJvcmRlci1wcmltYXJ5IGJnLXNlY29uZGFyeSBwLTNcIj5cclxuICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1zZWNvbmRhcnlcIj5Ub3RhbCBlbSB7Zm9ybWF0TW9udGgocHJldmlvdXNNb250aCl9PC9wPlxyXG4gICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1sZyBmb250LXNlbWlib2xkIHRleHQtcHJpbWFyeVwiPntmb3JtYXRDdXJyZW5jeShzZWxlY3RlZEV4cGVuc2VDYXRlZ29yeURldGFpbHM/LnByZXZpb3VzVG90YWwgPz8gMCl9PC9wPlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgIHtzZWxlY3RlZEV4cGVuc2VDYXRlZ29yeUxpbWl0RGV0YWlscyAmJiAoXHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic3BhY2UteS0yXCI+XHJcbiAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyBmb250LW1lZGl1bSB1cHBlcmNhc2UgdHJhY2tpbmctd2lkZSB0ZXh0LXNlY29uZGFyeVwiPk1ldGFzIGRvIG3DqnM8L3A+XHJcbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJyb3VuZGVkLWxnIGJvcmRlciBib3JkZXItcHJpbWFyeSBiZy1zZWNvbmRhcnkgcC0zXCI+XHJcbiAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXNtIHRleHQtcHJpbWFyeVwiPkxpbWl0ZToge2Zvcm1hdEN1cnJlbmN5KHNlbGVjdGVkRXhwZW5zZUNhdGVnb3J5TGltaXREZXRhaWxzLmxpbWl0QW1vdW50KX08L3A+XHJcbiAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXNtIHRleHQtcHJpbWFyeVwiPkdhc3RvOiB7Zm9ybWF0Q3VycmVuY3koc2VsZWN0ZWRFeHBlbnNlQ2F0ZWdvcnlMaW1pdERldGFpbHMuY3VycmVudFRvdGFsKX08L3A+XHJcbiAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9e2B0ZXh0LXNtIGZvbnQtbWVkaXVtICR7c2VsZWN0ZWRFeHBlbnNlQ2F0ZWdvcnlMaW1pdERldGFpbHMuaXNFeGNlZWRlZCA/ICd0ZXh0LWV4cGVuc2UnIDogJ3RleHQtaW5jb21lJ31gfT5cclxuICAgICAgICAgICAgICAgICAge3NlbGVjdGVkRXhwZW5zZUNhdGVnb3J5TGltaXREZXRhaWxzLmlzRXhjZWVkZWRcclxuICAgICAgICAgICAgICAgICAgICA/IGBFeGNlc3NvOiAke2Zvcm1hdEN1cnJlbmN5KHNlbGVjdGVkRXhwZW5zZUNhdGVnb3J5TGltaXREZXRhaWxzLmV4Y2VlZGVkQW1vdW50KX1gXHJcbiAgICAgICAgICAgICAgICAgICAgOiBgUmVzdGFudGU6ICR7Zm9ybWF0Q3VycmVuY3koc2VsZWN0ZWRFeHBlbnNlQ2F0ZWdvcnlMaW1pdERldGFpbHMucmVtYWluaW5nQW1vdW50KX1gfVxyXG4gICAgICAgICAgICAgICAgPC9wPlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICl9XHJcblxyXG4gICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyBmb250LW1lZGl1bSB1cHBlcmNhc2UgdHJhY2tpbmctd2lkZSB0ZXh0LXNlY29uZGFyeVwiPkxhbsOnYW1lbnRvcyBkbyBtw6pzPC9wPlxyXG5cclxuICAgICAgICAgIHtzZWxlY3RlZEV4cGVuc2VDYXRlZ29yeURldGFpbHMgJiYgc2VsZWN0ZWRFeHBlbnNlQ2F0ZWdvcnlEZXRhaWxzLmN1cnJlbnRJdGVtcy5sZW5ndGggPiAwID8gKFxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1heC1oLTcyIG92ZXJmbG93LXktYXV0byBzcGFjZS15LTIgcHItMVwiPlxyXG4gICAgICAgICAgICAgIHtzZWxlY3RlZEV4cGVuc2VDYXRlZ29yeURldGFpbHMuY3VycmVudEl0ZW1zLm1hcCgoaXRlbSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgcmVwb3J0QW1vdW50ID0gZXhwZW5zZUFtb3VudEZvckRhc2hib2FyZChpdGVtLmFtb3VudCwgaXRlbS5yZXBvcnRfd2VpZ2h0KVxyXG4gICAgICAgICAgICAgICAgY29uc3Qgc2hvd09yaWdpbmFsID0gTWF0aC5hYnMocmVwb3J0QW1vdW50IC0gaXRlbS5hbW91bnQpID4gMC4wMDlcclxuXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgICAgICAgICA8ZGl2IGtleT17aXRlbS5pZH0gY2xhc3NOYW1lPVwicm91bmRlZC1sZyBib3JkZXIgYm9yZGVyLXByaW1hcnkgYmctcHJpbWFyeSBwLTNcIj5cclxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtc3RhcnQganVzdGlmeS1iZXR3ZWVuIGdhcC0zXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1pbi13LTBcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1zbSBmb250LW1lZGl1bSB0ZXh0LXByaW1hcnkgdHJ1bmNhdGVcIj57aXRlbS5kZXNjcmlwdGlvbiB8fCBpdGVtLmNhdGVnb3J5Py5uYW1lIHx8ICdEZXNwZXNhJ308L3A+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1zZWNvbmRhcnkgbXQtMC41XCI+e2Zvcm1hdERhdGUoaXRlbS5kYXRlKX08L3A+XHJcbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1yaWdodFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXNtIGZvbnQtc2VtaWJvbGQgdGV4dC1wcmltYXJ5XCI+e2Zvcm1hdEN1cnJlbmN5KHJlcG9ydEFtb3VudCl9PC9wPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB7c2hvd09yaWdpbmFsICYmIDxwIGNsYXNzTmFtZT1cInRleHQteHMgdGV4dC1zZWNvbmRhcnlcIj5Ub3RhbDoge2Zvcm1hdEN1cnJlbmN5KGl0ZW0uYW1vdW50KX08L3A+fVxyXG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgKVxyXG4gICAgICAgICAgICAgIH0pfVxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICkgOiAoXHJcbiAgICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtc20gdGV4dC1zZWNvbmRhcnlcIj5TZW0gbGFuw6dhbWVudG9zIGRlc3NhIGNhdGVnb3JpYSBubyBtw6pzIHNlbGVjaW9uYWRvLjwvcD5cclxuICAgICAgICAgICl9XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgIDwvTW9kYWw+XHJcblxyXG4gICAgICA8TW9kYWxcclxuICAgICAgICBpc09wZW49e2lzQXNzaXN0YW50T3Blbn1cclxuICAgICAgICBvbkNsb3NlPXtjbG9zZUFzc2lzdGFudH1cclxuICAgICAgICB0aXRsZT1cIkFzc2lzdGVudGVcIlxyXG4gICAgICA+XHJcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzcGFjZS15LTRcIj5cclxuICAgICAgICAgIHsvKiBTdWJ0bGUgU3RhdHVzIEJhciAqL31cclxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBmbGV4LWNvbCBzbTpmbGV4LXJvdyBzbTppdGVtcy1jZW50ZXIgc206anVzdGlmeS1iZXR3ZWVuIGdhcC0yIHB4LTFcIj5cclxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxyXG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPXtgaC0yIHctMiByb3VuZGVkLWZ1bGwgdHJhbnNpdGlvbi1jb2xvcnMgZHVyYXRpb24tMzAwICR7dm9pY2VQaGFzZSA9PT0gJ2xpc3RlbmluZycgPyAnYmctW3ZhcigtLWNvbG9yLXN1Y2Nlc3MpXSBhbmltYXRlLXB1bHNlIHNoYWRvdy1bMF8wXzhweF92YXIoLS1jb2xvci1zdWNjZXNzKV0nIDogJ2JnLXNlY29uZGFyeSd9YH0gLz5cclxuICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LVsxMHB4XSB1cHBlcmNhc2UgdHJhY2tpbmctd2lkZXN0IHRleHQtc2Vjb25kYXJ5IGZvbnQtc2VtaWJvbGQgd2hpdGVzcGFjZS1ub3dyYXBcIj5cclxuICAgICAgICAgICAgICAgIHt2b2ljZVBoYXNlID09PSAnbGlzdGVuaW5nJyA/ICdBc3Npc3RlbnRlIE91dmluZG8nIDogJ0FndWFyZGFuZG8gQ29tYW5kbyd9XHJcbiAgICAgICAgICAgICAgPC9zcGFuPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAge2xhc3RIZWFyZENvbW1hbmQgJiYgKFxyXG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtWzExcHhdIGl0YWxpYyB0ZXh0LXNlY29uZGFyeSBicmVhay13b3JkcyBzbTp0cnVuY2F0ZSBzbTptYXgtdy1bMjUwcHhdIHNtOmJvcmRlci1sIHNtOmJvcmRlci1wcmltYXJ5LzIwIHNtOnBsLTNcIj5cclxuICAgICAgICAgICAgICAgIFwie2xhc3RIZWFyZENvbW1hbmR9XCJcclxuICAgICAgICAgICAgICA8L3NwYW4+XHJcbiAgICAgICAgICAgICl9XHJcbiAgICAgICAgICA8L2Rpdj5cclxuXHJcblxyXG4gICAgICAgICAgPEJ1dHRvblxyXG4gICAgICAgICAgICBvbkNsaWNrPXtoYW5kbGVWb2ljZUludGVycHJldH1cclxuICAgICAgICAgICAgZGlzYWJsZWQ9e2Fzc2lzdGFudExvYWRpbmcgfHwgIWlzU3VwYWJhc2VDb25maWd1cmVkIHx8ICF2b2ljZVN1cHBvcnQucmVjb2duaXRpb259XHJcbiAgICAgICAgICAgIHZhcmlhbnQ9XCJvdXRsaW5lXCJcclxuICAgICAgICAgICAgZnVsbFdpZHRoXHJcbiAgICAgICAgICA+XHJcbiAgICAgICAgICAgIHt2b2ljZUxpc3RlbmluZyA/ICdQYXJhciBFc2N1dGEnIDogJ0ZhbGFyIENvbWFuZG8nfVxyXG4gICAgICAgICAgPC9CdXR0b24+XHJcblxyXG4gICAgICAgICAge2xhc3RJbnRlcnByZXRhdGlvbj8ucmVxdWlyZXNDb25maXJtYXRpb24gJiYgKFxyXG4gICAgICAgICAgICA8QXNzaXN0YW50Q29uZmlybWF0aW9uUGFuZWxcclxuICAgICAgICAgICAgICBpbnRlbnQ9e2xhc3RJbnRlcnByZXRhdGlvbi5pbnRlbnR9XHJcbiAgICAgICAgICAgICAgZWRpdGFibGVDb25maXJtYXRpb25UZXh0PXtlZGl0YWJsZUNvbmZpcm1hdGlvblRleHR9XHJcbiAgICAgICAgICAgICAgb25FZGl0YWJsZUNvbmZpcm1hdGlvblRleHRDaGFuZ2U9e3NldEVkaXRhYmxlQ29uZmlybWF0aW9uVGV4dH1cclxuICAgICAgICAgICAgICBlZGl0YWJsZVNsb3RzPXtlZGl0YWJsZVNsb3RzfVxyXG4gICAgICAgICAgICAgIGNhdGVnb3JpZXM9e2NhdGVnb3JpZXMubWFwKChjYXRlZ29yeSkgPT4gKHsgaWQ6IGNhdGVnb3J5LmlkLCBuYW1lOiBjYXRlZ29yeS5uYW1lIH0pKX1cclxuICAgICAgICAgICAgICBpbmNvbWVDYXRlZ29yaWVzPXtpbmNvbWVDYXRlZ29yaWVzLm1hcCgoY2F0ZWdvcnkpID0+ICh7IGlkOiBjYXRlZ29yeS5pZCwgbmFtZTogY2F0ZWdvcnkubmFtZSB9KSl9XHJcbiAgICAgICAgICAgICAgY3JlZGl0Q2FyZHM9e2NyZWRpdENhcmRzLm1hcChjID0+ICh7IGlkOiBjLmlkLCBuYW1lOiBjLm5hbWUgfSkpfVxyXG4gICAgICAgICAgICAgIGRpc2FibGVkPXthc3Npc3RhbnRMb2FkaW5nIHx8ICFpc1N1cGFiYXNlQ29uZmlndXJlZH1cclxuICAgICAgICAgICAgICBmYWxsYmFja01vbnRoPXtjdXJyZW50TW9udGh9XHJcbiAgICAgICAgICAgICAgb25VcGRhdGVTbG90cz17dXBkYXRlRWRpdGFibGVTbG90c31cclxuICAgICAgICAgICAgICB0b3VjaENvbmZpcm1hdGlvbkVuYWJsZWQ9e3RvdWNoQ29uZmlybWF0aW9uRW5hYmxlZH1cclxuICAgICAgICAgICAgICB2b2ljZUNvbmZpcm1hdGlvbkVuYWJsZWQ9e3ZvaWNlQ29uZmlybWF0aW9uRW5hYmxlZH1cclxuICAgICAgICAgICAgICBhY3Rpb25Db2x1bW5zQ2xhc3M9e2FjdGlvbkNvbHVtbnNDbGFzc31cclxuICAgICAgICAgICAgICBvbkNvbmZpcm09eygpID0+IGhhbmRsZUNvbmZpcm1Bc3Npc3RhbnQodHJ1ZSl9XHJcbiAgICAgICAgICAgICAgb25EZW55PXsoKSA9PiBoYW5kbGVDb25maXJtQXNzaXN0YW50KGZhbHNlKX1cclxuICAgICAgICAgICAgICBvblZvaWNlQ29uZmlybT17aGFuZGxlVm9pY2VDb25maXJtfVxyXG4gICAgICAgICAgICAgIHZvaWNlQ29uZmlybURpc2FibGVkPXthc3Npc3RhbnRMb2FkaW5nIHx8ICFpc1N1cGFiYXNlQ29uZmlndXJlZCB8fCAhdm9pY2VTdXBwb3J0LnJlY29nbml0aW9uIHx8IHZvaWNlTGlzdGVuaW5nfVxyXG4gICAgICAgICAgICAgIHZvaWNlTGlzdGVuaW5nPXt2b2ljZUxpc3RlbmluZ31cclxuICAgICAgICAgICAgICBjb250YWluZXJDbGFzc05hbWU9XCJzcGFjZS15LTNcIlxyXG4gICAgICAgICAgICAvPlxyXG4gICAgICAgICAgKX1cclxuXHJcbiAgICAgICAgICB7YXNzaXN0YW50RXJyb3IgJiYgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LVt2YXIoLS1jb2xvci1kYW5nZXIpXVwiPnthc3Npc3RhbnRFcnJvcn08L3A+fVxyXG4gICAgICAgICAge2hhc0Fzc2lzdGFudE9mZmxpbmVQZW5kaW5nICYmIChcclxuICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LXNlY29uZGFyeVwiPlxyXG4gICAgICAgICAgICAgIHthc3Npc3RhbnRPZmZsaW5lUGVuZGluZ0NvdW50ID09PSAxXHJcbiAgICAgICAgICAgICAgICA/ICcxIGNvbWFuZG8gZG8gYXNzaXN0ZW50ZSBwZW5kZW50ZSBkZSBzaW5jcm9uaXphw6fDo28uJ1xyXG4gICAgICAgICAgICAgICAgOiBgJHthc3Npc3RhbnRPZmZsaW5lUGVuZGluZ0NvdW50fSBjb21hbmRvcyBkbyBhc3Npc3RlbnRlIHBlbmRlbnRlcyBkZSBzaW5jcm9uaXphw6fDo28uYH1cclxuICAgICAgICAgICAgPC9wPlxyXG4gICAgICAgICAgKX1cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgPC9Nb2RhbD5cclxuICAgIDwvZGl2PlxyXG4gIClcclxufVxyXG5cclxuIl0sImZpbGUiOiJDOi9Vc2Vycy9nYWJyaS9PbmVEcml2ZS9Eb2N1bWVudG9zL0ZpbmFuw6dhcy9taW5oYXNfZmluYW5jYXMvc3JjL3BhZ2VzL0Rhc2hib2FyZC50c3gifQ==