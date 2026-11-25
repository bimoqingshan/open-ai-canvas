package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"gorm.io/gorm"
	"yingce/backend/internal/model"
)

const academySettingKey = "academy_content"

const (
	academyMaxConfigBytes = 512 << 10
	academyMaxTabs        = 12
	academyMaxCourses     = 100
	academyMaxSections    = 40
	academyMaxMarkdown    = 32 << 10
)

var (
	academyIDPattern        = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)
	academyMarkdownLinkExpr = regexp.MustCompile(`!?\[[^\]]*\]\(([^)]+)\)`)
)

type AcademyConfig struct {
	Enabled bool         `json:"enabled"`
	Title   string       `json:"title"`
	Tabs    []AcademyTab `json:"tabs"`
}

type AcademyTab struct {
	ID      string          `json:"id"`
	Label   string          `json:"label"`
	Enabled bool            `json:"enabled"`
	Courses []AcademyCourse `json:"courses"`
}

type AcademyCourse struct {
	ID              string           `json:"id"`
	Enabled         bool             `json:"enabled"`
	Title           string           `json:"title"`
	DetailTitle     string           `json:"detailTitle,omitempty"`
	Summary         string           `json:"summary"`
	CoverURL        string           `json:"coverUrl"`
	Tags            []string         `json:"tags"`
	ReadingDuration string           `json:"readingDuration"`
	FeatureSummary  string           `json:"featureSummary"`
	Intro           string           `json:"intro"`
	Sections        []AcademySection `json:"sections"`
	CTALabel        string           `json:"ctaLabel"`
	CTAURL          string           `json:"ctaUrl"`
}

type AcademySection struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Content string `json:"content"`
}

type academyCourseSeed struct {
	id, title, summary, cover, tags, duration, feature string
}

func defaultAcademyConfig() AcademyConfig {
	basics := []academyCourseSeed{
		{"canvas-node", "Canvas & Node\n画布与节点", "从无限画布开始，认识文本、图片、视频与音频节点。", "/short-drama-styles/nature-healing.jpg", "基础教程,画布", "约 15 分钟", "画布、文本、图片、视频、音频节点"},
		{"libtv-15", "LibTV 1.5\n独家功能", "把剧本、导演执行与创意资产放进一条连续的创作流程。", "/short-drama-styles/black-white-noir.jpg", "功能介绍,LibTV 1.5", "约 12 分钟", "剧本原创与改编、导演执行、角色造型室、创意片头、3D-BOX"},
		{"kling-4", "Kling 4.0\n功能介绍", "理解模型能力与参考素材的组合方式，让镜头更连贯。", "/short-drama-styles/urban-live-action.jpg", "模型教程,视频生成", "约 10 分钟", "Kling 4.0 模型能力，搭配 LibTV 1.5 独家功能的玩法"},
		{"seedance", "Seedance\n功能介绍", "掌握真实素材参考、镜头控制与专属提示词优化。", "/short-drama-styles/real-life.jpg", "模型教程,视频生成", "约 11 分钟", "Seedance 2.5、真人素材使用、专属提示词优化"},
		{"image-node", "Image Node\n图片节点功能", "用图片节点整理参考图、构图与视觉资产。", "/short-drama-styles/fantasy-3d.jpg", "图片功能,基础教程", "约 8 分钟", "全景、多角度、打光、九宫格、图像基础编辑、标注、分镜组"},
		{"video-node", "Video Node\n视频节点功能", "从片段管理到动作捕捉，拆解视频节点的主要工具。", "/short-drama-styles/cyberpunk-neon.jpg", "视频功能,基础教程", "约 9 分钟", "视频高清、片段重拍、智能续写、逐帧拉片、深度动作捕捉、音视频分离"},
		{"audio-node", "Audio Node\n音频节点功能", "截取、切分和调整音频，为画面搭建声音节奏。", "/short-drama-styles/future-tech.jpg", "音频功能,基础教程", "约 7 分钟", "音频截取、变速、切分、音色克隆"},
		{"script-node", "Script Node\n脚本节点", "将人物、场景与情节拆成可继续编辑的脚本素材。", "/short-drama-styles/ink-narrative.jpg", "脚本,基础教程", "约 9 分钟", "剧本节点、故事板与结构化创作"},
	}
	features := []academyCourseSeed{
		{"slash-commands", "Slash Commands\n斜杠快捷功能", "用快捷指令快速打开常用操作，把注意力留给创作。", "/short-drama-styles/storybook-fantasy.jpg", "亮点功能,快捷操作", "约 6 分钟", "故事板、剧情推演、多机位、设定图与人像调节"},
		{"workflow", "Workflow\n工作流", "把可复用的创作步骤连接起来，形成自己的制作流程。", "/short-drama-styles/surreal-dream.jpg", "亮点功能,工作流", "约 10 分钟", "创建、连接、复用与管理工作流"},
		{"image-generator", "Image Generator\n图像生成器", "从提示词到参考素材，完成一张可用于后续制作的画面。", "/short-drama-styles/period-live-action.jpg", "亮点功能,图像生成", "约 8 分钟", "提示词、参考图与图像生成"},
		{"video-generator", "Video Generator\n视频生成器", "组合参考与镜头要求，生成连贯的动态片段。", "/short-drama-styles/space-opera.jpg", "亮点功能,视频生成", "约 10 分钟", "视频模型、参考素材与镜头控制"},
	}
	tutorials := []academyCourseSeed{
		basics[0], basics[1], basics[2], basics[3], features[0], basics[4], basics[5], basics[6], features[1], features[2], features[3], basics[7],
	}
	highlights := []academyCourseSeed{
		{"director-execution", "导演执行\n从剧本到镜头", "把人物、场景和情节转化为清晰的镜头执行方案。", "/short-drama-styles/black-white-noir.jpg", "LibTV 1.5,导演执行", "约 9 分钟", "人物调度、场景规划与镜头拆解"},
		{"character-studio", "角色造型室\n角色设计", "围绕角色设定整理造型方向与视觉参考。", "/short-drama-styles/real-life.jpg", "LibTV 1.5,角色设计", "约 8 分钟", "角色设定、造型参考与视觉统一"},
		{"creative-opening", "创意片头\n片头生成", "快速搭建具有辨识度的短剧开场画面。", "/short-drama-styles/storybook-fantasy.jpg", "LibTV 1.5,片头创作", "约 7 分钟", "主题构思、风格选择与片头生成"},
		{"three-d-box", "3D-BOX\n空间创作", "用空间化视角整理场景关系与镜头构图。", "/short-drama-styles/future-tech.jpg", "LibTV 1.5,空间创作", "约 8 分钟", "空间布局、视角变化与场景构图"},
	}

	return AcademyConfig{
		Enabled: true,
		Title:   "学习广场",
		Tabs: []AcademyTab{
			{ID: "tutorials", Label: "图文教程", Enabled: true, Courses: academySeedCourses(tutorials)},
			{ID: "highlights", Label: "亮点功能", Enabled: true, Courses: academySeedCourses(highlights)},
		},
	}
}

func academySeedCourses(seeds []academyCourseSeed) []AcademyCourse {
	courses := make([]AcademyCourse, 0, len(seeds))
	for _, seed := range seeds {
		feature := seed.feature + "。"
		course := AcademyCourse{
			ID:              seed.id,
			Enabled:         true,
			Title:           seed.title,
			Summary:         seed.summary,
			CoverURL:        seed.cover,
			Tags:            strings.Split(seed.tags, ","),
			ReadingDuration: seed.duration,
			FeatureSummary:  seed.feature,
			Intro:           seed.summary + "本课会结合创作过程，带你了解相关能力与常见用法。",
			Sections: []AcademySection{
				{ID: "core-capabilities", Title: "核心能力", Content: "围绕 **" + seed.title + "**，你将了解：\n\n- " + feature + "\n- 如何根据创作目标选择合适的节点或工具。\n- 如何把结果继续交给后续创作步骤。"},
				{ID: "practice", Title: "开始练习", Content: "先准备一份清晰的创作目标，再逐步添加素材并观察每一步的输出。\n\n完成本课后，可以前往画布创建一个练习项目，把学到的操作用于自己的创作。"},
			},
			CTALabel: "前往画布练习",
			CTAURL:   "/canvas",
		}
		if seed.id == "canvas-node" {
			course.DetailTitle = "「基础功能」画布与节点"
			course.Tags = []string{"基础教程", "文字功能", "图片功能", "视频功能", "音频功能"}
			course.Intro = "欢迎来到 LibTV！这节课将带你认识创作的核心阵地——无限画布，了解画布的基本操作方式，并逐一认识文本、图片、视频、音频四大基础节点。\n\n**把 AI 创作理解为「搭积木」的过程，「画布」就是你搭积木的桌面，而「节点」就是一个个积木块。**\n\n学完这一课，你就能独立在画布上创建和管理自己的创作素材，为后续的工作流搭建打下基础。"
			course.Sections = []AcademySection{
				{ID: "what-is-canvas", Title: "什么是画布？", Content: "画布是你在 LibTV 中进行所有创作的主战场。与传统文档不同，画布没有固定的页面边界，你可以自由地在任意位置放置内容、拖动排列，让灵感不受空间限制。在画布上，你主要会做两件事：\n\n- **新建节点：** 画布支持文本、图片、视频、音频 4 种基本节点，你可以根据创作需要随时添加对应类型的节点来承载内容。\n- **节点编辑与连接：** 你可以对任意节点进行修改、删除、复制复用，还可以通过连线建立不同节点之间的关系，让内容按照你的创作逻辑串联起来。"},
				{ID: "create-canvas", Title: "新建画布", Content: "创建画布后，可以在工作区中放置文本、图片、视频和音频节点，从一个创作目标开始逐步整理素材。"},
				{ID: "manage-projects", Title: "管理全部项目", Content: "项目列表用于集中查看和打开创作项目。为项目设置清晰的名称，便于后续继续编辑和协作。"},
				{ID: "canvas-tools", Title: "四大画布功能", Content: "画布支持节点添加、内容编辑、节点连接和项目管理。你可以按创作顺序组织素材，并通过连线表达内容之间的关系。"},
				{ID: "basic-nodes", Title: "认识四大基础节点", Content: "文本、图片、视频和音频节点分别承载不同类型的创作素材。根据素材类型选择对应节点，再把节点连接成清晰的创作流程。"},
				{ID: "text-node", Title: "文本节点 📝", Content: "文本节点用于记录创意、补充说明和整理脚本内容。你可以把文字放在相关素材附近，方便持续编辑和回看。"},
				{ID: "image-node", Title: "图片节点 🎨", Content: "图片节点用于管理视觉参考和图片素材。将参考图放入画布后，可以与文本及其他素材节点建立关系。"},
				{ID: "video-node", Title: "视频节点 🎥", Content: "视频节点用于查看和整理视频素材。将视频与相关图片、脚本或说明放在同一画布中，便于继续制作。"},
				{ID: "audio-node", Title: "音频节点 🎵", Content: "音频节点用于承载声音素材。将音频与视频和文字说明一起组织，方便在创作过程中管理视听内容。"},
			}
		}
		courses = append(courses, course)
	}
	return courses
}

func (s *Service) PublicAcademyConfig() (*AcademyConfig, error) {
	value, err := s.academyConfig()
	if err != nil {
		return nil, err
	}
	public := AcademyConfig{Enabled: value.Enabled, Title: value.Title, Tabs: []AcademyTab{}}
	if !value.Enabled {
		return &public, nil
	}
	for _, tab := range value.Tabs {
		if !tab.Enabled {
			continue
		}
		visible := tab
		visible.Courses = make([]AcademyCourse, 0, len(tab.Courses))
		for _, course := range tab.Courses {
			if course.Enabled {
				course.Sections = []AcademySection{}
				visible.Courses = append(visible.Courses, course)
			}
		}
		if len(visible.Courses) > 0 {
			public.Tabs = append(public.Tabs, visible)
		}
	}
	return &public, nil
}

func (s *Service) PublicAcademyCourse(courseID string) (*AcademyCourse, string, error) {
	value, err := s.academyConfig()
	if err != nil {
		return nil, "", err
	}
	if !value.Enabled {
		return nil, "", NotFound("学院课程不存在")
	}
	for _, tab := range value.Tabs {
		if !tab.Enabled {
			continue
		}
		for _, course := range tab.Courses {
			if course.ID == courseID && course.Enabled {
				return &course, tab.Label, nil
			}
		}
	}
	return nil, "", NotFound("学院课程不存在")
}

func (s *Service) AdminAcademyConfig(actor *model.User) (*AcademyConfig, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	value, err := s.academyConfig()
	if err != nil {
		return nil, err
	}
	return &value, nil
}

func (s *Service) UpdateAcademyConfig(actor *model.User, value AcademyConfig) (*AcademyConfig, error) {
	if err := s.RequireAdmin(actor); err != nil {
		return nil, err
	}
	value = normalizeAcademyConfig(value)
	if err := validateAcademyConfig(value); err != nil {
		return nil, err
	}
	before, err := s.academyConfig()
	if err != nil {
		return nil, err
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	if len(encoded) > academyMaxConfigBytes {
		return nil, errors.New("学院配置不能超过 512 KB")
	}
	_, err = s.repo.AcademySetting()
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	setting := &model.AcademySetting{ID: "academy", ConfigJSON: string(encoded), UpdatedBy: actor.ID}
	setting.UpdatedAt = time.Now().UTC()
	if err := s.repo.SaveAcademySetting(setting); err != nil {
		return nil, err
	}
	if err := s.appendAdminAudit(actor, "linghua.academy.update", "linghua_academy_setting", setting.ID, "更新学习广场内容", map[string]any{
		"before": academyAuditSummary(before),
		"after":  academyAuditSummary(value),
	}); err != nil {
		return nil, err
	}
	return &value, nil
}

func (s *Service) academyConfig() (AcademyConfig, error) {
	setting, err := s.repo.AcademySetting()
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return defaultAcademyConfig(), nil
	}
	if err != nil {
		return AcademyConfig{}, err
	}
	if strings.TrimSpace(setting.ConfigJSON) == "" {
		return AcademyConfig{}, errors.New("学院配置内容为空")
	}
	value := AcademyConfig{}
	if err := json.Unmarshal([]byte(setting.ConfigJSON), &value); err != nil {
		return AcademyConfig{}, fmt.Errorf("学院配置格式无效: %w", err)
	}
	value = normalizeAcademyConfig(value)
	if err := validateAcademyConfig(value); err != nil {
		return AcademyConfig{}, err
	}
	return value, nil
}

func normalizeAcademyConfig(value AcademyConfig) AcademyConfig {
	value.Title = strings.TrimSpace(value.Title)
	if value.Tabs == nil {
		value.Tabs = []AcademyTab{}
	}
	for tabIndex := range value.Tabs {
		tab := &value.Tabs[tabIndex]
		tab.ID = strings.TrimSpace(tab.ID)
		tab.Label = strings.TrimSpace(tab.Label)
		if tab.Courses == nil {
			tab.Courses = []AcademyCourse{}
		}
		for courseIndex := range tab.Courses {
			course := &tab.Courses[courseIndex]
			course.ID = strings.TrimSpace(course.ID)
			course.Title = strings.TrimSpace(course.Title)
			course.DetailTitle = strings.TrimSpace(course.DetailTitle)
			course.Summary = strings.TrimSpace(course.Summary)
			course.CoverURL = strings.TrimSpace(course.CoverURL)
			course.ReadingDuration = strings.TrimSpace(course.ReadingDuration)
			course.FeatureSummary = strings.TrimSpace(course.FeatureSummary)
			course.Intro = strings.TrimSpace(course.Intro)
			course.CTALabel = strings.TrimSpace(course.CTALabel)
			course.CTAURL = strings.TrimSpace(course.CTAURL)
			if course.Tags == nil {
				course.Tags = []string{}
			}
			for tagIndex := range course.Tags {
				course.Tags[tagIndex] = strings.TrimSpace(course.Tags[tagIndex])
			}
			if course.Sections == nil {
				course.Sections = []AcademySection{}
			}
			for sectionIndex := range course.Sections {
				section := &course.Sections[sectionIndex]
				section.ID = strings.TrimSpace(section.ID)
				section.Title = strings.TrimSpace(section.Title)
				section.Content = strings.TrimSpace(section.Content)
			}
		}
	}
	return value
}

func validateAcademyConfig(value AcademyConfig) error {
	if utf8.RuneCountInString(value.Title) == 0 || utf8.RuneCountInString(value.Title) > 60 {
		return errors.New("学院标题必须为 1–60 个字符")
	}
	if len(value.Tabs) == 0 || len(value.Tabs) > academyMaxTabs {
		return fmt.Errorf("学院分类数量必须在 1–%d 之间", academyMaxTabs)
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		return err
	}
	if len(encoded) > academyMaxConfigBytes {
		return errors.New("学院配置不能超过 512 KB")
	}
	tabIDs := make(map[string]struct{}, len(value.Tabs))
	courseIDs := make(map[string]struct{})
	totalCourses := 0
	for tabIndex, tab := range value.Tabs {
		if !academyIDPattern.MatchString(tab.ID) {
			return fmt.Errorf("第 %d 个分类 ID 格式无效", tabIndex+1)
		}
		if _, exists := tabIDs[tab.ID]; exists {
			return fmt.Errorf("分类 ID %q 重复", tab.ID)
		}
		tabIDs[tab.ID] = struct{}{}
		if tab.Label == "" || utf8.RuneCountInString(tab.Label) > 40 {
			return fmt.Errorf("第 %d 个分类名称必须为 1–40 个字符", tabIndex+1)
		}
		totalCourses += len(tab.Courses)
		for courseIndex, course := range tab.Courses {
			position := fmt.Sprintf("分类「%s」第 %d 个课程", tab.Label, courseIndex+1)
			if !academyIDPattern.MatchString(course.ID) {
				return fmt.Errorf("%s ID 格式无效", position)
			}
			if _, exists := courseIDs[course.ID]; exists {
				return fmt.Errorf("课程 ID %q 重复", course.ID)
			}
			courseIDs[course.ID] = struct{}{}
			if course.Title == "" || utf8.RuneCountInString(course.Title) > 100 {
				return fmt.Errorf("%s 标题必须为 1–100 个字符", position)
			}
			if utf8.RuneCountInString(course.DetailTitle) > 120 {
				return fmt.Errorf("%s 详情页标题不能超过 120 个字符", position)
			}
			if course.Summary == "" || utf8.RuneCountInString(course.Summary) > 500 {
				return fmt.Errorf("%s 简介必须为 1–500 个字符", position)
			}
			if course.FeatureSummary == "" || utf8.RuneCountInString(course.FeatureSummary) > 500 {
				return fmt.Errorf("%s 涉及功能必须为 1–500 个字符", position)
			}
			if len(course.CoverURL) > 2048 || !validAcademyURL(course.CoverURL, true) {
				return fmt.Errorf("%s 封面只允许站内路径或 HTTPS 地址", position)
			}
			if utf8.RuneCountInString(course.ReadingDuration) > 40 || utf8.RuneCountInString(course.Intro) > 4000 || utf8.RuneCountInString(course.CTALabel) > 80 {
				return fmt.Errorf("%s 的时长、导语或按钮文案过长", position)
			}
			if course.CTAURL != "" && (len(course.CTAURL) > 2048 || !validAcademyURL(course.CTAURL, false)) {
				return fmt.Errorf("%s 跳转地址只允许站内路径或 HTTPS 地址", position)
			}
			if len(course.Tags) > 12 {
				return fmt.Errorf("%s 标签不能超过 12 个", position)
			}
			for _, tag := range course.Tags {
				if tag == "" || utf8.RuneCountInString(tag) > 40 {
					return fmt.Errorf("%s 的标签必须为 1–40 个字符", position)
				}
			}
			if len(course.Sections) == 0 || len(course.Sections) > academyMaxSections {
				return fmt.Errorf("%s 章节数量必须在 1–%d 之间", position, academyMaxSections)
			}
			sectionIDs := make(map[string]struct{}, len(course.Sections))
			for sectionIndex, section := range course.Sections {
				if !academyIDPattern.MatchString(section.ID) || section.Title == "" || utf8.RuneCountInString(section.Title) > 100 {
					return fmt.Errorf("%s 第 %d 个章节标题或 ID 无效", position, sectionIndex+1)
				}
				if _, exists := sectionIDs[section.ID]; exists {
					return fmt.Errorf("%s 章节 ID %q 重复", position, section.ID)
				}
				sectionIDs[section.ID] = struct{}{}
				if len(section.Content) > academyMaxMarkdown {
					return fmt.Errorf("%s 第 %d 个章节正文不能超过 32 KB", position, sectionIndex+1)
				}
				if err := validateAcademyMarkdownLinks(section.Content); err != nil {
					return fmt.Errorf("%s 第 %d 个章节: %w", position, sectionIndex+1, err)
				}
			}
		}
	}
	if totalCourses > academyMaxCourses {
		return fmt.Errorf("学院课程不能超过 %d 个", academyMaxCourses)
	}
	return nil
}

func validateAcademyMarkdownLinks(content string) error {
	for _, match := range academyMarkdownLinkExpr.FindAllStringSubmatch(content, -1) {
		value := strings.TrimSpace(strings.SplitN(match[1], " ", 2)[0])
		value = strings.Trim(value, "<>")
		if !validAcademyURL(value, true) {
			return errors.New("正文链接和图片只允许站内路径或 HTTPS 地址")
		}
	}
	return nil
}

func validAcademyURL(value string, allowEmpty bool) bool {
	if value == "" {
		return allowEmpty
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed.User != nil {
		return false
	}
	if strings.HasPrefix(value, "/") {
		return !strings.HasPrefix(value, "//") && parsed.Scheme == "" && parsed.Host == ""
	}
	return parsed.Scheme == "https" && parsed.Host != ""
}

func academyAuditSummary(value AcademyConfig) map[string]any {
	courses := 0
	for _, tab := range value.Tabs {
		courses += len(tab.Courses)
	}
	return map[string]any{"enabled": value.Enabled, "tabs": len(value.Tabs), "courses": courses}
}
