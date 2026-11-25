package model

import "time"

type HomeCarouselSetting struct {
	ID         string    `json:"id" gorm:"primaryKey;size:36"`
	ConfigJSON string    `json:"-" gorm:"type:text;not null"`
	UpdatedBy  string    `json:"-" gorm:"size:36"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

func (HomeCarouselSetting) TableName() string { return "linghua_home_carousel_settings" }

type LearningSquareSetting struct {
	ID         string    `json:"id" gorm:"primaryKey;size:36"`
	ConfigJSON string    `json:"-" gorm:"type:text;not null"`
	UpdatedBy  string    `json:"-" gorm:"size:36"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

func (LearningSquareSetting) TableName() string { return "linghua_learning_square_settings" }

type AcademySetting struct {
	ID         string    `json:"id" gorm:"primaryKey;size:36"`
	ConfigJSON string    `json:"-" gorm:"type:text;not null"`
	UpdatedBy  string    `json:"-" gorm:"size:36"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

func (AcademySetting) TableName() string { return "linghua_academy_settings" }
