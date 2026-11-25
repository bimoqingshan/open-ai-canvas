package app

import (
	"time"

	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
)

const accountActivityDays = 365

type AccountActivityDay struct {
	Day                  string `json:"day"`
	ConsumedMicrocredits int64  `json:"consumedMicrocredits"`
	Active               bool   `json:"active"`
}

type AccountActivitySummary struct {
	TotalConsumedMicrocredits int64 `json:"totalConsumedMicrocredits"`
	DailyPeakMicrocredits     int64 `json:"dailyPeakMicrocredits"`
	LastSevenDaysMicrocredits int64 `json:"lastSevenDaysMicrocredits"`
	ActiveDays                int   `json:"activeDays"`
	LongestStreak             int   `json:"longestStreak"`
}

type AccountActivity struct {
	From    string                 `json:"from"`
	To      string                 `json:"to"`
	Days    []AccountActivityDay   `json:"days"`
	Summary AccountActivitySummary `json:"summary"`
}

func (s *Service) AccountActivity(actor *model.User) (*AccountActivity, error) {
	if actor == nil || actor.ID == "" {
		return nil, Unauthorized("请先登录")
	}
	today := time.Now().UTC().Truncate(24 * time.Hour)
	from := today.AddDate(0, 0, -(accountActivityDays - 1))
	to := today.AddDate(0, 0, 1)
	consumption, activities, err := s.repo.AccountUsageActivity(actor.ID, from, to)
	if err != nil {
		return nil, err
	}
	return buildAccountActivity(from, today, consumption, activities), nil
}

func buildAccountActivity(from, today time.Time, consumption []repository.AccountConsumptionDay, activities []model.UserDailyActivity) *AccountActivity {
	consumedByDay := make(map[string]int64, len(consumption))
	for _, row := range consumption {
		consumedByDay[row.Day] = row.ConsumedMicrocredits
	}
	activeByDay := make(map[string]bool, len(activities))
	for _, activity := range activities {
		if meaningfulAccountActivity(activity) {
			activeByDay[activity.Day.UTC().Format("2006-01-02")] = true
		}
	}
	result := &AccountActivity{
		From: from.Format("2006-01-02"),
		To:   today.Format("2006-01-02"),
		Days: make([]AccountActivityDay, 0, accountActivityDays),
	}
	currentStreak, longestStreak := 0, 0
	for index := 0; index < accountActivityDays; index++ {
		day := from.AddDate(0, 0, index)
		key := day.Format("2006-01-02")
		consumed := consumedByDay[key]
		active := activeByDay[key] || consumed > 0
		result.Days = append(result.Days, AccountActivityDay{Day: key, ConsumedMicrocredits: consumed, Active: active})
		result.Summary.TotalConsumedMicrocredits += consumed
		if consumed > result.Summary.DailyPeakMicrocredits {
			result.Summary.DailyPeakMicrocredits = consumed
		}
		if index >= accountActivityDays-7 {
			result.Summary.LastSevenDaysMicrocredits += consumed
		}
		if active {
			result.Summary.ActiveDays++
			currentStreak++
			if currentStreak > longestStreak {
				longestStreak = currentStreak
			}
		} else {
			currentStreak = 0
		}
	}
	result.Summary.LongestStreak = longestStreak
	return result
}

func meaningfulAccountActivity(activity model.UserDailyActivity) bool {
	return activity.LoginCount > 0 || activity.TaskCount > 0 || activity.AgentMessageCount > 0 || activity.CanvasActive || activity.AssetCount > 0 || activity.ResourceCount > 0
}
