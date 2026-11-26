package model

import "time"

type CommunityWorkStatus string

const (
	CommunityWorkPending  CommunityWorkStatus = "pending"
	CommunityWorkApproved CommunityWorkStatus = "approved"
	CommunityWorkRejected CommunityWorkStatus = "rejected"
)

type CommunityWork struct {
	ID              string              `json:"id" gorm:"primaryKey;size:36"`
	UserID          string              `json:"-" gorm:"index;size:36"`
	TeamID          string              `json:"teamId,omitempty" gorm:"index;size:36"`
	CanvasProjectID string              `json:"-" gorm:"index;size:80"`
	VideoResourceID string              `json:"-" gorm:"size:36"`
	CoverResourceID string              `json:"-" gorm:"size:36"`
	Title           string              `json:"title" gorm:"size:80"`
	Description     string              `json:"description" gorm:"type:text"`
	CreatorName     string              `json:"creatorName" gorm:"size:120"`
	SocialURL       string              `json:"socialUrl" gorm:"size:2048"`
	ChallengeID     string              `json:"challengeId,omitempty" gorm:"index;size:36"`
	ChallengeTitle  string              `json:"challengeTitle,omitempty" gorm:"size:160"`
	TrackID         string              `json:"trackId,omitempty" gorm:"size:36"`
	TrackTitle      string              `json:"trackTitle,omitempty" gorm:"size:120"`
	CategoryID      string              `json:"categoryId,omitempty" gorm:"index;size:36"`
	CategoryTitle   string              `json:"categoryTitle,omitempty" gorm:"size:160"`
	Position        int                 `json:"position" gorm:"index;not null;default:0"`
	PublicCanvas    bool                `json:"publicCanvas" gorm:"not null;default:false"`
	Status          CommunityWorkStatus `json:"status" gorm:"index;size:24"`
	ReviewNote      string              `json:"reviewNote,omitempty" gorm:"type:text"`
	ReviewedBy      string              `json:"-" gorm:"size:36"`
	ReviewedAt      *time.Time          `json:"reviewedAt,omitempty"`
	CreatedAt       time.Time           `json:"createdAt" gorm:"index"`
	UpdatedAt       time.Time           `json:"updatedAt"`
}

func (CommunityWork) TableName() string { return "linghua_community_works" }

type CommunityCategory struct {
	ID          string    `json:"id" gorm:"primaryKey;size:36"`
	Name        string    `json:"name" gorm:"size:160;not null"`
	Description string    `json:"description" gorm:"type:text"`
	SortOrder   int       `json:"sortOrder" gorm:"index;not null;default:0"`
	Enabled     bool      `json:"enabled" gorm:"index;not null;default:true"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

func (CommunityCategory) TableName() string { return "linghua_community_categories" }

type CreatorChallenge struct {
	ID               string     `json:"id" gorm:"primaryKey;size:36"`
	Title            string     `json:"title" gorm:"size:160"`
	Description      string     `json:"description" gorm:"type:text"`
	PosterResourceID string     `json:"-" gorm:"size:36"`
	ActivityTag      string     `json:"activityTag" gorm:"size:120"`
	TracksJSON       string     `json:"-" gorm:"type:text"`
	StartsAt         *time.Time `json:"startsAt,omitempty"`
	EndsAt           *time.Time `json:"endsAt,omitempty"`
	Enabled          bool       `json:"enabled" gorm:"index;not null;default:false"`
	CreatedAt        time.Time  `json:"createdAt"`
	UpdatedAt        time.Time  `json:"updatedAt"`
}

func (CreatorChallenge) TableName() string { return "linghua_creator_challenges" }
