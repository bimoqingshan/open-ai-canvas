package database

import (
	"fmt"
	"testing"
	"time"

	"yingce/backend/internal/model"
)

type legacyCommunityWork model.CommunityWork

func (legacyCommunityWork) TableName() string { return "community_works" }

type legacyCommunityCategory model.CommunityCategory

func (legacyCommunityCategory) TableName() string { return "community_categories" }

type legacyCreatorChallenge model.CreatorChallenge

func (legacyCreatorChallenge) TableName() string { return "creator_challenges" }

type legacyHomeCarouselSetting model.HomeCarouselSetting

func (legacyHomeCarouselSetting) TableName() string { return "home_carousel_settings" }

type legacyNavigationMenuItem model.NavigationMenuItem

func (legacyNavigationMenuItem) TableName() string { return "navigation_menu_items" }

func TestMigrateSchemaKeepsLinghuaTablesInSeparateLedger(t *testing.T) {
	db, err := Open(Config{Driver: "sqlite", DSN: fmt.Sprintf("file:linghua-ledger-%p?mode=memory&cache=shared", t)})
	if err != nil {
		t.Fatal(err)
	}
	if err := MigrateSchema(db); err != nil {
		t.Fatal(err)
	}
	status, err := ReadSchemaStatus(db)
	if err != nil {
		t.Fatal(err)
	}
	if !status.Ready || status.Current != CurrentSchemaVersion || status.LinghuaCurrent != 3 || status.LinghuaExpected != 3 {
		t.Fatalf("unexpected schema status: %#v", status)
	}
	for _, table := range []string{
		"linghua_community_works",
		"linghua_community_categories",
		"linghua_creator_challenges",
		"linghua_home_carousel_settings",
		"linghua_navigation_menu_items",
		"linghua_learning_square_settings",
		"linghua_academy_settings",
	} {
		if !db.Migrator().HasTable(table) {
			t.Errorf("missing Linghua table %s", table)
		}
	}
	if db.Migrator().HasTable("community_works") || db.Migrator().HasTable("navigation_menu_items") {
		t.Fatal("created a table without the Linghua prefix")
	}
	if err := MigrateSchema(db); err != nil {
		t.Fatalf("Linghua migration is not idempotent: %v", err)
	}
}

func TestLinghuaMigrationMovesUnreleasedTablesAndKeepsOnlyLinghuaMenuItems(t *testing.T) {
	db, err := Open(Config{Driver: "sqlite", DSN: fmt.Sprintf("file:linghua-legacy-%p?mode=memory&cache=shared", t)})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&schemaMigration{}, &legacyCommunityWork{}, &legacyCommunityCategory{}, &legacyCreatorChallenge{}, &legacyHomeCarouselSetting{}, &legacyNavigationMenuItem{}); err != nil {
		t.Fatal(err)
	}
	for _, item := range []struct {
		version  int64
		name     string
		checksum string
	}{
		{111, "community_home", "sha256:linghua-community-home-v111-20261125"},
		{112, "personalized_navigation_menu", "sha256:linghua-navigation-menu-v112-20261125"},
	} {
		if err := db.Create(&schemaMigration{Version: item.version, Name: item.name, Checksum: item.checksum, AppliedAt: time.Now().UTC()}).Error; err != nil {
			t.Fatal(err)
		}
	}
	legacyWork := legacyCommunityWork(model.CommunityWork{ID: "community-legacy", Title: "保留作品"})
	if err := db.Create(&legacyWork).Error; err != nil {
		t.Fatal(err)
	}
	menuItems := []legacyNavigationMenuItem{
		{ID: "home", Title: "创作", Path: "/", GroupTitle: "创作", Enabled: true, BuiltIn: true},
		{ID: "community-works", Title: "社区作品", Path: "/tv-show", GroupTitle: "社区", Enabled: true, BuiltIn: true},
		{ID: "linghua-extra", Title: "新增页面", Path: "/linghua/extra", GroupTitle: "社区", Enabled: true},
	}
	if err := db.Create(&menuItems).Error; err != nil {
		t.Fatal(err)
	}
	if err := MigrateLinghuaSchema(db); err != nil {
		t.Fatal(err)
	}
	if db.Migrator().HasTable("community_works") || !db.Migrator().HasTable("linghua_community_works") {
		t.Fatal("legacy community table was not moved under the Linghua prefix")
	}
	var migrated model.CommunityWork
	if err := db.First(&migrated, "id = ?", "community-legacy").Error; err != nil || migrated.Title != "保留作品" {
		t.Fatalf("legacy community data was not preserved: %#v %v", migrated, err)
	}
	var menus []model.NavigationMenuItem
	if err := db.Order("id").Find(&menus).Error; err != nil {
		t.Fatal(err)
	}
	if len(menus) != 5 {
		t.Fatalf("expected four Linghua built-ins and one custom menu, got %#v", menus)
	}
	for _, menu := range menus {
		if menu.ID == "home" || menu.ID == "assets" || menu.ID == "canvas" {
			t.Fatalf("upstream menu leaked into Linghua navigation: %#v", menu)
		}
	}
	var remaining int64
	if err := db.Model(&schemaMigration{}).Where("version IN ?", []int64{111, 112}).Count(&remaining).Error; err != nil || remaining != 0 {
		t.Fatalf("legacy extension entries remain in upstream ledger: count=%d err=%v", remaining, err)
	}
}
