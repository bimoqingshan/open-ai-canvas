package app

import (
	"encoding/json"
	"strings"
	"testing"

	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func newAcademyTestService(t *testing.T) (*Service, *repository.Repository) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if sqlDB, err := db.DB(); err == nil {
		sqlDB.SetMaxOpenConns(1)
	}
	if err := db.AutoMigrate(&model.AcademySetting{}, &model.AdminAuditEvent{}); err != nil {
		t.Fatal(err)
	}
	repo := repository.New(db)
	return New(repo, t.TempDir()), repo
}

func TestPublicAcademySeparatesCardsFromCourseSections(t *testing.T) {
	svc, _ := newAcademyTestService(t)
	config, err := svc.PublicAcademyConfig()
	if err != nil {
		t.Fatal(err)
	}
	if len(config.Tabs) != 2 || len(config.Tabs[0].Courses) != 12 {
		t.Fatalf("default academy = %d tabs, %d tutorial courses", len(config.Tabs), len(config.Tabs[0].Courses))
	}
	if len(config.Tabs[0].Courses[0].Sections) != 0 {
		t.Fatal("public course cards should not include section bodies")
	}

	detail, category, err := svc.PublicAcademyCourse("canvas-node")
	if err != nil {
		t.Fatal(err)
	}
	if category != "图文教程" || len(detail.Sections) == 0 || detail.Sections[0].Content == "" {
		t.Fatalf("course detail = category %q, sections %#v", category, detail.Sections)
	}
	if detail.DetailTitle != "「基础功能」画布与节点" || len(detail.Tags) != 5 || detail.Sections[0].Title != "什么是画布？" {
		t.Fatalf("canvas course defaults do not match the academy reference: %#v", detail)
	}
}

func TestPublicAcademyHidesDisabledTabsAndCourses(t *testing.T) {
	svc, repo := newAcademyTestService(t)
	config := defaultAcademyConfig()
	config.Tabs[0].Courses[0].Enabled = false
	config.Tabs[1].Enabled = false
	encoded, err := json.Marshal(config)
	if err != nil {
		t.Fatal(err)
	}
	if err := repo.SaveAcademySetting(&model.AcademySetting{ID: "academy", ConfigJSON: string(encoded)}); err != nil {
		t.Fatal(err)
	}

	public, err := svc.PublicAcademyConfig()
	if err != nil {
		t.Fatal(err)
	}
	if len(public.Tabs) != 1 || len(public.Tabs[0].Courses) != 11 {
		t.Fatalf("public tabs = %d, courses = %d", len(public.Tabs), len(public.Tabs[0].Courses))
	}
	if _, _, err := svc.PublicAcademyCourse("canvas-node"); err == nil {
		t.Fatal("disabled course should not be public")
	}
}

func TestAcademyConfigurationRequiresAdminAndValidatesContent(t *testing.T) {
	svc, repo := newAcademyTestService(t)
	regularUser := &model.User{ID: "user-1", Role: model.UserRoleUser}
	if _, err := svc.AdminAcademyConfig(regularUser); err == nil {
		t.Fatal("regular user should not read admin academy config")
	}

	admin := &model.User{ID: "admin-1", Role: model.UserRoleAdmin}
	config := defaultAcademyConfig()
	config.Title = "影策学院"
	config.Tabs[0].Courses[0].Sections[0].Content = strings.Repeat("x", academyMaxMarkdown+1)
	if _, err := svc.UpdateAcademyConfig(admin, config); err == nil {
		t.Fatal("oversized chapter content should be rejected")
	}

	config = defaultAcademyConfig()
	config.Title = "影策学院"
	updated, err := svc.UpdateAcademyConfig(admin, config)
	if err != nil {
		t.Fatal(err)
	}
	if updated.Title != "影策学院" {
		t.Fatalf("updated title = %q", updated.Title)
	}
	stored, err := repo.AcademySetting()
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(stored.ConfigJSON, "影策学院") {
		t.Fatalf("saved academy config does not include updated title: %s", stored.ConfigJSON[:min(len(stored.ConfigJSON), 120)])
	}
}
