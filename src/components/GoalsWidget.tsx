"use client";

import { useState, useEffect } from "react";
import { getGoals, getGoalProgress, type Goal, type GoalProgress } from "@/lib/goals";
import { useTranslation } from "@/lib/i18n";

interface GoalsWidgetProps {
  onAddGoal?: () => void;
}

export function GoalsWidget({ onAddGoal }: GoalsWidgetProps) {
  const { t } = useTranslation();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, GoalProgress>>({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadGoals();
  }, []);

  async function loadGoals() {
    try {
      const data = await getGoals();
      setGoals(data);
      
      // Load progress for each goal
      const progress: Record<string, GoalProgress> = {};
      for (const goal of data) {
        try {
          progress[goal.id] = await getGoalProgress(goal.id, goal.frequency === 'monthly' ? 'month' : 'week');
        } catch {}
      }
      setProgressMap(progress);
    } catch (e) {
      console.error("Failed to load goals:", e);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="glass-card p-4">
        <div className="text-white/40 text-sm">{t("common.loading")}</div>
      </div>
    );
  }

  if (goals.length === 0) {
    return (
      <div className="glass-card p-4">
        <h3 className="text-lg font-semibold text-white mb-2">🎯 {t("daylio_goals.title")}</h3>
        <p className="text-white/40 text-sm mb-3">{t("daylio_goals.no_goals")}</p>
        {onAddGoal && (
          <button
            onClick={onAddGoal}
            className="w-full py-2 px-4 rounded-xl bg-indigo-500/20 text-indigo-300 text-sm font-medium hover:bg-indigo-500/30 transition-colors"
          >
            + {t("daylio_goals.create_first")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-white">🎯 {t("daylio_goals.title")}</h3>
        {onAddGoal && (
          <button
            onClick={onAddGoal}
            className="text-indigo-400 text-sm font-medium hover:text-indigo-300 transition-colors"
          >
            + {t("daylio_goals.add_goal")}
          </button>
        )}
      </div>
      
      <div className="space-y-3">
        {goals.map((goal) => {
          const progress = progressMap[goal.id];
          const current = progress?.current_count || 0;
          const target = goal.target_count;
          const percentage = Math.min(100, (current / target) * 100);
          const streak = progress?.streak || 0;
          const isMet = progress?.target_met || false;
          const isExpanded = expandedId === goal.id;

          return (
            <div
              key={goal.id}
              className="rounded-xl bg-white/5 border border-white/10 overflow-hidden transition-all duration-300"
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : goal.id)}
                className="w-full p-3 text-left hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🎯</span>
                    <span className="font-medium text-white">{goal.name}</span>
                  </div>
                  {isMet && <span className="text-green-400 text-sm">✓</span>}
                </div>
                
                {/* Progress bar */}
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: isMet ? "#22c55e" : "#6366f1",
                    }}
                  />
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">
                    {current}/{target} {goal.frequency === 'daily' ? 'denně' : goal.frequency === 'weekly' ? 'týdně' : 'měsíčně'}
                  </span>
                  {streak > 0 && (
                    <span className="text-orange-400 flex items-center gap-1">
                      🔥 {streak}
                    </span>
                  )}
                </div>
              </button>
              
              {/* Expanded details */}
              {isExpanded && progress && (
                <div className="px-3 pb-3 pt-0 text-sm text-white/60 border-t border-white/10 mt-1 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-white/40">{t("daylio_goals.current_progress")}:</span>
                      <span className="ml-1 text-white">{current}/{target}</span>
                    </div>
                    <div>
                      <span className="text-white/40">{t("daylio_goals.streak")}:</span>
                      <span className="ml-1 text-white">{streak} dní</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-white/40">{t("daylio_goals.frequency")}:</span>
                      <span className="ml-1 text-white">
                        {goal.frequency === 'daily' ? t("daylio_goals.daily") : 
                         goal.frequency === 'weekly' ? t("daylio_goals.weekly") : 
                         t("daylio_goals.monthly")}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
