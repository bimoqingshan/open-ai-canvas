package database

import (
	"strings"
	"testing"
	"time"

	"yingce/backend/internal/model"

	"gorm.io/gorm"
)

func TestMigrateSchemaPreservesInspirationsTable(t *testing.T) {
	db, err := Open(Config{Driver: "sqlite", DSN: "file:" + t.Name() + "?mode=memory&cache=shared"})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })
	if err := db.Exec("CREATE TABLE inspirations (id TEXT PRIMARY KEY, title TEXT)").Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Exec("INSERT INTO inspirations (id, title) VALUES (?, ?)", "preserve-me", "保留内容").Error; err != nil {
		t.Fatal(err)
	}
	if err := MigrateSchema(db); err != nil {
		t.Fatal(err)
	}
	var preserved model.Inspiration
	if err := db.First(&preserved, "id = ?", "preserve-me").Error; err != nil || preserved.Title != "保留内容" {
		t.Fatalf("legacy inspiration was not preserved: %#v %v", preserved, err)
	}
}

func legacyFolderMigrationDatabase(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := Open(Config{Driver: "sqlite", DSN: "file:" + t.Name() + "?mode=memory&cache=shared"})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })
	if err := db.AutoMigrate(&schemaMigration{}); err != nil {
		t.Fatal(err)
	}
	for _, item := range schemaMigrations[:5] {
		if err := item.apply(db); err != nil {
			t.Fatal(err)
		}
		if err := db.Create(&schemaMigration{Version: item.version, Name: item.name, Checksum: item.checksum, AppliedAt: time.Now().UTC()}).Error; err != nil {
			t.Fatal(err)
		}
	}
	if err := migrateSchemaV7(db); err != nil {
		t.Fatal(err)
	}
	for _, column := range []string{"playback_status", "playback_object_key", "playback_error"} {
		if db.Migrator().HasColumn(&model.Resource{}, column) {
			if err := db.Migrator().DropColumn(&model.Resource{}, column); err != nil {
				t.Fatal(err)
			}
		}
	}
	if err := db.Create(&schemaMigration{Version: 6, Name: "asset_library_folders", Checksum: assetLibraryFoldersChecksum, AppliedAt: time.Date(2026, 9, 2, 0, 0, 0, 0, time.UTC)}).Error; err != nil {
		t.Fatal(err)
	}
	return db
}

func TestMigrateSchemaPreservesLegacyFolderMigration(t *testing.T) {
	db := legacyFolderMigrationDatabase(t)
	var before schemaMigration
	if err := db.First(&before, "version = 6").Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Exec("INSERT INTO asset_folders (id, user_id, name) VALUES ('kept-folder', 'owner', 'Keep me')").Error; err != nil {
		t.Fatal(err)
	}
	for attempt := 0; attempt < 2; attempt++ {
		if err := MigrateSchema(db); err != nil {
			t.Fatal(err)
		}
		if err := RequireSchemaVersion(db); err != nil {
			t.Fatal(err)
		}
	}
	var after schemaMigration
	if err := db.First(&after, "version = 6").Error; err != nil {
		t.Fatal(err)
	}
	if before.Name != after.Name || before.Checksum != after.Checksum || !before.AppliedAt.Equal(after.AppliedAt) {
		t.Fatalf("historical record changed: before=%+v after=%+v", before, after)
	}
	var playback schemaMigration
	if err := db.First(&playback, "version = 7").Error; err != nil {
		t.Fatal(err)
	}
	if playback.Name != "resource_playback_variant" || playback.Checksum != resourcePlaybackChecksum {
		t.Fatalf("unexpected playback migration: %+v", playback)
	}
	for _, column := range []string{"playback_status", "playback_object_key", "playback_error"} {
		if !db.Migrator().HasColumn(&model.Resource{}, column) {
			t.Fatalf("missing playback column %s", column)
		}
	}
	var name string
	if err := db.Raw("SELECT name FROM asset_folders WHERE id = 'kept-folder'").Scan(&name).Error; err != nil || name != "Keep me" {
		t.Fatalf("folder data changed: %q %v", name, err)
	}
}

func TestMigrateSchemaRejectsUnknownLegacyLineage(t *testing.T) {
	for _, scenario := range []string{"checksum", "name", "version-seven"} {
		t.Run(scenario, func(t *testing.T) {
			db := legacyFolderMigrationDatabase(t)
			switch scenario {
			case "checksum":
				if err := db.Model(&schemaMigration{}).Where("version = 6").Update("checksum", "unknown").Error; err != nil {
					t.Fatal(err)
				}
			case "name":
				if err := db.Model(&schemaMigration{}).Where("version = 6").Update("name", "unknown").Error; err != nil {
					t.Fatal(err)
				}
			case "version-seven":
				if err := db.Create(&schemaMigration{Version: 7, Name: "asset_library_folders", Checksum: assetLibraryFoldersChecksum, AppliedAt: time.Now().UTC()}).Error; err != nil {
					t.Fatal(err)
				}
			}
			if err := MigrateSchema(db); err == nil || !strings.Contains(err.Error(), "不一致") {
				t.Fatalf("expected lineage rejection, got %v", err)
			}
			if db.Migrator().HasColumn(&model.Resource{}, "playback_status") {
				t.Fatal("rejected migration changed resource schema")
			}
		})
	}
}

func TestMigrateSchemaPreservesCreditAccountIdentityLineage(t *testing.T) {
	db, err := Open(Config{Driver: "sqlite", DSN: "file:" + t.Name() + "?mode=memory&cache=shared"})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })
	if err := MigrateSchema(db); err != nil {
		t.Fatal(err)
	}
	legacy := schemaMigration{Version: 109, Name: "credit_account_identity", Checksum: "sha256:credit-account-identity-v109-20261121", AppliedAt: time.Date(2026, 11, 21, 0, 0, 0, 0, time.UTC)}
	if err := db.Model(&schemaMigration{}).Where("version = ?", legacy.Version).Updates(map[string]any{"name": legacy.Name, "checksum": legacy.Checksum, "applied_at": legacy.AppliedAt}).Error; err != nil {
		t.Fatal(err)
	}
	account := model.CreditAccount{UserID: "legacy-user", AvailableMicrocredits: 1234, ReservedMicrocredits: 56}
	if err := db.Create(&account).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Model(&model.CreditAccount{}).Where("id = ?", account.ID).Update("id", "legacy-random-account").Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Migrator().DropIndex(&model.ChannelModel{}, "ProtocolRelease"); err != nil {
		t.Fatal(err)
	}
	for attempt := 0; attempt < 2; attempt++ {
		if err := MigrateSchema(db); err != nil {
			t.Fatal(err)
		}
	}
	var after schemaMigration
	if err := db.First(&after, "version = ?", legacy.Version).Error; err != nil {
		t.Fatal(err)
	}
	if after.Name != legacy.Name || after.Checksum != legacy.Checksum || !after.AppliedAt.Equal(legacy.AppliedAt) {
		t.Fatalf("legacy ledger entry changed: %+v", after)
	}
	if !db.Migrator().HasIndex(&model.ChannelModel{}, "ProtocolRelease") {
		t.Fatal("current protocol-release index was not restored")
	}
	var preserved model.CreditAccount
	if err := db.First(&preserved, "user_id = ?", "legacy-user").Error; err != nil {
		t.Fatal(err)
	}
	if preserved.ID != "legacy-random-account" || preserved.AvailableMicrocredits != 1234 || preserved.ReservedMicrocredits != 56 {
		t.Fatalf("legacy credit account changed: %+v", preserved)
	}
}
