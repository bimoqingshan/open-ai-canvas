package repository

import "yingce/backend/internal/model"

func (r *Repository) HomeCarouselSetting() (*model.HomeCarouselSetting, error) {
	var setting model.HomeCarouselSetting
	if err := r.db.First(&setting, "id = ?", "home").Error; err != nil {
		return nil, err
	}
	return &setting, nil
}

func (r *Repository) SaveHomeCarouselSetting(setting *model.HomeCarouselSetting) error {
	return r.db.Save(setting).Error
}

func (r *Repository) LearningSquareSetting() (*model.LearningSquareSetting, error) {
	var setting model.LearningSquareSetting
	if err := r.db.First(&setting, "id = ?", "learning-square").Error; err != nil {
		return nil, err
	}
	return &setting, nil
}

func (r *Repository) SaveLearningSquareSetting(setting *model.LearningSquareSetting) error {
	return r.db.Save(setting).Error
}

func (r *Repository) AcademySetting() (*model.AcademySetting, error) {
	var setting model.AcademySetting
	if err := r.db.First(&setting, "id = ?", "academy").Error; err != nil {
		return nil, err
	}
	return &setting, nil
}

func (r *Repository) SaveAcademySetting(setting *model.AcademySetting) error {
	return r.db.Save(setting).Error
}
