package model

import "time"

type NavigationMenuItem struct {
	ID           string                  `json:"id" gorm:"primaryKey;size:64"`
	Title        string                  `json:"title" gorm:"size:80;not null"`
	Path         string                  `json:"path" gorm:"size:512;not null"`
	GroupTitle   string                  `json:"groupTitle" gorm:"size:80;not null;index"`
	GroupOrder   int                     `json:"groupOrder" gorm:"not null;default:0;index"`
	SortOrder    int                     `json:"sortOrder" gorm:"not null;default:0;index"`
	Icon         string                  `json:"icon" gorm:"size:40;not null"`
	Enabled      bool                    `json:"enabled" gorm:"not null;default:true;index"`
	BuiltIn      bool                    `json:"builtIn" gorm:"not null;default:false;index"`
	ContactCards []NavigationContactCard `json:"contactCards" gorm:"serializer:json;type:text;not null;default:'[]'"`
	CreatedAt    time.Time               `json:"createdAt"`
	UpdatedAt    time.Time               `json:"updatedAt"`
}

type NavigationContactCard struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	ImageURL    string `json:"imageUrl"`
}

func (NavigationMenuItem) TableName() string { return "linghua_navigation_menu_items" }
