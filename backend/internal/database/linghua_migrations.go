package database

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
	"yingce/backend/internal/model"
)

type linghuaSchemaMigration schemaMigration

func (linghuaSchemaMigration) TableName() string { return "linghua_schema_migrations" }

var linghuaSchemaMigrations = []migration{
	{version: 1, name: "linghua_home_community_navigation", checksum: "sha256:linghua-home-community-navigation-v1-20261125", apply: func(tx *gorm.DB) error {
		if err := tx.AutoMigrate(
			&model.CommunityWork{},
			&model.CommunityCategory{},
			&model.CreatorChallenge{},
			&model.HomeCarouselSetting{},
			&model.NavigationMenuItem{},
			&model.LearningSquareSetting{},
		); err != nil {
			return err
		}
		items := []model.NavigationMenuItem{
			{ID: "learning", Title: "学习广场", Path: "/linghua/learning", GroupTitle: "社区", GroupOrder: 2, SortOrder: 10, Icon: "GraduationCap", Enabled: true, BuiltIn: true},
			{ID: "community-works", Title: "社区作品", Path: "/linghua/community", GroupTitle: "社区", GroupOrder: 2, SortOrder: 20, Icon: "TvMinimalPlay", Enabled: true, BuiltIn: true},
			{ID: "challenges", Title: "活动赛事", Path: "/linghua/challenges", GroupTitle: "社区", GroupOrder: 2, SortOrder: 30, Icon: "Trophy", Enabled: true, BuiltIn: true},
		}
		for index := range items {
			items[index].CreatedAt = time.Now().UTC()
			items[index].UpdatedAt = items[index].CreatedAt
			if err := tx.Where("id = ?", items[index].ID).FirstOrCreate(&items[index]).Error; err != nil {
				return err
			}
		}
		return nil
	}},
	{version: 2, name: "linghua_academy_content", checksum: "sha256:linghua-academy-content-v2-20261125", apply: func(tx *gorm.DB) error {
		return tx.AutoMigrate(&model.AcademySetting{})
	}},
	{version: 3, name: "linghua_contact_navigation", checksum: "sha256:linghua-contact-navigation-v3-20261125", apply: func(tx *gorm.DB) error {
		if err := tx.AutoMigrate(&model.NavigationMenuItem{}); err != nil {
			return err
		}
		item := model.NavigationMenuItem{ID: "contact-us", Title: "联系我们", Path: "/linghua/contact", Icon: "MessageCircle", Enabled: true, BuiltIn: true, ContactCards: []model.NavigationContactCard{}}
		item.CreatedAt = time.Now().UTC()
		item.UpdatedAt = item.CreatedAt
		return tx.Where("id = ?", item.ID).FirstOrCreate(&item).Error
	}},
	{version: 4, name: "linghua_sync_legacy_content", checksum: "sha256:linghua-sync-legacy-content-v4-20261126", apply: migrateLegacyLinghuaContent},
	{version: 5, name: "linghua_challenge_poster_resource", checksum: "sha256:linghua-challenge-poster-resource-v5-20261126", apply: func(tx *gorm.DB) error {
		return tx.AutoMigrate(&model.CreatorChallenge{})
	}},
}

func MigrateLinghuaSchema(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		if tx.Dialector.Name() == "postgres" {
			if err := tx.Exec("SELECT pg_advisory_xact_lock(?)", postgresSchemaMigrationLockID+1).Error; err != nil {
				return fmt.Errorf("获取 Linghua 迁移锁：%w", err)
			}
		}
		if err := tx.AutoMigrate(&linghuaSchemaMigration{}); err != nil {
			return fmt.Errorf("初始化 Linghua 迁移记录：%w", err)
		}
		if err := moveUnreleasedLinghuaMigration(tx); err != nil {
			return err
		}
		for _, item := range linghuaSchemaMigrations {
			var applied linghuaSchemaMigration
			err := tx.First(&applied, "version = ?", item.version).Error
			if err == nil {
				if err := validateMigrationRecord(schemaMigration(applied), item); err != nil {
					return err
				}
				continue
			}
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				return fmt.Errorf("读取 Linghua 迁移 %d：%w", item.version, err)
			}
			if err := item.apply(tx); err != nil {
				return fmt.Errorf("执行 Linghua 迁移 %d（%s）：%w", item.version, item.name, err)
			}
			if err := tx.Create(&linghuaSchemaMigration{Version: item.version, Name: item.name, Checksum: item.checksum, AppliedAt: time.Now().UTC()}).Error; err != nil {
				return fmt.Errorf("记录 Linghua 迁移 %d：%w", item.version, err)
			}
		}
		return nil
	})
}

func moveUnreleasedLinghuaMigration(tx *gorm.DB) error {
	if !tx.Migrator().HasTable(&schemaMigration{}) {
		return nil
	}
	legacy := []migration{
		{version: 111, name: "community_home", checksum: "sha256:linghua-community-home-v111-20261125"},
		{version: 112, name: "personalized_navigation_menu", checksum: "sha256:linghua-navigation-menu-v112-20261125"},
	}
	found := false
	for _, expected := range legacy {
		var row schemaMigration
		err := tx.First(&row, "version = ?", expected.version).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			continue
		}
		if err != nil {
			return err
		}
		found = true
		if err := validateMigrationRecord(row, expected); err != nil {
			return fmt.Errorf("旧 Linghua 迁移记录不匹配：%w", err)
		}
	}
	if !found {
		return nil
	}
	for _, expected := range legacy {
		var row schemaMigration
		if err := tx.First(&row, "version = ?", expected.version).Error; err != nil {
			return fmt.Errorf("旧 Linghua 迁移账本不完整：%w", err)
		}
	}
	for _, pair := range [][2]string{
		{"community_works", "linghua_community_works"},
		{"community_categories", "linghua_community_categories"},
		{"creator_challenges", "linghua_creator_challenges"},
		{"home_carousel_settings", "linghua_home_carousel_settings"},
		{"navigation_menu_items", "linghua_navigation_menu_items"},
	} {
		oldExists := tx.Migrator().HasTable(pair[0])
		newExists := tx.Migrator().HasTable(pair[1])
		if oldExists && newExists {
			return fmt.Errorf("Linghua 表迁移目标已存在：%s", pair[1])
		}
		if oldExists {
			if err := tx.Migrator().RenameTable(pair[0], pair[1]); err != nil {
				return fmt.Errorf("迁移 Linghua 表 %s：%w", pair[0], err)
			}
		}
	}
	if tx.Migrator().HasTable(&model.NavigationMenuItem{}) {
		if err := tx.Where("built_in = ? AND id NOT IN ?", true, []string{"learning", "community-works", "challenges"}).Delete(&model.NavigationMenuItem{}).Error; err != nil {
			return fmt.Errorf("移除旧迁移中预置的上游导航项：%w", err)
		}
		for id, path := range map[string]string{"learning": "/linghua/learning", "community-works": "/linghua/community", "challenges": "/linghua/challenges"} {
			if err := tx.Model(&model.NavigationMenuItem{}).Where("id = ?", id).Update("path", path).Error; err != nil {
				return fmt.Errorf("更新 Linghua 导航路径 %s：%w", id, err)
			}
		}
	}
	for _, expected := range legacy {
		if err := tx.Delete(&schemaMigration{}, "version = ?", expected.version).Error; err != nil {
			return fmt.Errorf("移除未发布的 Linghua 主迁移记录 %d：%w", expected.version, err)
		}
	}
	return nil
}

func migrateLegacyLinghuaContent(tx *gorm.DB) error {
	if err := copyLegacyLinghuaRows(tx, "community_categories", "linghua_community_categories", []string{"id", "name", "description", "sort_order", "enabled", "created_at", "updated_at"}); err != nil {
		return err
	}
	if err := copyLegacyLinghuaRows(tx, "creator_challenges", "linghua_creator_challenges", []string{"id", "title", "description", "activity_tag", "tracks_json", "starts_at", "ends_at", "enabled", "created_at", "updated_at"}); err != nil {
		return err
	}
	if err := copyLegacyLinghuaRows(tx, "community_works", "linghua_community_works", []string{"id", "user_id", "team_id", "canvas_project_id", "video_resource_id", "cover_resource_id", "title", "description", "creator_name", "social_url", "challenge_id", "challenge_title", "track_id", "track_title", "category_id", "category_title", "position", "public_canvas", "status", "review_note", "reviewed_by", "reviewed_at", "created_at", "updated_at"}); err != nil {
		return err
	}
	if err := copyLegacyLinghuaRows(tx, "home_carousel_settings", "linghua_home_carousel_settings", []string{"id", "config_json", "updated_by", "updated_at"}); err != nil {
		return err
	}
	if err := copyLegacyLinghuaRows(tx, "learning_square_settings", "linghua_learning_square_settings", []string{"id", "config_json", "updated_by", "updated_at"}); err != nil {
		return err
	}
	if err := copyLegacyLinghuaRows(tx, "navigation_menu_items", "linghua_navigation_menu_items", []string{"id", "title", "path", "group_title", "group_order", "sort_order", "icon", "enabled", "built_in", "contact_cards", "created_at", "updated_at"}); err != nil {
		return err
	}
	return nil
}

func copyLegacyLinghuaRows(tx *gorm.DB, oldTable, newTable string, columns []string) error {
	if !tx.Migrator().HasTable(oldTable) {
		return nil
	}
	if !tx.Migrator().HasTable(newTable) {
		return fmt.Errorf("Linghua 迁移目标表不存在：%s", newTable)
	}
	quotedColumns := make([]string, len(columns))
	for index, column := range columns {
		quotedColumns[index] = tx.Statement.Quote(column)
	}
	columnList := strings.Join(quotedColumns, ", ")
	if err := tx.Exec(fmt.Sprintf("INSERT INTO %s (%s) SELECT %s FROM %s WHERE true ON CONFLICT (%s) DO NOTHING", tx.Statement.Quote(newTable), columnList, columnList, tx.Statement.Quote(oldTable), tx.Statement.Quote("id"))).Error; err != nil {
		return fmt.Errorf("同步旧 Linghua 表 %s：%w", oldTable, err)
	}
	var oldCount, newCount int64
	if err := tx.Table(oldTable).Count(&oldCount).Error; err != nil {
		return fmt.Errorf("统计旧 Linghua 表 %s：%w", oldTable, err)
	}
	if err := tx.Table(newTable).Count(&newCount).Error; err != nil {
		return fmt.Errorf("统计 Linghua 表 %s：%w", newTable, err)
	}
	if newCount < oldCount {
		return fmt.Errorf("Linghua 表 %s 同步不完整：旧表 %d 条，新表 %d 条", oldTable, oldCount, newCount)
	}
	var missingCount int64
	if err := tx.Table(oldTable).Joins("LEFT JOIN " + tx.Statement.Quote(newTable) + " ON " + tx.Statement.Quote(newTable) + ".id = " + tx.Statement.Quote(oldTable) + ".id").Where(tx.Statement.Quote(newTable) + ".id IS NULL").Count(&missingCount).Error; err != nil {
		return fmt.Errorf("核对旧 Linghua 表 %s：%w", oldTable, err)
	}
	if missingCount > 0 {
		return fmt.Errorf("Linghua 表 %s 仍有 %d 条记录未同步", oldTable, missingCount)
	}
	if err := tx.Migrator().DropTable(oldTable); err != nil {
		return fmt.Errorf("移除已同步的旧 Linghua 表 %s：%w", oldTable, err)
	}
	return nil
}

func validateLinghuaMigrationRecords(db *gorm.DB) error {
	if !db.Migrator().HasTable(&linghuaSchemaMigration{}) {
		return fmt.Errorf("缺少 Linghua 迁移账本")
	}
	var count int64
	if err := db.Model(&linghuaSchemaMigration{}).Count(&count).Error; err != nil {
		return err
	}
	if count != int64(len(linghuaSchemaMigrations)) {
		return nil
	}
	for _, item := range linghuaSchemaMigrations {
		var row linghuaSchemaMigration
		if err := db.First(&row, "version = ?", item.version).Error; err != nil {
			return err
		}
		if err := validateMigrationRecord(schemaMigration(row), item); err != nil {
			return err
		}
	}
	return nil
}
