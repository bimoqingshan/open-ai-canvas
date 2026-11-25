package app

import (
	"regexp"
	"strings"
	"time"

	"yingce/backend/internal/model"
)

var navigationMenuIDPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,63}$`)

var reservedNavigationMenuIDs = map[string]struct{}{
	"home": {}, "assets": {}, "canvas": {}, "projects": {}, "teams": {}, "ecommerce": {},
	"toolbox-image": {}, "toolbox-video": {}, "skills": {}, "plugins": {}, "tasks": {},
	"learning": {}, "community-works": {}, "challenges": {}, "contact-us": {},
}

type NavigationMenuItemInput struct {
	ID           string                        `json:"id"`
	Title        string                        `json:"title"`
	Path         string                        `json:"path"`
	GroupTitle   string                        `json:"groupTitle"`
	GroupOrder   int                           `json:"groupOrder"`
	SortOrder    int                           `json:"sortOrder"`
	Icon         string                        `json:"icon"`
	Enabled      bool                          `json:"enabled"`
	ContactCards []model.NavigationContactCard `json:"contactCards"`
}

func (s *Service) PublicNavigationMenu() ([]model.NavigationMenuItem, error) {
	return s.repo.NavigationMenuItems(true)
}

func (s *Service) AdminNavigationMenu(actor *model.User) ([]model.NavigationMenuItem, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	return s.repo.NavigationMenuItems(false)
}

func (s *Service) SaveAdminNavigationMenu(actor *model.User, inputs []NavigationMenuItemInput) ([]model.NavigationMenuItem, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	currentItems, err := s.repo.NavigationMenuItems(false)
	if err != nil {
		return nil, err
	}
	currentByID := make(map[string]model.NavigationMenuItem, len(currentItems))
	for _, current := range currentItems {
		currentByID[current.ID] = current
	}
	items := make([]model.NavigationMenuItem, 0, len(inputs))
	seen := make(map[string]struct{}, len(inputs))
	now := time.Now().UTC()
	for _, input := range inputs {
		item, err := normalizeNavigationMenuItem(input)
		if err != nil {
			return nil, err
		}
		if _, duplicate := seen[item.ID]; duplicate {
			return nil, BadAuthRequest("菜单标识不能重复")
		}
		seen[item.ID] = struct{}{}
		if current, exists := currentByID[item.ID]; exists {
			item.BuiltIn = current.BuiltIn
			item.CreatedAt = current.CreatedAt
		} else {
			item.CreatedAt = now
		}
		item.UpdatedAt = now
		items = append(items, *item)
	}
	if err := s.repo.SaveNavigationMenuItems(items); err != nil {
		return nil, err
	}
	return items, nil
}

func (s *Service) SaveAdminNavigationMenuItem(actor *model.User, input NavigationMenuItemInput) (*model.NavigationMenuItem, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	item, err := normalizeNavigationMenuItem(input)
	if err != nil {
		return nil, err
	}
	currentItems, err := s.repo.NavigationMenuItems(false)
	if err != nil {
		return nil, err
	}
	for _, current := range currentItems {
		if current.ID == item.ID {
			item.CreatedAt = current.CreatedAt
			item.BuiltIn = current.BuiltIn
			break
		}
	}
	if item.CreatedAt.IsZero() {
		item.CreatedAt = time.Now().UTC()
	}
	item.UpdatedAt = time.Now().UTC()
	if err := s.repo.SaveNavigationMenuItem(item); err != nil {
		return nil, err
	}
	return item, nil
}

func (s *Service) DeleteAdminNavigationMenuItem(actor *model.User, id string) error {
	if err := s.RequireAdmin(actor); err != nil {
		return err
	}
	items, err := s.repo.NavigationMenuItems(false)
	if err != nil {
		return err
	}
	for _, item := range items {
		if item.ID == id {
			if item.BuiltIn {
				return BadAuthRequest("内置菜单不能删除，可关闭全站显示")
			}
			return s.repo.DeleteNavigationMenuItem(id)
		}
	}
	return BadAuthRequest("菜单不存在")
}

func normalizeNavigationMenuItem(input NavigationMenuItemInput) (*model.NavigationMenuItem, error) {
	input.ID = strings.TrimSpace(input.ID)
	input.Title = strings.TrimSpace(input.Title)
	input.Path = strings.TrimSpace(input.Path)
	input.GroupTitle = strings.TrimSpace(input.GroupTitle)
	input.Icon = strings.TrimSpace(input.Icon)
	if !navigationMenuIDPattern.MatchString(input.ID) {
		return nil, BadAuthRequest("菜单标识只能使用小写字母、数字和连字符")
	}
	if _, reserved := reservedNavigationMenuIDs[input.ID]; reserved && input.ID != "contact-us" {
		return nil, BadAuthRequest("该菜单标识由系统保留，请使用新的标识")
	}
	isContactMenu := input.ID == "contact-us"
	if input.Title == "" || len([]rune(input.Title)) > 80 || (!isContactMenu && input.GroupTitle == "") || len([]rune(input.GroupTitle)) > 80 {
		return nil, BadAuthRequest("菜单名称和分组名称不能为空且最多 80 个字符")
	}
	if len(input.Path) > 512 || !strings.HasPrefix(input.Path, "/linghua/") || strings.ContainsAny(input.Path, "\\?#\r\n") || (isContactMenu && input.Path != "/linghua/contact") {
		return nil, BadAuthRequest("Linghua 菜单地址必须以 /linghua/ 开头")
	}
	if input.Icon == "" || len(input.Icon) > 40 {
		return nil, BadAuthRequest("请选择有效的菜单图标")
	}
	if len(input.ContactCards) > 6 {
		return nil, BadAuthRequest("联系我们最多配置 6 张卡片")
	}
	if input.ContactCards == nil {
		input.ContactCards = []model.NavigationContactCard{}
	}
	for index := range input.ContactCards {
		card := &input.ContactCards[index]
		card.Title = strings.TrimSpace(card.Title)
		card.Description = strings.TrimSpace(card.Description)
		card.ImageURL = strings.TrimSpace(card.ImageURL)
		if card.Title == "" || len([]rune(card.Title)) > 80 || len([]rune(card.Description)) > 240 || len(card.ImageURL) > 2048 || (card.ImageURL != "" && !strings.HasPrefix(card.ImageURL, "/") && !strings.HasPrefix(card.ImageURL, "https://") && !strings.HasPrefix(card.ImageURL, "http://")) {
			return nil, BadAuthRequest("联系我们卡片内容无效")
		}
	}
	return &model.NavigationMenuItem{
		ID:           input.ID,
		Title:        input.Title,
		Path:         input.Path,
		GroupTitle:   input.GroupTitle,
		GroupOrder:   input.GroupOrder,
		SortOrder:    input.SortOrder,
		Icon:         input.Icon,
		Enabled:      input.Enabled,
		ContactCards: input.ContactCards,
	}, nil
}
