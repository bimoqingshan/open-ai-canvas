package app

import (
	"testing"

	"yingce/backend/internal/model"
)

func TestNormalizeNavigationMenuItemOnlyAllowsLinghuaPaths(t *testing.T) {
	base := NavigationMenuItemInput{ID: "custom-page", Title: "新增页面", Path: "/linghua/custom-page", GroupTitle: "社区", Icon: "Sparkles"}
	if _, err := normalizeNavigationMenuItem(base); err != nil {
		t.Fatalf("Linghua route rejected: %v", err)
	}

	for _, path := range []string{"/projects", "/", "//outside.example", "/linghua/page?tab=all", "/linghua\\page"} {
		input := base
		input.Path = path
		if _, err := normalizeNavigationMenuItem(input); err == nil {
			t.Errorf("path %q should be rejected", path)
		}
	}
}

func TestNormalizeContactNavigationMenuAllowsBottomPlacementAndValidCards(t *testing.T) {
	input := NavigationMenuItemInput{
		ID: "contact-us", Title: "联系我们", Path: "/linghua/contact", Icon: "MessageCircle",
		ContactCards: []model.NavigationContactCard{{Title: "飞书群", Description: "获取最新动态", ImageURL: "/uploads/contact.png"}},
	}
	if _, err := normalizeNavigationMenuItem(input); err != nil {
		t.Fatalf("valid contact menu rejected: %v", err)
	}
	input.ContactCards[0].ImageURL = "javascript:alert(1)"
	if _, err := normalizeNavigationMenuItem(input); err == nil {
		t.Fatal("unsafe image URL should be rejected")
	}
}
