package app

import (
	"testing"
	"time"

	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
)

func TestBuildAccountActivitySummarizesUsageAndLoginDays(t *testing.T) {
	from := time.Date(2025, time.January, 1, 0, 0, 0, 0, time.UTC)
	today := from.AddDate(0, 0, accountActivityDays-1)
	day := func(offset int) string { return from.AddDate(0, 0, offset).Format("2006-01-02") }
	activity := func(offset int, loginCount, taskCount int) model.UserDailyActivity {
		return model.UserDailyActivity{Day: from.AddDate(0, 0, offset), LoginCount: loginCount, TaskCount: taskCount}
	}
	result := buildAccountActivity(from, today, []repository.AccountConsumptionDay{
		{Day: day(10), ConsumedMicrocredits: 99},
		{Day: day(360), ConsumedMicrocredits: 100},
		{Day: day(362), ConsumedMicrocredits: 200},
		{Day: day(364), ConsumedMicrocredits: 300},
	}, []model.UserDailyActivity{
		activity(10, 0, 1),
		activity(361, 1, 0),
		activity(363, 1, 0),
	})

	if len(result.Days) != accountActivityDays {
		t.Fatalf("days=%d, want %d", len(result.Days), accountActivityDays)
	}
	if result.Summary.TotalConsumedMicrocredits != 699 || result.Summary.DailyPeakMicrocredits != 300 || result.Summary.LastSevenDaysMicrocredits != 600 {
		t.Fatalf("usage summary = %#v", result.Summary)
	}
	if result.Summary.ActiveDays != 6 || result.Summary.LongestStreak != 5 {
		t.Fatalf("activity summary = %#v", result.Summary)
	}
	if !result.Days[361].Active || !result.Days[360].Active || result.Days[359].Active {
		t.Fatal("daily activity did not combine login and credit consumption days")
	}
}
