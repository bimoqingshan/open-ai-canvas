package app

import (
	"encoding/json"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
	"yingce/backend/internal/model"
)

type HomeCarouselConfig struct {
	AutoplayEnabled bool                   `json:"autoplayEnabled"`
	IntervalMS      int                    `json:"intervalMs"`
	Slides          []HomeCarouselSlide    `json:"slides"`
	RegionRefs      HomeCarouselRegionRefs `json:"regionRefs"`
}

type HomeCarouselRegionRefs struct {
	Primary []string `json:"primary"`
	Banner  []string `json:"banner"`
	Support []string `json:"support"`
}

type HomeCarouselSlide struct {
	ID                string          `json:"id"`
	Enabled           bool            `json:"enabled"`
	Title             string          `json:"title"`
	Description       string          `json:"description"`
	VideoURL          string          `json:"videoUrl"`
	PosterURL         string          `json:"posterUrl"`
	AltText           string          `json:"altText"`
	DetailEnabled     bool            `json:"detailEnabled"`
	DetailTitle       string          `json:"detailTitle"`
	DetailContent     json.RawMessage `json:"detailContent"`
	DetailButtonLabel string          `json:"detailButtonLabel"`
	ActionLabel       string          `json:"actionLabel"`
	ActionURL         string          `json:"actionUrl"`
}

func (s *Service) PublicHomeCarousel() (HomeCarouselConfig, error) {
	config, err := s.homeCarouselConfig()
	if err != nil {
		return HomeCarouselConfig{}, err
	}
	active := config.Slides[:0]
	for _, slide := range config.Slides {
		if slide.Enabled {
			active = append(active, slide)
		}
	}
	config.Slides = active
	return config, nil
}

func (s *Service) AdminHomeCarousel(actor *model.User) (HomeCarouselConfig, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return HomeCarouselConfig{}, err
	}
	return s.homeCarouselConfig()
}

func (s *Service) UpdateAdminHomeCarousel(actor *model.User, config HomeCarouselConfig) (HomeCarouselConfig, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return HomeCarouselConfig{}, err
	}
	if config.IntervalMS < 3000 || config.IntervalMS > 15000 || len(config.Slides) == 0 || len(config.Slides) > 8 {
		return HomeCarouselConfig{}, BadAuthRequest("首页轮播配置无效")
	}
	ids := make(map[string]bool, len(config.Slides))
	for _, slide := range config.Slides {
		if slide.ID == "" || len(slide.ID) > 80 || ids[slide.ID] || strings.TrimSpace(slide.Title) == "" || (slide.VideoURL == "" && slide.PosterURL == "") {
			return HomeCarouselConfig{}, BadAuthRequest("首页轮播项目无效")
		}
		ids[slide.ID] = true
	}
	for _, id := range config.RegionRefs.Primary {
		if !ids[id] {
			return HomeCarouselConfig{}, BadAuthRequest("首页轮播引用了不存在的项目")
		}
	}
	if len(config.RegionRefs.Primary) == 0 {
		return HomeCarouselConfig{}, BadAuthRequest("首页主视觉至少需要一个项目")
	}
	data, err := json.Marshal(config)
	if err != nil {
		return HomeCarouselConfig{}, err
	}
	setting := &model.HomeCarouselSetting{ID: "home", ConfigJSON: string(data), UpdatedBy: actor.ID, UpdatedAt: time.Now().UTC()}
	if err := s.repo.SaveHomeCarouselSetting(setting); err != nil {
		return HomeCarouselConfig{}, err
	}
	return config, nil
}

func (s *Service) homeCarouselConfig() (HomeCarouselConfig, error) {
	setting, err := s.repo.HomeCarouselSetting()
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return HomeCarouselConfig{}, err
		}
		return defaultHomeCarouselConfig(), nil
	}
	var config HomeCarouselConfig
	if err := json.Unmarshal([]byte(setting.ConfigJSON), &config); err != nil {
		return HomeCarouselConfig{}, err
	}
	return config, nil
}

func defaultHomeCarouselConfig() HomeCarouselConfig {
	newSlide := func(id, title, description, videoURL, posterURL, altText string) HomeCarouselSlide {
		return HomeCarouselSlide{ID: id, Enabled: true, Title: title, Description: description, VideoURL: videoURL, PosterURL: posterURL, AltText: altText, DetailContent: json.RawMessage(`{"type":"doc","content":[]}`), DetailButtonLabel: "了解详情", ActionLabel: "开始创作", ActionURL: "/create"}
	}
	return HomeCarouselConfig{
		AutoplayEnabled: true,
		IntervalMS:      6500,
		RegionRefs: HomeCarouselRegionRefs{
			Primary: []string{"minimax-h3", "director-studio", "fantasy-storytelling"},
			Banner:  []string{"seedance-2-5", "fantasy-storytelling", "minimax-h3"},
			Support: []string{"director-studio", "seedance-2-5"},
		},
		Slides: []HomeCarouselSlide{
			newSlide("minimax-h3", "MiniMax-H3", "让运动、光线与空间保持同一个叙事方向。", "/home-banner/minimax-h3-wide.mp4", "/short-drama-styles/cyberpunk-neon.jpg", "MiniMax-H3 视频生成推荐"),
			newSlide("seedance-2-5", "Seedance 2.5", "把动作、镜头与光线组织成连贯的动态画面。", "/home-banner/seedance-2-5-wide.mp4", "/short-drama-styles/urban-live-action.jpg", "Seedance 2.5 视频生成推荐"),
			newSlide("director-studio", "导演工作台", "从人物、空间与光线出发，梳理镜头表达。", "/home-banner/director-studio-wide.mp4", "/short-drama-styles/suspense-noir.jpg", "导演工作台推荐"),
			newSlide("fantasy-storytelling", "奇幻叙事", "从一个画面开始，让故事继续向前。", "/home-banner/studio-feature-wide.mp4", "/short-drama-styles/fantasy-3d.jpg", "奇幻视觉创作推荐"),
		},
	}
}

type LearningSquareConfig struct {
	Enabled        bool     `json:"enabled"`
	Title          string   `json:"title"`
	Description    string   `json:"description"`
	VisibleSources []string `json:"visibleSources"`
}

func defaultLearningSquareConfig() LearningSquareConfig {
	return LearningSquareConfig{Enabled: true, Title: "灵感大厅", Description: "每天换一批推荐，新上架的排在前面。点开查看完整提示词，用喜欢的创意继续创作。", VisibleSources: []string{"original", "chatgpt-prompts", "seedance", "haohaoxue", "youmind"}}
}

func (s *Service) PublicLearningSquareConfig() (LearningSquareConfig, error) {
	return s.learningSquareConfig()
}

func (s *Service) AdminLearningSquareConfig(actor *model.User) (LearningSquareConfig, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return LearningSquareConfig{}, err
	}
	return s.learningSquareConfig()
}

func (s *Service) UpdateAdminLearningSquareConfig(actor *model.User, config LearningSquareConfig) (LearningSquareConfig, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return LearningSquareConfig{}, err
	}
	config.Title = strings.TrimSpace(config.Title)
	config.Description = strings.TrimSpace(config.Description)
	if config.Title == "" || len([]rune(config.Title)) > 80 || len([]rune(config.Description)) > 500 {
		return LearningSquareConfig{}, BadAuthRequest("学习广场标题必填且不能超过 80 个字，说明不能超过 500 个字")
	}
	allowed := map[string]bool{"original": true, "chatgpt-prompts": true, "seedance": true, "haohaoxue": true, "youmind": true}
	seen := map[string]bool{}
	for _, source := range config.VisibleSources {
		if !allowed[source] || seen[source] {
			return LearningSquareConfig{}, BadAuthRequest("学习广场来源配置无效")
		}
		seen[source] = true
	}
	data, err := json.Marshal(config)
	if err != nil {
		return LearningSquareConfig{}, err
	}
	setting := &model.LearningSquareSetting{ID: "learning-square", ConfigJSON: string(data), UpdatedBy: actor.ID, UpdatedAt: time.Now().UTC()}
	if err := s.repo.SaveLearningSquareSetting(setting); err != nil {
		return LearningSquareConfig{}, err
	}
	return config, nil
}

func (s *Service) learningSquareConfig() (LearningSquareConfig, error) {
	setting, err := s.repo.LearningSquareSetting()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return defaultLearningSquareConfig(), nil
		}
		return LearningSquareConfig{}, err
	}
	var config LearningSquareConfig
	if err := json.Unmarshal([]byte(setting.ConfigJSON), &config); err != nil {
		return LearningSquareConfig{}, err
	}
	return config, nil
}
