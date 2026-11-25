package repository

import (
	"gorm.io/gorm"
	"yingce/backend/internal/model"
)

func (r *Repository) NavigationMenuItems(enabledOnly bool) ([]model.NavigationMenuItem, error) {
	query := r.db.Model(&model.NavigationMenuItem{})
	if enabledOnly {
		query = query.Where("enabled = ?", true)
	}
	var items []model.NavigationMenuItem
	err := query.Order("group_order asc, group_title asc, sort_order asc, id asc").Find(&items).Error
	return items, err
}

func (r *Repository) SaveNavigationMenuItem(item *model.NavigationMenuItem) error {
	return r.db.Save(item).Error
}

func (r *Repository) SaveNavigationMenuItems(items []model.NavigationMenuItem) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		for index := range items {
			if err := tx.Save(&items[index]).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *Repository) DeleteNavigationMenuItem(id string) error {
	return r.db.Delete(&model.NavigationMenuItem{}, "id = ? AND built_in = ?", id, false).Error
}
