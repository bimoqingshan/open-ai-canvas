package repository

import (
	"path/filepath"
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"yingce/backend/internal/model"
)

func TestAccountUsageActivityScopesUserAndDateRange(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "account-usage.db")), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.CreditLedgerEntry{}, &model.UserDailyActivity{}); err != nil {
		t.Fatal(err)
	}
	sqlDB, _ := db.DB()
	t.Cleanup(func() { _ = sqlDB.Close() })
	from := time.Date(2025, time.January, 1, 0, 0, 0, 0, time.UTC)
	to := from.AddDate(0, 0, 2)
	rows := []model.CreditLedgerEntry{
		{ID: "consume-one", UserID: "user-one", Type: model.CreditLedgerConsume, AmountMicrocredits: -500, CreatedAt: from.Add(23*time.Hour + 59*time.Minute)},
		{ID: "consume-two", UserID: "user-one", Type: model.CreditLedgerConsume, AmountMicrocredits: -200, CreatedAt: from.AddDate(0, 0, 1).Add(time.Minute)},
		{ID: "refund", UserID: "user-one", Type: model.CreditLedgerRefund, AmountMicrocredits: 500, CreatedAt: from.AddDate(0, 0, 1).Add(2 * time.Minute)},
		{ID: "other-user", UserID: "user-two", Type: model.CreditLedgerConsume, AmountMicrocredits: -900, CreatedAt: from.Add(time.Hour)},
		{ID: "outside-range", UserID: "user-one", Type: model.CreditLedgerConsume, AmountMicrocredits: -700, CreatedAt: to},
	}
	if err := db.Create(&rows).Error; err != nil {
		t.Fatal(err)
	}
	activity := model.UserDailyActivity{ID: "user-one:2025-01-02", UserID: "user-one", Day: from.AddDate(0, 0, 1), LoginCount: 1}
	if err := db.Create(&activity).Error; err != nil {
		t.Fatal(err)
	}
	consumption, activities, err := New(db).AccountUsageActivity("user-one", from, to)
	if err != nil {
		t.Fatal(err)
	}
	if len(consumption) != 2 || consumption[0].Day != "2025-01-01" || consumption[0].ConsumedMicrocredits != 500 || consumption[1].Day != "2025-01-02" || consumption[1].ConsumedMicrocredits != 200 {
		t.Fatalf("consumption = %#v", consumption)
	}
	if len(activities) != 1 || activities[0].UserID != "user-one" || activities[0].LoginCount != 1 {
		t.Fatalf("activities = %#v", activities)
	}
}
