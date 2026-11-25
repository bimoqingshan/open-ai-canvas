package repository

import (
	"errors"
	"sort"
	"strings"
	"time"

	"yingce/backend/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrCommunityWorkMediaUnavailable = errors.New("community work video or cover resource is unavailable")

func (r *Repository) CreateCommunityWork(work *model.CommunityWork) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := validateCommunityWorkMedia(tx, work, r.Dialect() == "postgres"); err != nil {
			return err
		}
		return tx.Create(work).Error
	})
}

func validateCommunityWorkMedia(tx *gorm.DB, work *model.CommunityWork, lock bool) error {
	if work == nil || strings.TrimSpace(work.UserID) == "" || work.VideoResourceID == "" || work.CoverResourceID == "" || work.VideoResourceID == work.CoverResourceID {
		return ErrCommunityWorkMediaUnavailable
	}
	resourceIDs := []string{work.VideoResourceID, work.CoverResourceID}
	sort.Strings(resourceIDs)
	query := tx.Where("user_id = ? AND id IN ?", work.UserID, resourceIDs).Order("id")
	if lock {
		query = query.Clauses(clause.Locking{Strength: "UPDATE"})
	}
	var resources []model.Resource
	if err := query.Find(&resources).Error; err != nil {
		return err
	}
	if len(resources) != 2 {
		return ErrCommunityWorkMediaUnavailable
	}
	byID := map[string]model.Resource{resources[0].ID: resources[0], resources[1].ID: resources[1]}
	video, videoOK := byID[work.VideoResourceID]
	cover, coverOK := byID[work.CoverResourceID]
	if !videoOK || !coverOK || video.Status != model.ResourceStatusReady || video.Kind != "video" || video.DurationMs < 30_000 || cover.Status != model.ResourceStatusReady || cover.Kind != "image" {
		return ErrCommunityWorkMediaUnavailable
	}
	return nil
}

func (r *Repository) DeleteCommunityWork(id string) error {
	return r.db.Delete(&model.CommunityWork{}, "id = ?", id).Error
}

func (r *Repository) CommunityWork(id string) (*model.CommunityWork, error) {
	var work model.CommunityWork
	if err := r.db.First(&work, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &work, nil
}

func (r *Repository) CommunityWorkForUser(userID, id string) (*model.CommunityWork, error) {
	var work model.CommunityWork
	if err := r.db.First(&work, "id = ? AND user_id = ?", id, userID).Error; err != nil {
		return nil, err
	}
	return &work, nil
}

func (r *Repository) CommunityWorksForUser(userID string) ([]model.CommunityWork, error) {
	var works []model.CommunityWork
	err := r.db.Where("user_id = ?", userID).Order("created_at desc, id desc").Limit(100).Find(&works).Error
	return works, err
}

func (r *Repository) CommunityWorksForUserOrTeams(userID string, teamIDs []string) ([]model.CommunityWork, error) {
	query := r.db.Where("user_id = ?", userID)
	if len(teamIDs) > 0 {
		query = query.Or("team_id IN ?", teamIDs)
	}
	var works []model.CommunityWork
	err := query.Order("created_at desc, id desc").Limit(100).Find(&works).Error
	return works, err
}

func (r *Repository) PublicCommunityWorks(keyword, challengeID, categoryID string, limit int) ([]model.CommunityWork, error) {
	return r.PublicCommunityWorksAfter(keyword, challengeID, categoryID, nil, limit)
}

type PublicCommunityWorkCursor struct {
	ID          string
	Position    int
	PublishedAt time.Time
	CreatedAt   time.Time
}

func (r *Repository) PublicCommunityWorksAfter(keyword, challengeID, categoryID string, cursor *PublicCommunityWorkCursor, limit int) ([]model.CommunityWork, error) {
	if limit < 1 || limit > 49 {
		limit = 24
	}
	query := r.db.Where("status = ?", model.CommunityWorkApproved)
	if challengeID != "" {
		query = query.Where("challenge_id = ?", challengeID)
	}
	if categoryID != "" {
		query = query.Where("category_id = ?", categoryID)
	}
	if keyword = strings.TrimSpace(keyword); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("(title LIKE ? OR description LIKE ? OR creator_name LIKE ? OR challenge_title LIKE ? OR track_title LIKE ?)", like, like, like, like, like)
	}
	const publishedAt = "COALESCE(reviewed_at, created_at)"
	if cursor != nil {
		if categoryID != "" {
			query = query.Where("(position > ? OR (position = ? AND "+publishedAt+" < ?) OR (position = ? AND "+publishedAt+" = ? AND created_at < ?) OR (position = ? AND "+publishedAt+" = ? AND created_at = ? AND id < ?))",
				cursor.Position, cursor.Position, cursor.PublishedAt,
				cursor.Position, cursor.PublishedAt, cursor.CreatedAt,
				cursor.Position, cursor.PublishedAt, cursor.CreatedAt, cursor.ID)
		} else {
			query = query.Where("("+publishedAt+" < ? OR ("+publishedAt+" = ? AND created_at < ?) OR ("+publishedAt+" = ? AND created_at = ? AND id < ?))",
				cursor.PublishedAt, cursor.PublishedAt, cursor.CreatedAt,
				cursor.PublishedAt, cursor.CreatedAt, cursor.ID)
		}
	}
	var works []model.CommunityWork
	ordering := publishedAt + " desc, created_at desc, id desc"
	if categoryID != "" {
		ordering = "position asc, " + ordering
	}
	err := query.Order(ordering).Limit(limit).Find(&works).Error
	return works, err
}

type CommunityCreatorAvatar struct {
	UserID            string `gorm:"column:user_id"`
	AvatarMode        string `gorm:"column:avatar_mode"`
	AvatarPreset      string `gorm:"column:avatar_preset"`
	AvatarVersion     string `gorm:"column:avatar_version"`
	IdentityAvatarURL string `gorm:"column:identity_avatar_url"`
}

func (r *Repository) CommunityCreatorAvatars(userIDs []string) (map[string]CommunityCreatorAvatar, error) {
	ids := make([]string, 0, len(userIDs))
	seen := make(map[string]struct{}, len(userIDs))
	for _, userID := range userIDs {
		userID = strings.TrimSpace(userID)
		if userID == "" {
			continue
		}
		if _, exists := seen[userID]; exists {
			continue
		}
		seen[userID] = struct{}{}
		ids = append(ids, userID)
	}
	result := make(map[string]CommunityCreatorAvatar, len(ids))
	if len(ids) == 0 {
		return result, nil
	}
	var profiles []CommunityCreatorAvatar
	err := r.db.Table("users").Select(`
		users.id AS user_id,
		users.avatar_mode,
		users.avatar_preset,
		users.avatar_version,
		COALESCE((
			SELECT avatar_url FROM user_identities
			WHERE user_identities.user_id = users.id AND user_identities.provider = ?
			ORDER BY user_identities.created_at ASC, user_identities.id ASC
			LIMIT 1
		), '') AS identity_avatar_url
	`, "linuxdo").Where("users.id IN ? AND users.status = ?", ids, model.UserStatusActive).Scan(&profiles).Error
	if err != nil {
		return nil, err
	}
	for _, profile := range profiles {
		result[profile.UserID] = profile
	}
	return result, nil
}

func (r *Repository) UpdateCommunityCategoryTitle(categoryID, title string) error {
	return r.db.Model(&model.CommunityWork{}).Where("category_id = ?", categoryID).Updates(map[string]any{"category_title": title, "updated_at": time.Now().UTC()}).Error
}

func (r *Repository) AdminCommunityWorks(status, categoryID, keyword string, page, limit int) ([]model.CommunityWork, int64, error) {
	query := r.db.Model(&model.CommunityWork{})
	if status != "" && status != "all" {
		query = query.Where("status = ?", status)
	}
	if categoryID != "" {
		query = query.Where("category_id = ?", categoryID)
	}
	if keyword = strings.TrimSpace(keyword); keyword != "" {
		pattern := "%" + keyword + "%"
		query = query.Where("(title LIKE ? OR creator_name LIKE ? OR challenge_title LIKE ? OR user_id = ?)", pattern, pattern, pattern, keyword)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	var works []model.CommunityWork
	ordering := "created_at desc, id desc"
	if status == string(model.CommunityWorkApproved) && categoryID != "" {
		ordering = "position asc, reviewed_at desc, created_at desc, id desc"
	}
	err := query.Order(ordering).Offset((page - 1) * limit).Limit(limit).Find(&works).Error
	return works, total, err
}

func (r *Repository) CommunityCategories(includeDisabled bool) ([]model.CommunityCategory, error) {
	query := r.db.Model(&model.CommunityCategory{})
	if !includeDisabled {
		query = query.Where("enabled = ?", true)
	}
	var categories []model.CommunityCategory
	err := query.Order("sort_order asc, created_at asc, id asc").Find(&categories).Error
	return categories, err
}

func (r *Repository) CommunityCategory(id string) (*model.CommunityCategory, error) {
	var category model.CommunityCategory
	if err := r.db.First(&category, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &category, nil
}

func (r *Repository) SaveCommunityCategory(category *model.CommunityCategory) error {
	return r.db.Save(category).Error
}

func (r *Repository) AssignCommunityWorksCategory(workIDs []string, category *model.CommunityCategory) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if len(workIDs) == 0 {
			return nil
		}
		query := tx.Where("id IN ?", workIDs).Order("id asc")
		if r.Dialect() == "postgres" {
			query = query.Clauses(clause.Locking{Strength: "UPDATE"})
		}
		var works []model.CommunityWork
		if err := query.Find(&works).Error; err != nil {
			return err
		}
		if len(works) != len(workIDs) {
			return gorm.ErrRecordNotFound
		}
		byID := make(map[string]model.CommunityWork, len(works))
		for _, work := range works {
			byID[work.ID] = work
		}
		var nextPosition int
		if err := tx.Model(&model.CommunityWork{}).
			Where("category_id = ? AND status = ?", category.ID, model.CommunityWorkApproved).
			Select("COALESCE(MAX(position), 0)").Scan(&nextPosition).Error; err != nil {
			return err
		}
		now := time.Now().UTC()
		for _, id := range workIDs {
			work := byID[id]
			updates := map[string]any{
				"category_id": category.ID, "category_title": category.Name, "updated_at": now,
			}
			if work.Status == model.CommunityWorkApproved && work.CategoryID != category.ID {
				nextPosition++
				updates["position"] = nextPosition
			} else if work.Status != model.CommunityWorkApproved {
				updates["position"] = 0
			}
			if err := tx.Model(&model.CommunityWork{}).Where("id = ?", id).Updates(updates).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *Repository) MoveCommunityWork(workID, categoryID string, direction int) (bool, error) {
	moved := false
	err := r.db.Transaction(func(tx *gorm.DB) error {
		currentQuery := tx.Where("id = ? AND status = ? AND category_id = ?", workID, model.CommunityWorkApproved, categoryID)
		if r.Dialect() == "postgres" {
			currentQuery = currentQuery.Clauses(clause.Locking{Strength: "UPDATE"})
		}
		var current model.CommunityWork
		if err := currentQuery.First(&current).Error; err != nil {
			return err
		}
		query := tx.Where("status = ? AND category_id = ?", model.CommunityWorkApproved, categoryID)
		if r.Dialect() == "postgres" {
			query = query.Clauses(clause.Locking{Strength: "UPDATE"})
		}
		var works []model.CommunityWork
		if err := query.Order("position asc, reviewed_at desc, created_at desc, id desc").Find(&works).Error; err != nil {
			return err
		}
		index := -1
		for i := range works {
			if works[i].ID == workID {
				index = i
				break
			}
		}
		if index < 0 {
			return gorm.ErrRecordNotFound
		}
		target := index + direction
		if target < 0 || target >= len(works) {
			return nil
		}
		works[index], works[target] = works[target], works[index]
		now := time.Now().UTC()
		for position, work := range works {
			if err := tx.Model(&model.CommunityWork{}).Where("id = ?", work.ID).Updates(map[string]any{
				"position": position + 1, "updated_at": now,
			}).Error; err != nil {
				return err
			}
		}
		moved = true
		return nil
	})
	return moved, err
}

func (r *Repository) ReviewCommunityWork(id, status, note, reviewerID string, now time.Time) (bool, error) {
	updated := false
	err := r.db.Transaction(func(tx *gorm.DB) error {
		var work model.CommunityWork
		query := tx.Where("id = ?", id)
		if r.Dialect() == "postgres" {
			query = query.Clauses(clause.Locking{Strength: "UPDATE"})
		}
		if err := query.First(&work).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}
		if status == string(model.CommunityWorkApproved) {
			if err := validateCommunityWorkMedia(tx, &work, r.Dialect() == "postgres"); err != nil {
				return err
			}
		}
		updates := map[string]any{
			"status": status, "review_note": note, "reviewed_by": reviewerID, "reviewed_at": now, "updated_at": now,
		}
		if status == string(model.CommunityWorkApproved) && work.Status != model.CommunityWorkApproved {
			var position int
			if err := tx.Model(&model.CommunityWork{}).
				Where("category_id = ? AND status = ?", work.CategoryID, model.CommunityWorkApproved).
				Select("COALESCE(MAX(position), 0)").Scan(&position).Error; err != nil {
				return err
			}
			updates["position"] = position + 1
		}
		result := tx.Model(&work).Updates(updates)
		updated = result.RowsAffected == 1
		return result.Error
	})
	return updated, err
}

func (r *Repository) SaveCreatorChallenge(challenge *model.CreatorChallenge) error {
	return r.db.Save(challenge).Error
}

func (r *Repository) CreatorChallenge(id string) (*model.CreatorChallenge, error) {
	var challenge model.CreatorChallenge
	if err := r.db.First(&challenge, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &challenge, nil
}

func (r *Repository) CreatorChallenges(includeDisabled bool) ([]model.CreatorChallenge, error) {
	query := r.db.Model(&model.CreatorChallenge{})
	if !includeDisabled {
		query = query.Where("enabled = ?", true)
	}
	var challenges []model.CreatorChallenge
	err := query.Order("starts_at desc, created_at desc, id desc").Find(&challenges).Error
	return challenges, err
}
