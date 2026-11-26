package app

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"gorm.io/gorm"
	"yingce/backend/internal/kernel"
	"yingce/backend/internal/model"
	"yingce/backend/internal/repository"
)

type CommunityWorkSubmission struct {
	CanvasProjectID string `json:"canvasProjectId"`
	TeamID          string `json:"teamId,omitempty"`
	VideoResourceID string `json:"videoResourceId"`
	CoverResourceID string `json:"coverResourceId"`
	Title           string `json:"title"`
	Description     string `json:"description"`
	SocialURL       string `json:"socialUrl"`
	ChallengeID     string `json:"challengeId"`
	TrackID         string `json:"trackId"`
	PublicCanvas    bool   `json:"publicCanvas"`
	TermsAccepted   bool   `json:"termsAccepted"`
}

type CreatorChallengeTrack struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type CreatorChallengeView struct {
	model.CreatorChallenge
	Tracks []CreatorChallengeTrack `json:"tracks"`
	Status string                  `json:"status"`
}

type CreatorChallengeRequest struct {
	ID          string                  `json:"id"`
	Title       string                  `json:"title"`
	Description string                  `json:"description"`
	ActivityTag string                  `json:"activityTag"`
	Tracks      []CreatorChallengeTrack `json:"tracks"`
	StartsAt    *time.Time              `json:"startsAt"`
	EndsAt      *time.Time              `json:"endsAt"`
	Enabled     bool                    `json:"enabled"`
}

var challengePosterResourcePattern = regexp.MustCompile(`!\[活动主视觉\]\(resource:([^)]+)\)`)

type CommunityWorkPage struct {
	Works []model.CommunityWork `json:"works"`
	Total int64                 `json:"total"`
	Page  int                   `json:"page"`
	Limit int                   `json:"pageSize"`
}

type MyCommunityWork struct {
	ID              string                    `json:"id"`
	TeamID          string                    `json:"teamId,omitempty"`
	CanvasProjectID string                    `json:"canvasProjectId"`
	Title           string                    `json:"title"`
	Description     string                    `json:"description"`
	CreatorName     string                    `json:"creatorName"`
	SocialURL       string                    `json:"socialUrl"`
	ChallengeID     string                    `json:"challengeId,omitempty"`
	ChallengeTitle  string                    `json:"challengeTitle,omitempty"`
	TrackID         string                    `json:"trackId,omitempty"`
	TrackTitle      string                    `json:"trackTitle,omitempty"`
	PublicCanvas    bool                      `json:"publicCanvas"`
	Status          model.CommunityWorkStatus `json:"status"`
	ReviewNote      string                    `json:"reviewNote,omitempty"`
	ReviewedAt      *time.Time                `json:"reviewedAt,omitempty"`
	CreatedAt       time.Time                 `json:"createdAt"`
	UpdatedAt       time.Time                 `json:"updatedAt"`
}

type AdminCommunityWork struct {
	model.CommunityWork
	CanvasProjectID string `json:"canvasProjectId"`
	VideoResourceID string `json:"videoResourceId"`
	CoverResourceID string `json:"coverResourceId"`
}

type AdminCommunityWorkPage struct {
	Works []AdminCommunityWork `json:"works"`
	Total int64                `json:"total"`
	Page  int                  `json:"page"`
	Limit int                  `json:"pageSize"`
}

type CommunityWorkReviewRequest struct {
	Status model.CommunityWorkStatus `json:"status"`
	Note   string                    `json:"note"`
}

type CommunityCategoryView struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	SortOrder   int       `json:"sortOrder"`
	Enabled     bool      `json:"enabled"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type CommunityCategoryRequest struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	SortOrder   int    `json:"sortOrder"`
	Enabled     bool   `json:"enabled"`
}

type CommunityWorkCategoryRequest struct {
	WorkIDs    []string `json:"workIds"`
	CategoryID string   `json:"categoryId"`
}

type CommunityWorkReorderRequest struct {
	WorkID     string `json:"workId"`
	CategoryID string `json:"categoryId"`
	Direction  int    `json:"direction"`
}

type PublicCommunityWork struct {
	ID                  string                 `json:"id"`
	Title               string                 `json:"title"`
	Description         string                 `json:"description"`
	CreatorName         string                 `json:"creatorName"`
	SocialURL           string                 `json:"socialUrl,omitempty"`
	ChallengeID         string                 `json:"challengeId,omitempty"`
	ChallengeTitle      string                 `json:"challengeTitle,omitempty"`
	TrackTitle          string                 `json:"trackTitle,omitempty"`
	CategoryID          string                 `json:"categoryId,omitempty"`
	CategoryTitle       string                 `json:"categoryTitle,omitempty"`
	PublicCanvas        bool                   `json:"publicCanvas"`
	CanvasURL           string                 `json:"canvasUrl,omitempty"`
	CoverURL            string                 `json:"coverUrl"`
	VideoURL            string                 `json:"videoUrl"`
	VideoSources        []CommunityVideoSource `json:"videoSources,omitempty"`
	CreatorAvatarURL    string                 `json:"creatorAvatarUrl,omitempty"`
	CreatorAvatarMode   string                 `json:"creatorAvatarMode,omitempty"`
	CreatorAvatarPreset string                 `json:"creatorAvatarPreset,omitempty"`
	PublishedAt         time.Time              `json:"publishedAt"`
}

type PublicCommunityWorkPage struct {
	Works      []PublicCommunityWork `json:"works"`
	NextCursor string                `json:"nextCursor,omitempty"`
}

type publicCommunityWorkCursor struct {
	ID          string    `json:"id"`
	Position    int       `json:"position"`
	PublishedAt time.Time `json:"publishedAt"`
	CreatedAt   time.Time `json:"createdAt"`
}

type CommunityVideoSource struct {
	URL     string `json:"url"`
	Label   string `json:"label,omitempty"`
	Quality string `json:"quality,omitempty"`
	Width   int    `json:"width,omitempty"`
	Height  int    `json:"height,omitempty"`
}

func (s *Service) SubmitCommunityWork(actor *model.User, req CommunityWorkSubmission) (*model.CommunityWork, error) {
	if actor == nil || strings.TrimSpace(actor.ID) == "" {
		return nil, Unauthorized("请先登录后发布作品")
	}
	projectID := strings.TrimSpace(req.CanvasProjectID)
	if projectID == "" {
		return nil, BadAuthRequest("当前画布信息无效")
	}
	teamID := strings.TrimSpace(req.TeamID)
	if teamID != "" {
		return nil, BadAuthRequest("当前版本暂不支持发布团队画布")
	}
	if _, err := s.repo.CanvasProjectForUser(actor.ID, projectID); err != nil {
		return nil, NotFound("画布不存在或无权访问")
	}
	if !req.TermsAccepted {
		return nil, BadAuthRequest("请先阅读并同意社区作品发布协议")
	}
	title := strings.TrimSpace(req.Title)
	if title == "" || utf8.RuneCountInString(title) > 80 {
		return nil, BadAuthRequest("作品名称必填且不能超过 80 个字")
	}
	description := strings.TrimSpace(req.Description)
	if description == "" || utf8.RuneCountInString(description) > 500 {
		return nil, BadAuthRequest("作品描述必填且不能超过 500 个字")
	}
	socialURL, err := validateCommunitySocialURL(req.SocialURL)
	if err != nil {
		return nil, err
	}
	video, err := s.repo.ResourceForUser(actor.ID, strings.TrimSpace(req.VideoResourceID))
	if err != nil || video.Status != model.ResourceStatusReady || video.Kind != "video" || video.DurationMs < 30_000 {
		return nil, BadAuthRequest("请上传已完成且时长不少于 30 秒的视频")
	}
	cover, err := s.repo.ResourceForUser(actor.ID, strings.TrimSpace(req.CoverResourceID))
	if err != nil || cover.Status != model.ResourceStatusReady || cover.Kind != "image" {
		return nil, BadAuthRequest("请上传有效的作品封面图片")
	}

	challengeID, trackID := strings.TrimSpace(req.ChallengeID), strings.TrimSpace(req.TrackID)
	challengeTitle, trackTitle := "", ""
	if challengeID == "" && trackID != "" {
		return nil, BadAuthRequest("选择参赛赛道前请先选择活动")
	}
	if challengeID != "" {
		challenge, challengeErr := s.repo.CreatorChallenge(challengeID)
		if challengeErr != nil || !creatorChallengeAcceptingEntries(challenge, time.Now()) {
			return nil, BadAuthRequest("该活动当前不可投稿")
		}
		tracks, parseErr := parseCreatorChallengeTracks(challenge.TracksJSON)
		if parseErr != nil {
			return nil, fmt.Errorf("读取活动赛道失败：%w", parseErr)
		}
		if trackID != "" {
			for _, track := range tracks {
				if track.ID == trackID {
					trackTitle = track.Name
					break
				}
			}
			if trackTitle == "" {
				return nil, BadAuthRequest("所选赛道不属于当前活动")
			}
		}
		challengeTitle = challenge.ActivityTag
	}

	work := &model.CommunityWork{
		ID: kernel.NewID(), UserID: actor.ID, TeamID: teamID, CanvasProjectID: projectID,
		VideoResourceID: video.ID, CoverResourceID: cover.ID,
		Title: title, Description: description, CreatorName: firstNonEmpty(strings.TrimSpace(actor.DisplayName), strings.TrimSpace(actor.Username)),
		SocialURL: socialURL, ChallengeID: challengeID, ChallengeTitle: challengeTitle,
		TrackID: trackID, TrackTitle: trackTitle, PublicCanvas: req.PublicCanvas,
		Status: model.CommunityWorkPending, CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC(),
	}
	if err := s.repo.CreateCommunityWork(work); err != nil {
		return nil, fmt.Errorf("提交社区作品失败：%w", err)
	}
	if req.PublicCanvas {
		_, shareErr := s.CreateCanvasShare(actor.ID, projectID, CanvasShareRequest{ExpiresDays: 0})
		if shareErr != nil {
			_ = s.repo.DeleteCommunityWork(work.ID)
			return nil, fmt.Errorf("开启公开画布失败：%w", shareErr)
		}
	}
	return work, nil
}

func (s *Service) CommunityWorkOptions() ([]CreatorChallengeView, error) {
	items, err := s.repo.CreatorChallenges(false)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	result := make([]CreatorChallengeView, 0, len(items))
	for _, item := range items {
		if !creatorChallengeAcceptingEntries(&item, now) {
			continue
		}
		view, viewErr := creatorChallengeView(item, now)
		if viewErr != nil {
			return nil, viewErr
		}
		result = append(result, view)
	}
	return result, nil
}

func (s *Service) CreatorChallengeList() ([]CreatorChallengeView, error) {
	items, err := s.repo.CreatorChallenges(true)
	if err != nil {
		return nil, err
	}
	result := make([]CreatorChallengeView, 0, len(items))
	now := time.Now()
	for _, item := range items {
		view, viewErr := creatorChallengeView(item, now)
		if viewErr != nil {
			return nil, viewErr
		}
		result = append(result, view)
	}
	return result, nil
}

func (s *Service) PublicCommunityWorks(keyword, challengeID, categoryID string, limit int) ([]PublicCommunityWork, error) {
	page, err := s.PublicCommunityWorksPage(keyword, challengeID, categoryID, "", limit)
	if err != nil {
		return nil, err
	}
	return page.Works, nil
}

func (s *Service) PublicCommunityWorksPage(keyword, challengeID, categoryID, cursorValue string, limit int) (*PublicCommunityWorkPage, error) {
	if limit < 1 || limit > 48 {
		return nil, BadAuthRequest("社区作品每页数量必须是 1–48 之间的整数")
	}
	cursor, err := decodePublicCommunityWorkCursor(cursorValue)
	if err != nil {
		return nil, err
	}
	items, err := s.repo.PublicCommunityWorksAfter(keyword, challengeID, categoryID, cursor, limit+1)
	if err != nil {
		return nil, err
	}
	page := &PublicCommunityWorkPage{Works: make([]PublicCommunityWork, 0, min(len(items), limit))}
	if len(items) > limit {
		page.NextCursor = encodePublicCommunityWorkCursor(items[limit-1])
		items = items[:limit]
	}
	creatorIDs := make([]string, 0, len(items))
	for _, item := range items {
		creatorIDs = append(creatorIDs, item.UserID)
	}
	creatorAvatars, err := s.repo.CommunityCreatorAvatars(creatorIDs)
	if err != nil {
		return nil, err
	}
	for _, item := range items {
		publishedAt := item.CreatedAt
		if item.ReviewedAt != nil {
			publishedAt = *item.ReviewedAt
		}
		view := s.publicCommunityWorkView(item, publishedAt, creatorAvatars[item.UserID])
		view.CanvasURL, err = s.publicCommunityCanvasURL(item)
		if err != nil {
			return nil, err
		}
		page.Works = append(page.Works, view)
	}
	return page, nil
}

func decodePublicCommunityWorkCursor(value string) (*repository.PublicCommunityWorkCursor, error) {
	if value == "" {
		return nil, nil
	}
	if len(value) > 512 {
		return nil, BadAuthRequest("社区作品分页游标无效")
	}
	data, err := base64.RawURLEncoding.DecodeString(value)
	var cursor publicCommunityWorkCursor
	if err != nil || json.Unmarshal(data, &cursor) != nil || strings.TrimSpace(cursor.ID) == "" || len(cursor.ID) > 80 || cursor.PublishedAt.IsZero() || cursor.CreatedAt.IsZero() {
		return nil, BadAuthRequest("社区作品分页游标无效")
	}
	return &repository.PublicCommunityWorkCursor{ID: cursor.ID, Position: cursor.Position, PublishedAt: cursor.PublishedAt, CreatedAt: cursor.CreatedAt}, nil
}

func encodePublicCommunityWorkCursor(work model.CommunityWork) string {
	publishedAt := work.CreatedAt
	if work.ReviewedAt != nil {
		publishedAt = *work.ReviewedAt
	}
	data, _ := json.Marshal(publicCommunityWorkCursor{ID: work.ID, Position: work.Position, PublishedAt: publishedAt, CreatedAt: work.CreatedAt})
	return base64.RawURLEncoding.EncodeToString(data)
}

func (s *Service) PublicCommunityCategories() ([]CommunityCategoryView, error) {
	items, err := s.repo.CommunityCategories(false)
	if err != nil {
		return nil, err
	}
	result := make([]CommunityCategoryView, 0, len(items))
	for _, item := range items {
		result = append(result, communityCategoryView(item))
	}
	return result, nil
}

func (s *Service) AdminCommunityCategories(actor *model.User) ([]CommunityCategoryView, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	items, err := s.repo.CommunityCategories(true)
	if err != nil {
		return nil, err
	}
	result := make([]CommunityCategoryView, 0, len(items))
	for _, item := range items {
		result = append(result, communityCategoryView(item))
	}
	return result, nil
}

func (s *Service) SaveCommunityCategory(actor *model.User, req CommunityCategoryRequest) (*CommunityCategoryView, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	name := strings.TrimSpace(req.Name)
	if name == "" || utf8.RuneCountInString(name) > 160 {
		return nil, BadAuthRequest("分类名称必填且不能超过 160 个字")
	}
	if utf8.RuneCountInString(strings.TrimSpace(req.Description)) > 2000 {
		return nil, BadAuthRequest("分类说明不能超过 2000 个字")
	}
	id := strings.TrimSpace(req.ID)
	category := &model.CommunityCategory{ID: id, Name: name, Description: strings.TrimSpace(req.Description), SortOrder: req.SortOrder, Enabled: req.Enabled}
	if id != "" {
		current, err := s.repo.CommunityCategory(id)
		if err != nil {
			return nil, NotFound("社区作品分类不存在")
		}
		category.CreatedAt = current.CreatedAt
	} else {
		category.ID = kernel.NewID()
		category.CreatedAt = time.Now().UTC()
	}
	category.UpdatedAt = time.Now().UTC()
	if err := s.repo.SaveCommunityCategory(category); err != nil {
		return nil, err
	}
	// 分类改名后同步冗余标题，公开接口不需要额外 join。
	if err := s.repo.UpdateCommunityCategoryTitle(category.ID, category.Name); err != nil {
		return nil, err
	}
	view := communityCategoryView(*category)
	return &view, nil
}

func (s *Service) AssignCommunityWorksCategory(actor *model.User, req CommunityWorkCategoryRequest) error {
	if err := s.RequireAdmin(actor); err != nil {
		return err
	}
	ids := uniqueNonEmptyStrings(req.WorkIDs)
	if len(ids) == 0 || len(ids) > 200 {
		return BadAuthRequest("请选择 1 到 200 个社区作品")
	}
	categoryID := strings.TrimSpace(req.CategoryID)
	if categoryID == "" {
		return BadAuthRequest("请选择社区作品分类")
	}
	category, err := s.repo.CommunityCategory(categoryID)
	if err != nil || !category.Enabled {
		return BadAuthRequest("社区作品分类不存在或已停用")
	}
	return s.repo.AssignCommunityWorksCategory(ids, category)
}

func (s *Service) MoveCommunityWork(actor *model.User, req CommunityWorkReorderRequest) (bool, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return false, err
	}
	workID := strings.TrimSpace(req.WorkID)
	categoryID := strings.TrimSpace(req.CategoryID)
	if workID == "" || categoryID == "" || (req.Direction != -1 && req.Direction != 1) {
		return false, BadAuthRequest("作品顺序调整参数无效")
	}
	return s.repo.MoveCommunityWork(workID, categoryID, req.Direction)
}

func (s *Service) PublicCommunityWork(id string) (*PublicCommunityWork, error) {
	work, err := s.repo.CommunityWork(strings.TrimSpace(id))
	if err != nil || work.Status != model.CommunityWorkApproved {
		return nil, NotFound("社区作品不存在")
	}
	publishedAt := work.CreatedAt
	if work.ReviewedAt != nil {
		publishedAt = *work.ReviewedAt
	}
	creatorAvatars, err := s.repo.CommunityCreatorAvatars([]string{work.UserID})
	if err != nil {
		return nil, err
	}
	view := s.publicCommunityWorkView(*work, publishedAt, creatorAvatars[work.UserID])
	view.CanvasURL, err = s.publicCommunityCanvasURL(*work)
	if err != nil {
		return nil, err
	}
	return &view, nil
}

func (s *Service) publicCommunityCanvasURL(work model.CommunityWork) (string, error) {
	if !work.PublicCanvas {
		return "", nil
	}
	share, err := s.repo.CanvasShareForProject(work.UserID, work.CanvasProjectID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	if !share.Enabled || share.TokenCipher == "" {
		return "", nil
	}
	status, err := s.CanvasShareStatus(work.UserID, work.CanvasProjectID)
	if err != nil {
		return "", err
	}
	if !status.Enabled || status.Token == "" {
		return "", nil
	}
	return "/share/canvas/" + url.PathEscape(status.Token), nil
}

func (s *Service) MyCommunityWorks(actor *model.User) ([]MyCommunityWork, error) {
	if actor == nil {
		return nil, Unauthorized("请先登录")
	}
	items, err := s.repo.CommunityWorksForUser(actor.ID)
	if err != nil {
		return nil, err
	}
	result := make([]MyCommunityWork, 0, len(items))
	for _, item := range items {
		result = append(result, MyCommunityWork{
			ID: item.ID, TeamID: item.TeamID, CanvasProjectID: item.CanvasProjectID,
			Title: item.Title, Description: item.Description, CreatorName: item.CreatorName,
			SocialURL: item.SocialURL, ChallengeID: item.ChallengeID, ChallengeTitle: item.ChallengeTitle,
			TrackID: item.TrackID, TrackTitle: item.TrackTitle, PublicCanvas: item.PublicCanvas,
			Status: item.Status, ReviewNote: item.ReviewNote, ReviewedAt: item.ReviewedAt,
			CreatedAt: item.CreatedAt, UpdatedAt: item.UpdatedAt,
		})
	}
	return result, nil
}

func (s *Service) PreparePublicCommunityMedia(workID, kind, rangeHeader string, options ResourceAccessOptions) (*ResourceDelivery, error) {
	work, err := s.repo.CommunityWork(strings.TrimSpace(workID))
	if err != nil || work.Status != model.CommunityWorkApproved {
		return nil, NotFound("社区作品不存在")
	}
	resourceID := ""
	switch kind {
	case "cover":
		resourceID = work.CoverResourceID
	case "video":
		resourceID = work.VideoResourceID
	default:
		return nil, NotFound("社区作品资源不存在")
	}
	return s.PrepareResourceDelivery(work.UserID, resourceID, options, rangeHeader)
}

func (s *Service) PublicCommunityCreatorAvatar(workID string) ([]byte, error) {
	work, err := s.repo.CommunityWork(strings.TrimSpace(workID))
	if errors.Is(err, gorm.ErrRecordNotFound) || (err == nil && work.Status != model.CommunityWorkApproved) {
		return nil, NotFound("社区作品不存在")
	}
	if err != nil {
		return nil, err
	}
	user, err := s.repo.User(work.UserID)
	if errors.Is(err, gorm.ErrRecordNotFound) || (err == nil && (user.Status != model.UserStatusActive || user.AvatarMode != "custom")) {
		return nil, NotFound("作者头像不存在")
	}
	if err != nil {
		return nil, err
	}
	avatar, err := s.repo.UserAvatar(user.ID)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, NotFound("作者头像不存在")
	}
	if err != nil {
		return nil, err
	}
	if len(avatar.Data) == 0 {
		return nil, NotFound("作者头像不存在")
	}
	return avatar.Data, nil
}

func (s *Service) PrepareAdminCommunityMedia(actor *model.User, workID, kind, rangeHeader string, options ResourceAccessOptions) (*ResourceDelivery, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	work, err := s.repo.CommunityWork(strings.TrimSpace(workID))
	if err != nil {
		return nil, NotFound("社区作品不存在")
	}
	resourceID := ""
	switch kind {
	case "cover":
		resourceID = work.CoverResourceID
	case "video":
		resourceID = work.VideoResourceID
	default:
		return nil, NotFound("社区作品资源不存在")
	}
	return s.PrepareResourceDeliveryAsAdmin(actor, resourceID, options, rangeHeader)
}

func (s *Service) AdminCommunityWorkPage(actor *model.User, status, categoryID, keyword string, page, limit int) (*AdminCommunityWorkPage, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	items, total, err := s.repo.AdminCommunityWorks(status, categoryID, keyword, page, limit)
	if err != nil {
		return nil, err
	}
	result := &AdminCommunityWorkPage{Works: make([]AdminCommunityWork, 0, len(items)), Total: total, Page: page, Limit: limit}
	for _, item := range items {
		result.Works = append(result.Works, AdminCommunityWork{CommunityWork: item, CanvasProjectID: item.CanvasProjectID, VideoResourceID: item.VideoResourceID, CoverResourceID: item.CoverResourceID})
	}
	return result, nil
}

func (s *Service) ReviewCommunityWork(actor *model.User, id string, req CommunityWorkReviewRequest) (*model.CommunityWork, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	if req.Status != model.CommunityWorkApproved && req.Status != model.CommunityWorkRejected {
		return nil, BadAuthRequest("审核结果无效")
	}
	note := strings.TrimSpace(req.Note)
	if utf8.RuneCountInString(note) > 500 {
		return nil, BadAuthRequest("审核说明不能超过 500 个字")
	}
	if req.Status == model.CommunityWorkRejected && note == "" {
		return nil, BadAuthRequest("驳回作品时请填写原因")
	}
	work, err := s.repo.CommunityWork(strings.TrimSpace(id))
	if err != nil {
		return nil, NotFound("社区作品不存在")
	}
	now := time.Now().UTC()
	updated, err := s.repo.ReviewCommunityWork(work.ID, string(req.Status), note, actor.ID, now)
	if err != nil {
		if errors.Is(err, repository.ErrCommunityWorkMediaUnavailable) {
			return nil, BadAuthRequest("视频或封面资源已失效，不能审核通过")
		}
		return nil, err
	}
	if !updated {
		return nil, NotFound("社区作品不存在")
	}
	if err := s.appendAdminAudit(actor, "community_work.review", "community_work", work.ID, "审核社区作品", map[string]any{"status": req.Status, "note": note}); err != nil {
		return nil, err
	}
	return s.repo.CommunityWork(work.ID)
}

func (s *Service) SaveCreatorChallenge(actor *model.User, req CreatorChallengeRequest) (*CreatorChallengeView, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	title, activityTag := strings.TrimSpace(req.Title), strings.TrimSpace(req.ActivityTag)
	if title == "" || utf8.RuneCountInString(title) > 160 {
		return nil, BadAuthRequest("活动名称必填且不能超过 160 个字")
	}
	if activityTag == "" || utf8.RuneCountInString(activityTag) > 120 {
		return nil, BadAuthRequest("活动标签必填且不能超过 120 个字")
	}
	if utf8.RuneCountInString(strings.TrimSpace(req.Description)) > 2000 {
		return nil, BadAuthRequest("活动介绍不能超过 2000 个字")
	}
	if req.StartsAt != nil && req.EndsAt != nil && !req.EndsAt.After(*req.StartsAt) {
		return nil, BadAuthRequest("活动结束时间必须晚于开始时间")
	}
	tracks := make([]CreatorChallengeTrack, 0, len(req.Tracks))
	seen := map[string]bool{}
	for _, track := range req.Tracks {
		name := strings.TrimSpace(track.Name)
		if name == "" || utf8.RuneCountInString(name) > 120 {
			return nil, BadAuthRequest("每条参赛赛道都必须填写名称，且不能超过 120 个字")
		}
		key := strings.ToLower(name)
		if seen[key] {
			return nil, BadAuthRequest("参赛赛道名称不能重复")
		}
		seen[key] = true
		id := strings.TrimSpace(track.ID)
		if id == "" {
			id = kernel.NewID()
		}
		tracks = append(tracks, CreatorChallengeTrack{ID: id, Name: name})
	}
	if len(tracks) == 0 {
		return nil, BadAuthRequest("活动至少需要一条参赛赛道")
	}
	trackJSON, err := json.Marshal(tracks)
	if err != nil {
		return nil, err
	}
	id := strings.TrimSpace(req.ID)
	isNew := id == ""
	if isNew {
		id = kernel.NewID()
	}
	description := strings.TrimSpace(req.Description)
	posterResourceID := ""
	if match := challengePosterResourcePattern.FindStringSubmatch(description); len(match) == 2 {
		posterResourceID = strings.TrimSpace(match[1])
		resource, resourceErr := s.repo.ResourceForUser(actor.ID, posterResourceID)
		if resourceErr != nil {
			return nil, BadAuthRequest("活动主视觉图片不可用，请重新上传")
		}
		if resource.Kind != "image" || resource.Status != model.ResourceStatusReady {
			return nil, BadAuthRequest("活动主视觉图片尚未上传完成")
		}
		description = challengePosterResourcePattern.ReplaceAllString(description, "![活动主视觉](/api/public/linghua/community/challenges/"+url.PathEscape(id)+"/poster)")
	}
	challenge := &model.CreatorChallenge{ID: id, Title: title, Description: description, PosterResourceID: posterResourceID, ActivityTag: activityTag, TracksJSON: string(trackJSON), StartsAt: req.StartsAt, EndsAt: req.EndsAt, Enabled: req.Enabled}
	if !isNew {
		current, findErr := s.repo.CreatorChallenge(id)
		if findErr != nil {
			return nil, NotFound("创作者挑战赛不存在")
		}
		challenge.CreatedAt = current.CreatedAt
		if posterResourceID == "" && strings.Contains(description, "/challenges/"+url.PathEscape(id)+"/poster") {
			challenge.PosterResourceID = current.PosterResourceID
		}
	} else {
		challenge.CreatedAt = time.Now().UTC()
	}
	challenge.UpdatedAt = time.Now().UTC()
	if err := s.repo.SaveCreatorChallenge(challenge); err != nil {
		return nil, err
	}
	if err := s.appendAdminAudit(actor, "creator_challenge.save", "creator_challenge", challenge.ID, "保存创作者挑战赛", map[string]any{"enabled": challenge.Enabled, "trackCount": len(tracks)}); err != nil {
		return nil, err
	}
	view, err := creatorChallengeView(*challenge, time.Now())
	return &view, err
}

func (s *Service) PreparePublicCreatorChallengePoster(challengeID, rangeHeader string, options ResourceAccessOptions) (*ResourceDelivery, error) {
	challenge, err := s.repo.CreatorChallenge(strings.TrimSpace(challengeID))
	if err != nil {
		return nil, NotFound("活动不存在")
	}
	if challenge.PosterResourceID == "" {
		return nil, NotFound("活动主视觉不存在")
	}
	resource, err := s.repo.Resource(challenge.PosterResourceID)
	if err != nil || resource.Kind != "image" || resource.Status != model.ResourceStatusReady {
		return nil, NotFound("活动主视觉不存在")
	}
	options = ResourceAccessOptions{Purpose: "display", Variant: options.Variant}
	return s.prepareResourceDelivery(resource.UserID, resource, options, rangeHeader)
}

func (s *Service) AdminCreatorChallengeList(actor *model.User) ([]CreatorChallengeView, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	items, err := s.repo.CreatorChallenges(true)
	if err != nil {
		return nil, err
	}
	result := make([]CreatorChallengeView, 0, len(items))
	for _, item := range items {
		view, viewErr := creatorChallengeView(item, time.Now())
		if viewErr != nil {
			return nil, viewErr
		}
		result = append(result, view)
	}
	return result, nil
}

func creatorChallengeView(challenge model.CreatorChallenge, now time.Time) (CreatorChallengeView, error) {
	tracks, err := parseCreatorChallengeTracks(challenge.TracksJSON)
	if err != nil {
		return CreatorChallengeView{}, fmt.Errorf("创作者挑战赛赛道数据无效：%w", err)
	}
	status := "upcoming"
	if !challenge.Enabled {
		status = "inactive"
	} else if challenge.EndsAt != nil && !challenge.EndsAt.After(now) {
		status = "ended"
	} else if challenge.StartsAt == nil || !challenge.StartsAt.After(now) {
		status = "active"
	}
	view := CreatorChallengeView{CreatorChallenge: challenge, Tracks: tracks, Status: status}
	if challenge.PosterResourceID != "" {
		posterURL := "/api/public/linghua/community/challenges/" + url.PathEscape(challenge.ID) + "/poster"
		view.Description = challengePosterResourcePattern.ReplaceAllString(view.Description, "![活动主视觉]("+posterURL+")")
	}
	return view, nil
}

func parseCreatorChallengeTracks(raw string) ([]CreatorChallengeTrack, error) {
	if strings.TrimSpace(raw) == "" {
		return []CreatorChallengeTrack{}, nil
	}
	var tracks []CreatorChallengeTrack
	if err := json.Unmarshal([]byte(raw), &tracks); err != nil {
		return nil, err
	}
	return tracks, nil
}

func communityCategoryView(category model.CommunityCategory) CommunityCategoryView {
	return CommunityCategoryView{ID: category.ID, Name: category.Name, Description: category.Description, SortOrder: category.SortOrder, Enabled: category.Enabled, CreatedAt: category.CreatedAt, UpdatedAt: category.UpdatedAt}
}

func uniqueNonEmptyStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func creatorChallengeAcceptingEntries(challenge *model.CreatorChallenge, now time.Time) bool {
	return challenge != nil && challenge.Enabled &&
		(challenge.StartsAt == nil || !challenge.StartsAt.After(now)) &&
		(challenge.EndsAt == nil || challenge.EndsAt.After(now))
}

func validateCommunitySocialURL(raw string) (string, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return "", nil
	}
	parsed, err := url.Parse(value)
	if err != nil || (parsed.Scheme != "https" && parsed.Scheme != "http") || parsed.Hostname() == "" || parsed.User != nil {
		return "", BadAuthRequest("请填写有效的社媒作品链接（http 或 https）")
	}
	if len(value) > 2048 {
		return "", BadAuthRequest("社媒链接不能超过 2048 个字符")
	}
	return parsed.String(), nil
}

func (s *Service) publicCommunityWorkView(work model.CommunityWork, publishedAt time.Time, creatorAvatar repository.CommunityCreatorAvatar) PublicCommunityWork {
	videoURL := "/api/public/linghua/community/works/" + url.PathEscape(work.ID) + "/media/video"
	coverURL := "/api/public/linghua/community/works/" + url.PathEscape(work.ID) + "/media/cover"
	view := PublicCommunityWork{
		ID: work.ID, Title: work.Title, Description: work.Description, CreatorName: work.CreatorName,
		SocialURL: work.SocialURL, ChallengeID: work.ChallengeID, ChallengeTitle: work.ChallengeTitle,
		TrackTitle: work.TrackTitle, CategoryID: work.CategoryID, CategoryTitle: work.CategoryTitle, PublicCanvas: work.PublicCanvas,
		CoverURL:    coverURL,
		VideoURL:    videoURL,
		PublishedAt: publishedAt,
	}
	view.CreatorAvatarMode = creatorAvatar.AvatarMode
	view.CreatorAvatarPreset = creatorAvatar.AvatarPreset
	if creatorAvatar.AvatarMode == "custom" {
		view.CreatorAvatarURL = "/api/public/linghua/community/works/" + url.PathEscape(work.ID) + "/creator-avatar"
		if creatorAvatar.AvatarVersion != "" {
			view.CreatorAvatarURL += "?v=" + url.QueryEscape(creatorAvatar.AvatarVersion)
		}
	} else if creatorAvatar.AvatarMode != "default" {
		view.CreatorAvatarURL = creatorAvatar.IdentityAvatarURL
	}
	if resource, err := s.repo.Resource(work.VideoResourceID); err == nil {
		if resource.PlaybackStatus == model.PlaybackStatusReady && resource.PlaybackObjectKey != "" {
			view.VideoSources = append(view.VideoSources,
				CommunityVideoSource{URL: videoURL + "?variant=playback", Label: "兼容播放", Quality: "playback", Width: resource.Width, Height: resource.Height},
				CommunityVideoSource{URL: videoURL, Label: "原画", Quality: "source", Width: resource.Width, Height: resource.Height},
			)
		}
	}
	return view
}
