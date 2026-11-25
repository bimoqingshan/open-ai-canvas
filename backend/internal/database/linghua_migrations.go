package database

import (
	"errors"
	"fmt"
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
